import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { normalizeDrugEntityLinks } from "./drugEntityLinkUtils";

const PRODUCT_SOURCE_REGION_VALIDATOR = v.union(
  v.literal("eu"),
  v.literal("us"),
  v.literal("mena"),
  v.literal("other")
);

const PRODUCT_PROFILE_VALIDATOR = v.object({
  strength: v.optional(v.string()),
  dosageForm: v.optional(v.string()),
  route: v.optional(v.string()),
  productFamily: v.optional(v.string()),
  canonicalKey: v.optional(v.string()),
  sourceRegions: v.optional(v.array(PRODUCT_SOURCE_REGION_VALIDATOR)),
  ownershipConfidence: v.optional(
    v.union(v.literal("confirmed"), v.literal("likely"), v.literal("uncertain"))
  ),
});

const PRODUCT_IDENTITY_EVIDENCE_VALIDATOR = v.object({
  claim: v.string(),
  sourceKind: v.union(
    v.literal("official_registry"),
    v.literal("regulator"),
    v.literal("company"),
    v.literal("market_report"),
    v.literal("internal")
  ),
  title: v.optional(v.string()),
  url: v.optional(v.string()),
  confidence: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("inferred")
  ),
});

function getLinkDisplayName(
  link: {
    entityName?: string;
    company?: { name: string } | null;
  },
) {
  return link.company?.name ?? link.entityName ?? undefined;
}

function getManufacturerNames(
  linkedCompanies: Array<{
    link: Doc<"drugEntityLinks">;
    company: Doc<"companies"> | null;
  }>,
  drug: Doc<"drugs">,
  company: Doc<"companies"> | null,
) {
  const manufacturers = linkedCompanies
    .filter(({ link }) => link.relationshipType === "manufacturer")
    .map(({ link, company }) =>
      getLinkDisplayName({ entityName: link.entityName, company })
    )
    .filter((value): value is string => !!value);

  if (manufacturers.length > 0) {
    return manufacturers;
  }

  const fallback = [
    drug.primaryManufacturerName,
    drug.manufacturerName,
    company?.name,
  ].filter((value): value is string => !!value);

  return [...new Set(fallback)];
}

function getPrimaryManufacturerName(
  linkedCompanies: Array<{
    link: Doc<"drugEntityLinks">;
    company: Doc<"companies"> | null;
  }>,
  drug: Doc<"drugs">,
  company: Doc<"companies"> | null,
) {
  const primaryManufacturer =
    linkedCompanies.find(
      ({ link }) => link.relationshipType === "manufacturer" && link.isPrimary
    ) ??
    linkedCompanies.find(({ link }) => link.relationshipType === "manufacturer");

  return (
    (primaryManufacturer
      ? getLinkDisplayName({
          entityName: primaryManufacturer.link.entityName,
          company: primaryManufacturer.company,
        })
      : undefined) ??
    drug.primaryManufacturerName ??
    drug.manufacturerName ??
    company?.name ??
    "—"
  );
}

function getPrimaryManufacturerCompany(
  linkedCompanies: Array<{
    link: Doc<"drugEntityLinks">;
    company: Doc<"companies"> | null;
  }>,
  company: Doc<"companies"> | null,
) {
  const primaryManufacturer =
    linkedCompanies.find(
      ({ link, company }) =>
        link.relationshipType === "manufacturer" && link.isPrimary && company
    ) ??
    linkedCompanies.find(
      ({ link, company }) => link.relationshipType === "manufacturer" && company
    );

  return primaryManufacturer?.company ?? company ?? null;
}

