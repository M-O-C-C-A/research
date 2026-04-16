import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { summarizeSourceSystems } from "./productIntelligenceHelpers";

const PRODUCT_SOURCE_SYSTEM_VALIDATOR = v.union(
  v.literal("drugs_fda"),
  v.literal("openfda_label"),
  v.literal("orange_book"),
  v.literal("purple_book"),
  v.literal("ndc"),
  v.literal("ema_central"),
  v.literal("eu_national_bfarm")
);

const CANONICAL_PRODUCT_STATUS_VALIDATOR = v.union(
  v.literal("active"),
  v.literal("withdrawn"),
  v.literal("discontinued"),
  v.literal("under_review"),
  v.literal("unavailable")
);

const PRODUCT_APPLICATION_TYPE_VALIDATOR = v.union(
  v.literal("NDA"),
  v.literal("ANDA"),
  v.literal("BLA"),
  v.literal("CAP"),
  v.literal("national")
);

const CANONICAL_PRODUCT_TYPE_VALIDATOR = v.union(
  v.literal("small_molecule"),
  v.literal("biologic"),
  v.literal("biosimilar"),
  v.literal("generic"),
  v.literal("unknown")
);

const CANONICAL_PRODUCT_LINK_RELATIONSHIP_VALIDATOR = v.union(
  v.literal("same_product"),
  v.literal("presentation_variant"),
  v.literal("biosimilar_of"),
  v.literal("reference_product"),
  v.literal("regional_variant")
);

const CANONICAL_ENTITY_ROLE_VALIDATOR = v.union(
  v.literal("manufacturer"),
  v.literal("mah"),
  v.literal("applicant"),
  v.literal("licensor")
);

const EVIDENCE_CONFIDENCE_VALIDATOR = v.union(
  v.literal("confirmed"),
  v.literal("likely"),
  v.literal("inferred")
);

function matchesSearch(product: Doc<"canonicalProducts">, search?: string) {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    product.brandName.toLowerCase().includes(term) ||
    product.inn.toLowerCase().includes(term) ||
    (product.primaryManufacturerName?.toLowerCase().includes(term) ?? false) ||
    (product.primaryMahName?.toLowerCase().includes(term) ?? false)
  );
}

export const listAllProductSources = query({
  args: {},
  handler: async (ctx) => ctx.db.query("productSources").collect(),
});

export const listProductSourcesPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) =>
    await ctx.db.query("productSources").paginate(paginationOpts),
});

export const syncStats = query({
  args: {},
  handler: async (ctx) => {
    const [sourceRows, canonicalProducts] = await Promise.all([
      ctx.db.query("productSources").collect(),
      ctx.db.query("canonicalProducts").collect(),
    ]);

    const bySystem = new Map<string, number>();
    for (const row of sourceRows) {
      bySystem.set(row.sourceSystem, (bySystem.get(row.sourceSystem) ?? 0) + 1);
    }

    return {
      sourceCount: sourceRows.length,
      canonicalCount: canonicalProducts.length,
      bySystem: [...bySystem.entries()].map(([sourceSystem, count]) => ({
        sourceSystem,
        count,
      })),
      lastUpdatedAt: sourceRows.reduce<number | undefined>((current, row) => {
        if (!row.updatedAt) return current;
        if (current === undefined || row.updatedAt > current) return row.updatedAt;
        return current;
      }, undefined),
    };
  },
});

export const listCanonicalProducts = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    geography: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea, geography }) => {
    const rows = await ctx.db.query("canonicalProducts").collect();
    return rows
      .filter((row) => matchesSearch(row, search))
      .filter((row) => !therapeuticArea || row.therapeuticArea === therapeuticArea)
      .filter((row) => !geography || row.geographies.includes(geography))
      .sort((left, right) => left.brandName.localeCompare(right.brandName))
      .map((row) => ({
        ...row,
        sourceBadges: summarizeSourceSystems(row.sourceSystems),
      }));
  },
});