async function buildEnrichedDrug(ctx: QueryCtx, d: Doc<"drugs">) {
  const company = d.companyId ? await ctx.db.get(d.companyId) : null;
  const entityLinks = await ctx.db
    .query("drugEntityLinks")
    .withIndex("by_drug", (q) => q.eq("drugId", d._id))
    .collect();
  const linkedCompanies = await Promise.all(
    entityLinks.map(async (link) => ({
      link,
      company: link.companyId ? await ctx.db.get(link.companyId) : null,
    }))
  );
  const primaryMah =
    linkedCompanies.find(
      ({ link }) =>
        link.relationshipType === "market_authorization_holder" && link.isPrimary
    ) ??
    linkedCompanies.find(
      ({ link }) => link.relationshipType === "market_authorization_holder"
    );

  const manufacturerNames = getManufacturerNames(linkedCompanies, d, company);
  const primaryManufacturerName = getPrimaryManufacturerName(
    linkedCompanies,
    d,
    company
  );
  const primaryManufacturerCompany = getPrimaryManufacturerCompany(
    linkedCompanies,
    company
  );

  return {
    ...d,
    companyName: company?.name ?? d.manufacturerName ?? "—",
    primaryManufacturerName,
    primaryManufacturerCompanyId: primaryManufacturerCompany?._id,
    primaryManufacturerCompanyName: primaryManufacturerCompany?.name,
    manufacturerNames,
    primaryMarketAuthorizationHolderName:
      primaryMah?.company?.name ??
      primaryMah?.link.entityName ??
      d.primaryMarketAuthorizationHolderName ??
      "—",
    entityRelationships: linkedCompanies.map(({ link, company: linkedCompany }) => ({
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      companyId: link.companyId,
      companyName: linkedCompany?.name,
      entityName: link.entityName,
    })),
  };
}

function matchesDrugSearch(drug: Doc<"drugs">, search?: string) {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    drug.name.toLowerCase().includes(term) ||
    drug.genericName.toLowerCase().includes(term) ||
    drug.indication.toLowerCase().includes(term)
  );
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = therapeuticArea
      ? await ctx.db
          .query("drugs")
          .withIndex("by_therapeutic_area", (q) =>
            q.eq("therapeuticArea", therapeuticArea)
          )
          .collect()
      : await ctx.db.query("drugs").collect();

    if (!search) return rows;
    const term = search.toLowerCase();
    return rows.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.genericName.toLowerCase().includes(term) ||
        d.indication.toLowerCase().includes(term)
    );
  },
});

export const listMatchingOptions = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { search, limit }) => {
    const rows = await ctx.db.query("drugs").collect();
    const filtered = rows
      .filter((drug) => matchesDrugSearch(drug, search))
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit ?? 250);

    return filtered.map((drug) => ({
      _id: drug._id,
      name: drug.name,
      genericName: drug.genericName,
      category: drug.category,
    }));
  },
});

export const listEnriched = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = therapeuticArea
      ? await ctx.db
          .query("drugs")
          .withIndex("by_therapeutic_area", (q) =>
            q.eq("therapeuticArea", therapeuticArea)
          )
          .collect()
      : await ctx.db.query("drugs").collect();

    const filtered = rows.filter((d) => matchesDrugSearch(d, search));

    return Promise.all(filtered.map(async (d) => buildEnrichedDrug(ctx, d)));
  },
});

export const listMedicalDevicesEnriched = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = therapeuticArea
      ? await ctx.db
          .query("drugs")
          .withIndex("by_therapeutic_area", (q) =>
            q.eq("therapeuticArea", therapeuticArea)
          )
          .collect()
      : await ctx.db.query("drugs").collect();

    const filtered = rows.filter(
      (drug) =>
        ["medical device", "diagnostic"].includes(
          drug.category?.trim().toLowerCase() ?? ""
        ) && matchesDrugSearch(drug, search)
    );

    return Promise.all(filtered.map(async (drug) => buildEnrichedDrug(ctx, drug)));
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const direct = await ctx.db
      .query("drugs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    const linked = await ctx.runQuery(api.drugEntityLinks.listByCompany, { companyId });

    const byDrugId = new Map(direct.map((drug) => [drug._id, drug]));
    for (const entry of linked) {
      if (entry.drug) {
        byDrugId.set(entry.drug._id, entry.drug);
      }
    }

    const enriched = await Promise.all(
      [...byDrugId.values()].map(async (drug) => buildEnrichedDrug(ctx, drug))
    );

    return enriched.sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const listInnDirectory = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = therapeuticArea
      ? await ctx.db
          .query("drugs")
          .withIndex("by_therapeutic_area", (q) =>
            q.eq("therapeuticArea", therapeuticArea)
          )
          .collect()
      : await ctx.db.query("drugs").collect();

    const filtered = rows.filter((d) => matchesDrugSearch(d, search));
    const enriched = await Promise.all(filtered.map(async (d) => buildEnrichedDrug(ctx, d)));
    const groups = new Map<
      string,
      {
        genericName: string;
        manufacturers: Array<{
          companyId?: Doc<"companies">["_id"];
          name: string;
          country?: string;
        }>;
        brandProducts: Array<{
          drugId: Doc<"drugs">["_id"];
          name: string;
          primaryManufacturerName: string;
          primaryManufacturerCompanyId?: Doc<"companies">["_id"];
          therapeuticArea: string;
          approvalStatus: Doc<"drugs">["approvalStatus"];
        }>;
        therapeuticAreas: Set<string>;
      }
    >();

    for (const drug of enriched) {
      const key = drug.genericName.trim().toLowerCase();
      const existing =
        groups.get(key) ??
        {
          genericName: drug.genericName,
          manufacturers: [],
          brandProducts: [],
          therapeuticAreas: new Set<string>(),
        };

      for (const relationship of drug.entityRelationships) {
        if (relationship.relationshipType !== "manufacturer") continue;
        const manufacturerName = relationship.companyName ?? relationship.entityName;
        if (!manufacturerName) continue;

        const duplicate = existing.manufacturers.some(
          (manufacturer) =>
            (relationship.companyId && manufacturer.companyId === relationship.companyId) ||
            manufacturer.name.toLowerCase() === manufacturerName.toLowerCase()
        );

        if (!duplicate) {
          existing.manufacturers.push({
            companyId: relationship.companyId,
            name: manufacturerName,
          });
        }
      }

      if (
        existing.manufacturers.length === 0 &&
        drug.primaryManufacturerName &&
        !existing.manufacturers.some(
          (manufacturer) =>
            manufacturer.name.toLowerCase() === drug.primaryManufacturerName.toLowerCase()
        )
      ) {
        existing.manufacturers.push({
          companyId: drug.primaryManufacturerCompanyId,
          name: drug.primaryManufacturerName,
        });
      }

      existing.brandProducts.push({
        drugId: drug._id,
        name: drug.name,
        primaryManufacturerName: drug.primaryManufacturerName,
        primaryManufacturerCompanyId: drug.primaryManufacturerCompanyId,
        therapeuticArea: drug.therapeuticArea,
        approvalStatus: drug.approvalStatus,
      });
      existing.therapeuticAreas.add(drug.therapeuticArea);
      groups.set(key, existing);
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
      }))
      .sort((left, right) => left.genericName.localeCompare(right.genericName));
  },
});