export const listCanonicalInnDirectory = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = await ctx.db.query("canonicalProducts").collect();
    const filtered = rows
      .filter((row) => matchesSearch(row, search))
      .filter((row) => !therapeuticArea || row.therapeuticArea === therapeuticArea);

    const groups = new Map<
      string,
      {
        genericName: string;
        manufacturers: Array<{
          name: string;
        }>;
        brandProducts: Array<{
          canonicalProductId: Id<"canonicalProducts">;
          name: string;
          primaryManufacturerName?: string;
          status: Doc<"canonicalProducts">["status"];
          applicationTypeSummary?: string;
        }>;
        therapeuticAreas: Set<string>;
        sourceSystems: Set<string>;
      }
    >();

    for (const row of filtered) {
      const key = row.inn.trim().toLowerCase();
      const current =
        groups.get(key) ??
        {
          genericName: row.inn,
          manufacturers: [],
          brandProducts: [],
          therapeuticAreas: new Set<string>(),
          sourceSystems: new Set<string>(),
        };

      if (
        row.primaryManufacturerName &&
        !current.manufacturers.some(
          (manufacturer) =>
            manufacturer.name.toLowerCase() === row.primaryManufacturerName?.toLowerCase()
        )
      ) {
        current.manufacturers.push({ name: row.primaryManufacturerName });
      }

      current.brandProducts.push({
        canonicalProductId: row._id,
        name: row.brandName,
        primaryManufacturerName: row.primaryManufacturerName,
        status: row.status,
        applicationTypeSummary: row.applicationTypeSummary,
      });

      if (row.therapeuticArea) current.therapeuticAreas.add(row.therapeuticArea);
      for (const sourceSystem of row.sourceSystems) {
        current.sourceSystems.add(sourceSystem);
      }

      groups.set(key, current);
    }

    return [...groups.values()]
      .map((group) => ({
        genericName: group.genericName,
        manufacturerCount: group.manufacturers.length,
        manufacturers: group.manufacturers.sort((left, right) =>
          left.name.localeCompare(right.name)
        ),
        brandProducts: group.brandProducts.sort((left, right) =>
          left.name.localeCompare(right.name)
        ),
        therapeuticAreas: [...group.therapeuticAreas].sort(),
        sourceBadges: summarizeSourceSystems(
          [...group.sourceSystems] as Array<Doc<"canonicalProducts">["sourceSystems"][number]>
        ),
      }))
      .sort((left, right) => left.genericName.localeCompare(right.genericName));
  },
});

export const getCanonicalProduct = query({
  args: { id: v.id("canonicalProducts") },
  handler: async (ctx, { id }) => {
    const product = await ctx.db.get(id);
    if (!product) return null;

    const [links, entities, linkedDrugs, allProducts] = await Promise.all([
      ctx.db
        .query("canonicalProductLinks")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", id))
        .collect(),
      ctx.db
        .query("canonicalProductEntities")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", id))
        .collect(),
      ctx.db
        .query("drugs")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", id))
        .collect(),
      ctx.db.query("canonicalProducts").collect(),
    ]);

    const sourceRows = await Promise.all(
      links.map(async (link) => {
        const source = await ctx.db.get(link.productSourceId);
        return source ? { ...source, relationshipType: link.relationshipType, confidence: link.confidence } : null;
      })
    );

    const relatedByInn = allProducts.filter(
      (candidate) =>
        candidate._id !== product._id &&
        candidate.normalizedInn &&
        candidate.normalizedInn === product.normalizedInn
    );

    const referenceProduct = product.referenceCanonicalProductId
      ? await ctx.db.get(product.referenceCanonicalProductId)
      : null;
    const biosimilars = allProducts.filter(
      (candidate) => candidate.referenceCanonicalProductId === product._id
    );

    return {
      ...product,
      sourceBadges: summarizeSourceSystems(product.sourceSystems),
      sources: sourceRows.filter((row): row is NonNullable<typeof row> => !!row),
      entities: entities.sort((left, right) => {
        if (left.role === right.role) return left.entityName.localeCompare(right.entityName);
        return left.role.localeCompare(right.role);
      }),
      linkedDrugs: linkedDrugs.sort((left, right) => left.name.localeCompare(right.name)),
      relatedByInn: relatedByInn.sort((left, right) => left.brandName.localeCompare(right.brandName)),
      referenceProduct,
      biosimilars: biosimilars.sort((left, right) => left.brandName.localeCompare(right.brandName)),
    };
  },
});

export const listCanonicalProductsByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const entityRows = await ctx.db
      .query("canonicalProductEntities")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    const canonicalProductIds = [...new Set(entityRows.map((row) => row.canonicalProductId))];
    const products = await Promise.all(
      canonicalProductIds.map(async (id) => await ctx.db.get(id))
    );

    return products
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .sort((left, right) => left.brandName.localeCompare(right.brandName))
      .map((product) => ({
        _id: product._id,
        brandName: product.brandName,
        inn: product.inn,
        therapeuticArea: product.therapeuticArea,
      }));
  },
});

export const getCanonicalInnManufacturers = query({
  args: { genericName: v.string() },
  handler: async (ctx, { genericName }) => {
    const rows = await ctx.db.query("canonicalProducts").collect();
    const matches = rows
      .filter((row) => row.inn.trim().toLowerCase() === genericName.trim().toLowerCase())
      .sort((left, right) => left.brandName.localeCompare(right.brandName));

    const manufacturers = new Map<
      string,
      {
        name: string;
        brandNames: string[];
      }
    >();

    for (const row of matches) {
      const manufacturerName = row.primaryManufacturerName ?? row.primaryMahName ?? row.primaryApplicantName;
      if (!manufacturerName) continue;
      const key = manufacturerName.toLowerCase();
      const current = manufacturers.get(key) ?? {
        name: manufacturerName,
        brandNames: [],
      };
      if (!current.brandNames.includes(row.brandName)) {
        current.brandNames.push(row.brandName);
      }
      manufacturers.set(key, current);
    }

    return {
      genericName,
      manufacturers: [...manufacturers.values()].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
      brandProducts: matches.map((row) => ({
        canonicalProductId: row._id,
        name: row.brandName,
        primaryManufacturerName: row.primaryManufacturerName,
        primaryMahName: row.primaryMahName,
        therapeuticArea: row.therapeuticArea,
        status: row.status,
        sourceBadges: summarizeSourceSystems(row.sourceSystems),
      })),
    };
  },
});