export const getInnManufacturers = query({
  args: { genericName: v.string() },
  handler: async (ctx, { genericName }) => {
    const rows = await ctx.db.query("drugs").collect();
    const matches = rows.filter(
      (drug) => drug.genericName.trim().toLowerCase() === genericName.trim().toLowerCase()
    );
    const enriched = await Promise.all(matches.map(async (d) => buildEnrichedDrug(ctx, d)));

    const manufacturers: Array<{
      companyId?: Doc<"companies">["_id"];
      name: string;
      brandNames: string[];
    }> = [];

    for (const drug of enriched) {
      const manufacturerRelationships = drug.entityRelationships.filter(
        (relationship) => relationship.relationshipType === "manufacturer"
      );

      if (manufacturerRelationships.length === 0 && drug.primaryManufacturerName) {
        const existing = manufacturers.find(
          (manufacturer) =>
            (drug.primaryManufacturerCompanyId &&
              manufacturer.companyId === drug.primaryManufacturerCompanyId) ||
            manufacturer.name.toLowerCase() === drug.primaryManufacturerName.toLowerCase()
        );

        if (existing) {
          if (!existing.brandNames.includes(drug.name)) {
            existing.brandNames.push(drug.name);
          }
        } else {
          manufacturers.push({
            companyId: drug.primaryManufacturerCompanyId,
            name: drug.primaryManufacturerName,
            brandNames: [drug.name],
          });
        }
        continue;
      }

      for (const relationship of manufacturerRelationships) {
        const manufacturerName = relationship.companyName ?? relationship.entityName;
        if (!manufacturerName) continue;

        const existing = manufacturers.find(
          (manufacturer) =>
            (relationship.companyId && manufacturer.companyId === relationship.companyId) ||
            manufacturer.name.toLowerCase() === manufacturerName.toLowerCase()
        );

        if (existing) {
          if (!existing.brandNames.includes(drug.name)) {
            existing.brandNames.push(drug.name);
          }
        } else {
          manufacturers.push({
            companyId: relationship.companyId,
            name: manufacturerName,
            brandNames: [drug.name],
          });
        }
      }
    }

    return {
      genericName,
      manufacturers: manufacturers
        .map((manufacturer) => ({
          ...manufacturer,
          brandNames: manufacturer.brandNames.sort(),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      brandProducts: enriched
        .map((drug) => ({
          drugId: drug._id,
          name: drug.name,
          primaryManufacturerName: drug.primaryManufacturerName,
          primaryManufacturerCompanyId: drug.primaryManufacturerCompanyId,
          therapeuticArea: drug.therapeuticArea,
          approvalStatus: drug.approvalStatus,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  },
});

export const get = query({
  args: { id: v.id("drugs") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    companyId: v.optional(v.id("companies")),
    manufacturerName: v.optional(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMarketAuthorizationHolderName: v.optional(v.string()),
    name: v.string(),
    genericName: v.string(),
    therapeuticArea: v.string(),
    indication: v.string(),
    mechanism: v.optional(v.string()),
    productProfile: v.optional(PRODUCT_PROFILE_VALIDATOR),
    identityEvidenceItems: v.optional(v.array(PRODUCT_IDENTITY_EVIDENCE_VALIDATOR)),
    approvalStatus: v.union(
      v.literal("approved"),
      v.literal("pending"),
      v.literal("withdrawn")
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("drugs", { ...args, status: "active" }),
});

export const createWithEntities = mutation({
  args: {
    companyId: v.optional(v.id("companies")),
    manufacturerName: v.optional(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMarketAuthorizationHolderName: v.optional(v.string()),
    name: v.string(),
    genericName: v.string(),
    therapeuticArea: v.string(),
    indication: v.string(),
    mechanism: v.optional(v.string()),
    productProfile: v.optional(PRODUCT_PROFILE_VALIDATOR),
    identityEvidenceItems: v.optional(v.array(PRODUCT_IDENTITY_EVIDENCE_VALIDATOR)),
    approvalStatus: v.union(
      v.literal("approved"),
      v.literal("pending"),
      v.literal("withdrawn")
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
    entityLinks: v.optional(
      v.array(
        v.object({
          companyId: v.optional(v.id("companies")),
          entityName: v.optional(v.string()),
          relationshipType: v.union(
            v.literal("manufacturer"),
            v.literal("market_authorization_holder"),
            v.literal("licensor"),
            v.literal("regional_partner"),
            v.literal("distributor")
          ),
          jurisdiction: v.optional(v.string()),
          isPrimary: v.boolean(),
          notes: v.optional(v.string()),
          source: v.optional(v.string()),
          url: v.optional(v.string()),
          confidence: v.union(
            v.literal("confirmed"),
            v.literal("likely"),
            v.literal("inferred")
          ),
        })
      )
    ),
  },
  handler: async (ctx, { entityLinks, ...args }) => {
    const links = normalizeDrugEntityLinks([
      ...(entityLinks ?? []),
      ...(args.companyId
        ? [
            {
              companyId: args.companyId,
              relationshipType: "manufacturer" as const,
              isPrimary: true,
              confidence: "confirmed" as const,
            },
          ]
        : []),
      ...(args.primaryManufacturerName && !args.companyId
        ? [
            {
              entityName: args.primaryManufacturerName,
              relationshipType: "manufacturer" as const,
              isPrimary: true,
              confidence: "likely" as const,
            },
          ]
        : []),
      ...(args.primaryMarketAuthorizationHolderName
        ? [
            {
              entityName: args.primaryMarketAuthorizationHolderName,
              relationshipType: "market_authorization_holder" as const,
              isPrimary: true,
              confidence: "likely" as const,
            },
          ]
        : []),
    ]);

    const primaryManufacturerName =
      links.find(
        (link) => link.relationshipType === "manufacturer" && link.isPrimary
      )?.entityName ??
      args.primaryManufacturerName ??
      args.manufacturerName;

    const manufacturerName =
      args.manufacturerName ??
      (!args.companyId ? primaryManufacturerName : undefined);

    const drugId = await ctx.db.insert("drugs", {
      ...args,
      manufacturerName,
      primaryManufacturerName,
      status: "active",
    });

    if (links.length > 0) {
      await ctx.runMutation(api.drugEntityLinks.replaceForDrug, {
        drugId,
        links,
      });
    }

    return drugId;
  },
});

export const update = mutation({
  args: {
    id: v.id("drugs"),
    name: v.optional(v.string()),
    genericName: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    indication: v.optional(v.string()),
    mechanism: v.optional(v.string()),
    productProfile: v.optional(PRODUCT_PROFILE_VALIDATOR),
    identityEvidenceItems: v.optional(v.array(PRODUCT_IDENTITY_EVIDENCE_VALIDATOR)),
    approvalStatus: v.optional(
      v.union(
        v.literal("approved"),
        v.literal("pending"),
        v.literal("withdrawn")
      )
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    manufacturerName: v.optional(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMarketAuthorizationHolderName: v.optional(v.string()),
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const updateWithEntities = mutation({
  args: {
    id: v.id("drugs"),
    name: v.optional(v.string()),
    genericName: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    indication: v.optional(v.string()),
    mechanism: v.optional(v.string()),
    productProfile: v.optional(PRODUCT_PROFILE_VALIDATOR),
    identityEvidenceItems: v.optional(v.array(PRODUCT_IDENTITY_EVIDENCE_VALIDATOR)),
    approvalStatus: v.optional(
      v.union(
        v.literal("approved"),
        v.literal("pending"),
        v.literal("withdrawn")
      )
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    manufacturerName: v.optional(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMarketAuthorizationHolderName: v.optional(v.string()),
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
    entityLinks: v.optional(
      v.array(
        v.object({
          companyId: v.optional(v.id("companies")),
          entityName: v.optional(v.string()),
          relationshipType: v.union(
            v.literal("manufacturer"),
            v.literal("market_authorization_holder"),
            v.literal("licensor"),
            v.literal("regional_partner"),
            v.literal("distributor")
          ),
          jurisdiction: v.optional(v.string()),
          isPrimary: v.boolean(),
          notes: v.optional(v.string()),
          source: v.optional(v.string()),
          url: v.optional(v.string()),
          confidence: v.union(
            v.literal("confirmed"),
            v.literal("likely"),
            v.literal("inferred")
          ),
        })
      )
    ),
  },
  handler: async (ctx, { id, entityLinks, ...patch }) => {
    const existingDrug = await ctx.db.get(id);
    if (!existingDrug) {
      throw new Error("Drug not found");
    }

    const normalizedLinks = entityLinks
      ? normalizeDrugEntityLinks(entityLinks)
      : undefined;

    const primaryManufacturerName =
      normalizedLinks?.find(
        (link) => link.relationshipType === "manufacturer" && link.isPrimary
      )?.entityName ?? patch.primaryManufacturerName;
    const manufacturerName =
      patch.manufacturerName ??
      (!existingDrug.companyId ? primaryManufacturerName : undefined);

    await ctx.db.patch(id, {
      ...patch,
      ...(primaryManufacturerName !== undefined
        ? { primaryManufacturerName }
        : {}),
      ...(manufacturerName !== undefined ? { manufacturerName } : {}),
    });
    if (normalizedLinks) {
      await ctx.runMutation(api.drugEntityLinks.replaceForDrug, {
        drugId: id,
        links: normalizedLinks,
      });
    }
  },
});

export const adminDetachCompanyFromDrug = mutation({
  args: {
    id: v.id("drugs"),
    companyId: v.id("companies"),
    clearNamePrefixes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, companyId, clearNamePrefixes }) => {
    const existingDrug = await ctx.db.get(id);
    if (!existingDrug) {
      throw new Error("Drug not found");
    }

    const existingLinks = await ctx.db
      .query("drugEntityLinks")
      .withIndex("by_drug", (q) => q.eq("drugId", id))
      .collect();

    const prefixes = (clearNamePrefixes ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const shouldClearName = (value?: string) =>
      !!value &&
      prefixes.some(
        (prefix) =>
          value.toLowerCase() === prefix || value.toLowerCase().includes(prefix)
      );

    const filteredLinks = existingLinks
      .filter((link) => link.companyId !== companyId)
      .filter((link) => !shouldClearName(link.entityName));

    const {
      manufacturerName: existingManufacturerName,
      primaryManufacturerName: existingPrimaryManufacturerName,
      primaryMarketAuthorizationHolderName: existingPrimaryMahName,
      ...existingWithoutNames
    } = existingDrug;
    const rest = { ...existingWithoutNames } as Omit<
      typeof existingWithoutNames,
      "_id" | "_creationTime" | "companyId"
    > & {
      _id?: never;
      _creationTime?: never;
      companyId?: never;
    };
    delete (rest as Record<string, unknown>)._id;
    delete (rest as Record<string, unknown>)._creationTime;
    delete (rest as Record<string, unknown>).companyId;

    await ctx.db.replace("drugs", id, {
      ...rest,
      ...(shouldClearName(existingManufacturerName)
        ? {}
        : existingManufacturerName
          ? { manufacturerName: existingManufacturerName }
          : {}),
      ...(shouldClearName(existingPrimaryManufacturerName)
        ? {}
        : existingPrimaryManufacturerName
          ? { primaryManufacturerName: existingPrimaryManufacturerName }
          : {}),
      ...(shouldClearName(existingPrimaryMahName)
        ? {}
        : existingPrimaryMahName
          ? { primaryMarketAuthorizationHolderName: existingPrimaryMahName }
          : {}),
    });

    await ctx.runMutation(api.drugEntityLinks.replaceForDrug, {
      drugId: id,
      links: filteredLinks.map((link) => ({
        companyId: link.companyId,
        entityName: link.entityName,
        relationshipType: link.relationshipType,
        jurisdiction: link.jurisdiction,
        isPrimary: link.isPrimary,
        notes: link.notes,
        source: link.source,
        url: link.url,
        confidence: link.confidence,
      })),
    });

  },
});

export const updateMenaRegistrations = mutation({
  args: {
    id: v.id("drugs"),
    menaRegistrations: v.array(v.object({
      country: v.string(),
      status: v.union(v.literal("registered"), v.literal("not_found"), v.literal("unverified")),
      registrationNumber: v.optional(v.string()),
      source: v.string(),
      url: v.optional(v.string()),
      verifiedAt: v.number(),
    })),
    menaRegistrationCount: v.optional(v.number()),
  },
  handler: async (ctx, { id, menaRegistrations, menaRegistrationCount }) => {
    await ctx.db.patch(id, { menaRegistrations, menaRegistrationCount });
  },
});

export const listWithPatentUrgency = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("drugs").take(limit ?? 100);
    return all
      .filter((d) => d.patentExpiryYear != null)
      .sort((a, b) => (a.patentExpiryYear ?? 9999) - (b.patentExpiryYear ?? 9999));
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("drugs").collect();
    return { total: all.length };
  },
});