export const upsertProductSource = mutation({
  args: {
    sourceSystem: PRODUCT_SOURCE_SYSTEM_VALIDATOR,
    sourceRecordId: v.string(),
    sourceUrl: v.optional(v.string()),
    sourceStatus: CANONICAL_PRODUCT_STATUS_VALIDATOR,
    geography: v.string(),
    sourceUpdatedAt: v.optional(v.number()),
    sourceSnapshot: v.optional(v.string()),
    brandName: v.optional(v.string()),
    inn: v.optional(v.string()),
    activeIngredient: v.optional(v.string()),
    strength: v.optional(v.string()),
    dosageForm: v.optional(v.string()),
    route: v.optional(v.string()),
    atcCode: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    applicationType: v.optional(PRODUCT_APPLICATION_TYPE_VALIDATOR),
    applicantName: v.optional(v.string()),
    mahName: v.optional(v.string()),
    manufacturerName: v.optional(v.string()),
    approvalDate: v.optional(v.string()),
    productType: v.optional(CANONICAL_PRODUCT_TYPE_VALIDATOR),
    referenceProductSourceRecordId: v.optional(v.string()),
    patentsSummary: v.optional(v.string()),
    exclusivitiesSummary: v.optional(v.string()),
    packageSummary: v.optional(v.string()),
    interchangeability: v.optional(v.string()),
    rawSourceUpdatedLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("productSources")
      .withIndex("by_source_system_and_source_record_id", (q) =>
        q.eq("sourceSystem", args.sourceSystem).eq("sourceRecordId", args.sourceRecordId)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("productSources", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const replaceCanonicalGraph = mutation({
  args: {
    products: v.array(
      v.object({
        canonicalKey: v.string(),
        normalizedBrandName: v.optional(v.string()),
        normalizedInn: v.optional(v.string()),
        brandName: v.string(),
        inn: v.string(),
        activeIngredient: v.optional(v.string()),
        strength: v.optional(v.string()),
        dosageForm: v.optional(v.string()),
        route: v.optional(v.string()),
        atcCode: v.optional(v.string()),
        therapeuticArea: v.optional(v.string()),
        applicationTypes: v.optional(v.array(PRODUCT_APPLICATION_TYPE_VALIDATOR)),
        applicationTypeSummary: v.optional(v.string()),
        status: CANONICAL_PRODUCT_STATUS_VALIDATOR,
        productType: CANONICAL_PRODUCT_TYPE_VALIDATOR,
        geographies: v.array(v.string()),
        primaryManufacturerName: v.optional(v.string()),
        primaryMahName: v.optional(v.string()),
        primaryApplicantName: v.optional(v.string()),
        approvalDate: v.optional(v.string()),
        sourceSystems: v.array(PRODUCT_SOURCE_SYSTEM_VALIDATOR),
        matchConfidence: EVIDENCE_CONFIDENCE_VALIDATOR,
        reviewNeeded: v.optional(v.boolean()),
        referenceCanonicalKey: v.optional(v.string()),
      })
    ),
    sourceLinks: v.array(
      v.object({
        canonicalKey: v.string(),
        productSourceId: v.id("productSources"),
        relationshipType: CANONICAL_PRODUCT_LINK_RELATIONSHIP_VALIDATOR,
        confidence: EVIDENCE_CONFIDENCE_VALIDATOR,
        reviewNeeded: v.optional(v.boolean()),
      })
    ),
    entities: v.array(
      v.object({
        canonicalKey: v.string(),
        companyId: v.optional(v.id("companies")),
        entityName: v.string(),
        normalizedEntityName: v.string(),
        role: CANONICAL_ENTITY_ROLE_VALIDATOR,
        isPrimary: v.boolean(),
        geography: v.optional(v.string()),
        sourceSystem: PRODUCT_SOURCE_SYSTEM_VALIDATOR,
        confidence: EVIDENCE_CONFIDENCE_VALIDATOR,
      })
    ),
    drugLinks: v.array(
      v.object({
        drugId: v.id("drugs"),
        canonicalKey: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { products, sourceLinks, entities, drugLinks }) => {
    const now = Date.now();

    for (const row of await ctx.db.query("canonicalProductLinks").collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("canonicalProductEntities").collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("canonicalProducts").collect()) {
      await ctx.db.delete(row._id);
    }

    const canonicalIdByKey = new Map<string, Id<"canonicalProducts">>();
    for (const product of products) {
      const canonicalProductId = await ctx.db.insert("canonicalProducts", {
        canonicalKey: product.canonicalKey,
        normalizedBrandName: product.normalizedBrandName,
        normalizedInn: product.normalizedInn,
        brandName: product.brandName,
        inn: product.inn,
        activeIngredient: product.activeIngredient,
        strength: product.strength,
        dosageForm: product.dosageForm,
        route: product.route,
        atcCode: product.atcCode,
        therapeuticArea: product.therapeuticArea,
        applicationTypes: product.applicationTypes,
        applicationTypeSummary: product.applicationTypeSummary,
        status: product.status,
        productType: product.productType,
        geographies: product.geographies,
        primaryManufacturerName: product.primaryManufacturerName,
        primaryMahName: product.primaryMahName,
        primaryApplicantName: product.primaryApplicantName,
        approvalDate: product.approvalDate,
        sourceSystems: product.sourceSystems,
        matchConfidence: product.matchConfidence,
        reviewNeeded: product.reviewNeeded,
        createdAt: now,
        updatedAt: now,
      });
      canonicalIdByKey.set(product.canonicalKey, canonicalProductId);
    }

    for (const product of products) {
      if (!product.referenceCanonicalKey) continue;
      const canonicalProductId = canonicalIdByKey.get(product.canonicalKey);
      const referenceCanonicalProductId = canonicalIdByKey.get(product.referenceCanonicalKey);
      if (!canonicalProductId || !referenceCanonicalProductId) continue;
      await ctx.db.patch(canonicalProductId, {
        referenceCanonicalProductId,
      });
    }

    for (const link of sourceLinks) {
      const canonicalProductId = canonicalIdByKey.get(link.canonicalKey);
      if (!canonicalProductId) continue;
      await ctx.db.insert("canonicalProductLinks", {
        canonicalProductId,
        productSourceId: link.productSourceId,
        relationshipType: link.relationshipType,
        confidence: link.confidence,
        reviewNeeded: link.reviewNeeded,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const entity of entities) {
      const canonicalProductId = canonicalIdByKey.get(entity.canonicalKey);
      if (!canonicalProductId) continue;
      await ctx.db.insert("canonicalProductEntities", {
        canonicalProductId,
        companyId: entity.companyId,
        entityName: entity.entityName,
        normalizedEntityName: entity.normalizedEntityName,
        role: entity.role,
        isPrimary: entity.isPrimary,
        geography: entity.geography,
        sourceSystem: entity.sourceSystem,
        confidence: entity.confidence,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const link of drugLinks) {
      const existingDrug = await ctx.db.get(link.drugId);
      if (!existingDrug) continue;
      const nextCanonicalProductId = link.canonicalKey
        ? canonicalIdByKey.get(link.canonicalKey)
        : undefined;
      if (nextCanonicalProductId) {
        await ctx.db.patch(link.drugId, {
          canonicalProductId: nextCanonicalProductId,
        });
        continue;
      }
      const replacement = { ...existingDrug };
      delete replacement.canonicalProductId;
      await ctx.db.replace(link.drugId, replacement);
    }

    return {
      canonicalProductsCreated: products.length,
      sourceLinksCreated: sourceLinks.length,
      entitiesCreated: entities.length,
      drugsLinked: drugLinks.filter((link) => !!link.canonicalKey).length,
    };
  },
});

const CANONICAL_GRAPH_TABLE_VALIDATOR = v.union(
  v.literal("canonicalProductLinks"),
  v.literal("canonicalProductEntities"),
  v.literal("canonicalProducts")
);

export const clearCanonicalGraphBatch = internalMutation({
  args: {
    table: CANONICAL_GRAPH_TABLE_VALIDATOR,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { table, limit = 100 }) => {
    const rows = await ctx.db.query(table).take(limit);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return {
      deleted: rows.length,
      done: rows.length < limit,
    };
  },
});

export const insertCanonicalProductsBatch = internalMutation({
  args: {
    products: v.array(
      v.object({
        canonicalKey: v.string(),
        normalizedBrandName: v.optional(v.string()),
        normalizedInn: v.optional(v.string()),
        brandName: v.string(),
        inn: v.string(),
        activeIngredient: v.optional(v.string()),
        strength: v.optional(v.string()),
        dosageForm: v.optional(v.string()),
        route: v.optional(v.string()),
        atcCode: v.optional(v.string()),
        therapeuticArea: v.optional(v.string()),
        applicationTypes: v.optional(v.array(PRODUCT_APPLICATION_TYPE_VALIDATOR)),
        applicationTypeSummary: v.optional(v.string()),
        status: CANONICAL_PRODUCT_STATUS_VALIDATOR,
        productType: CANONICAL_PRODUCT_TYPE_VALIDATOR,
        geographies: v.array(v.string()),
        primaryManufacturerName: v.optional(v.string()),
        primaryMahName: v.optional(v.string()),
        primaryApplicantName: v.optional(v.string()),
        approvalDate: v.optional(v.string()),
        sourceSystems: v.array(PRODUCT_SOURCE_SYSTEM_VALIDATOR),
        matchConfidence: EVIDENCE_CONFIDENCE_VALIDATOR,
        reviewNeeded: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, { products }) => {
    const now = Date.now();
    const inserted: Array<{ canonicalKey: string; canonicalProductId: Id<"canonicalProducts"> }> = [];
    for (const product of products) {
      const canonicalProductId = await ctx.db.insert("canonicalProducts", {
        ...product,
        createdAt: now,
        updatedAt: now,
      });
      inserted.push({ canonicalKey: product.canonicalKey, canonicalProductId });
    }
    return inserted;
  },
});

export const patchCanonicalProductReferencesBatch = internalMutation({
  args: {
    references: v.array(
      v.object({
        canonicalProductId: v.id("canonicalProducts"),
        referenceCanonicalProductId: v.id("canonicalProducts"),
      })
    ),
  },
  handler: async (ctx, { references }) => {
    for (const reference of references) {
      await ctx.db.patch(reference.canonicalProductId, {
        referenceCanonicalProductId: reference.referenceCanonicalProductId,
        updatedAt: Date.now(),
      });
    }
    return { updated: references.length };
  },
});

export const insertCanonicalSourceLinksBatch = internalMutation({
  args: {
    sourceLinks: v.array(
      v.object({
        canonicalProductId: v.id("canonicalProducts"),
        productSourceId: v.id("productSources"),
        relationshipType: CANONICAL_PRODUCT_LINK_RELATIONSHIP_VALIDATOR,
        confidence: EVIDENCE_CONFIDENCE_VALIDATOR,
        reviewNeeded: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, { sourceLinks }) => {
    const now = Date.now();
    for (const link of sourceLinks) {
      await ctx.db.insert("canonicalProductLinks", {
        ...link,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { inserted: sourceLinks.length };
  },
});

export const insertCanonicalEntitiesBatch = internalMutation({
  args: {
    entities: v.array(
      v.object({
        canonicalProductId: v.id("canonicalProducts"),
        companyId: v.optional(v.id("companies")),
        entityName: v.string(),
        normalizedEntityName: v.string(),
        role: CANONICAL_ENTITY_ROLE_VALIDATOR,
        isPrimary: v.boolean(),
        geography: v.optional(v.string()),
        sourceSystem: PRODUCT_SOURCE_SYSTEM_VALIDATOR,
        confidence: EVIDENCE_CONFIDENCE_VALIDATOR,
      })
    ),
  },
  handler: async (ctx, { entities }) => {
    const now = Date.now();
    for (const entity of entities) {
      await ctx.db.insert("canonicalProductEntities", {
        ...entity,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { inserted: entities.length };
  },
});

export const relinkDrugsBatch = internalMutation({
  args: {
    drugLinks: v.array(
      v.object({
        drugId: v.id("drugs"),
        canonicalProductId: v.optional(v.id("canonicalProducts")),
      })
    ),
  },
  handler: async (ctx, { drugLinks }) => {
    let linked = 0;
    let unlinked = 0;
    for (const link of drugLinks) {
      const existingDrug = await ctx.db.get(link.drugId);
      if (!existingDrug) continue;
      if (link.canonicalProductId) {
        await ctx.db.patch(link.drugId, {
          canonicalProductId: link.canonicalProductId,
        });
        linked += 1;
        continue;
      }
      if (existingDrug.canonicalProductId === undefined) continue;
      const replacement = { ...existingDrug };
      delete replacement.canonicalProductId;
      await ctx.db.replace(link.drugId, replacement);
      unlinked += 1;
    }
    return { linked, unlinked };
  },
});
