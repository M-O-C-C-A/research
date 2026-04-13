import {
  action,
  ActionCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { normalizeText } from "./productIntelligenceHelpers";

const PIPELINE_STATUS_VALIDATOR = v.union(
  v.literal("candidate"),
  v.literal("confirmed_absent"),
  v.literal("present_in_gcc"),
  v.literal("ambiguous_match"),
  v.literal("presence_blocked"),
  v.literal("ready_for_market_research"),
  v.literal("ranked")
);

const CONFIRMATION_STATUS_VALIDATOR = v.union(
  v.literal("candidate"),
  v.literal("confirmed_absent"),
  v.literal("present_in_gcc"),
  v.literal("likely_present_under_different_brand"),
  v.literal("likely_generic_equivalent_present"),
  v.literal("ambiguous_match")
);

const PRESENCE_STATUS_VALIDATOR = v.union(
  v.literal("unknown"),
  v.literal("weak_absent"),
  v.literal("connected"),
  v.literal("blocked")
);

const PURSUIT_ROLE_VALIDATOR = v.union(
  v.literal("mah"),
  v.literal("applicant"),
  v.literal("licensor"),
  v.literal("manufacturer"),
  v.literal("unknown")
);

const EVIDENCE_STAGE_VALIDATOR = v.union(
  v.literal("confirmation"),
  v.literal("presence"),
  v.literal("ranking")
);

const EVIDENCE_SOURCE_TYPE_VALIDATOR = v.union(
  v.literal("official_registry"),
  v.literal("company"),
  v.literal("internal")
);

const GCC_PLUS_COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Kuwait",
  "Qatar",
  "Egypt",
  "Algeria",
] as const;

type CanonicalEntity = Doc<"canonicalProductEntities">;
type CanonicalOpportunity = Doc<"canonicalProductOpportunities">;
type CompanyDoc = Doc<"companies">;
type CanonicalProductDoc = Doc<"canonicalProducts">;
type CanonicalMarketRow = Doc<"canonicalProductMarketAnalyses">;
type LinkedDrugDoc = Doc<"drugs">;

type HydratedEntity = CanonicalEntity & {
  company: CompanyDoc | null;
};

type OpportunityEvidenceInput = {
  stage: "confirmation" | "presence" | "ranking";
  title?: string;
  claim: string;
  url?: string;
  sourceType: "official_registry" | "company" | "internal";
  confidence: "confirmed" | "likely" | "inferred";
  country?: string;
  sourceSystem?:
    | "cms"
    | "nhsbsa"
    | "sfda"
    | "eda_egypt"
    | "mohap_uae"
    | "bfarm_amice"
    | "who"
    | "nupco"
    | "evaluate"
    | "clarivate"
    | "lauer_taxe"
    | "manual"
    | "other";
};

type PipelineInputs = {
  product: CanonicalProductDoc;
  entities: HydratedEntity[];
  linkedDrugs: LinkedDrugDoc[];
  marketRows: CanonicalMarketRow[];
};

function normalizeName(value?: string | null) {
  return normalizeText(value);
}

function dedupeEvidence(items: OpportunityEvidenceInput[]) {
  return [
    ...new Map(
      items.map((item) => [
        `${item.stage}|${item.title ?? ""}|${item.claim}|${item.url ?? ""}|${item.country ?? ""}`,
        item,
      ])
    ).values(),
  ].slice(0, 12);
}

function rolePriority(role: CanonicalEntity["role"]) {
  switch (role) {
    case "mah":
      return 0;
    case "applicant":
      return 1;
    case "licensor":
      return 2;
    case "manufacturer":
      return 3;
    default:
      return 9;
  }
}

function entityConfidenceWeight(confidence: CanonicalEntity["confidence"]) {
  return confidence === "confirmed" ? 0 : confidence === "likely" ? 1 : 2;
}

function sortEntities(left: CanonicalEntity, right: CanonicalEntity) {
  const roleDelta = rolePriority(left.role) - rolePriority(right.role);
  if (roleDelta !== 0) return roleDelta;
  const primaryDelta = Number(right.isPrimary) - Number(left.isPrimary);
  if (primaryDelta !== 0) return primaryDelta;
  const confidenceDelta = entityConfidenceWeight(left.confidence) - entityConfidenceWeight(right.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;
  return left.entityName.localeCompare(right.entityName);
}

function pickManufacturerEntity(entities: HydratedEntity[]) {
  return [...entities]
    .filter((entity) => entity.role === "manufacturer")
    .sort(sortEntities)[0];
}

function pickCommercialOwnerEntity(entities: HydratedEntity[]) {
  return [...entities]
    .filter((entity) => entity.role === "mah" || entity.role === "applicant" || entity.role === "licensor")
    .sort(sortEntities)[0];
}

function pickUaeRow(rows: CanonicalMarketRow[]) {
  return rows.find((row) => normalizeName(row.country) === "uae");
}

function determineConfirmation(args: {
  product: CanonicalProductDoc;
  uaeRow?: CanonicalMarketRow;
}) {
  const row = args.uaeRow;
  if (!row) {
    return {
      confirmationStatus: "candidate" as const,
      pipelineStatus: "candidate" as const,
      confirmationReason: "UAE official registry evidence has not been applied to this product yet.",
      evidence: [] as OpportunityEvidenceInput[],
    };
  }

  const productBrand = normalizeName(args.product.brandName);
  const productInn = normalizeName(args.product.inn);
  const marketedNames = row.marketedNames.map((name) => normalizeName(name));
  const hasBrandMatch = marketedNames.includes(productBrand);
  const hasInnMatch = marketedNames.includes(productInn);

  const evidence = (row.evidenceItems ?? []).map((item) => ({
    stage: "confirmation" as const,
    title: item.title,
    claim: item.claim,
    url: item.url,
    sourceType: "official_registry" as const,
    confidence: item.confidence,
    country: item.country,
    sourceSystem: item.sourceSystem,
  }));

  if (row.availabilityStatus === "ambiguous") {
    return {
      confirmationStatus: "ambiguous_match" as const,
      pipelineStatus: "ambiguous_match" as const,
      confirmationReason: "UAE evidence is ambiguous, so this product still needs manual confirmation before promotion.",
      evidence,
    };
  }

  if (row.availabilityStatus === "not_found") {
    return {
      confirmationStatus: "confirmed_absent" as const,
      pipelineStatus: "confirmed_absent" as const,
      confirmationReason: "UAE official evidence currently shows no confirmed local registration for this product identity.",
      evidence,
    };
  }

  if (row.availabilityStatus === "unverified") {
    return {
      confirmationStatus: "candidate" as const,
      pipelineStatus: "candidate" as const,
      confirmationReason:
        "UAE market evidence exists for this product, but it is still unverified and should not be promoted until registry confirmation is stronger.",
      evidence,
    };
  }

  if (row.genericAvailability === "generic_only" || (!hasBrandMatch && hasInnMatch)) {
    return {
      confirmationStatus: "likely_generic_equivalent_present" as const,
      pipelineStatus: "present_in_gcc" as const,
      confirmationReason: "UAE evidence suggests the INN is present generically or under a non-originator identity.",
      evidence,
    };
  }

  if (!hasBrandMatch && row.marketedNames.length > 0) {
    return {
      confirmationStatus: "likely_present_under_different_brand" as const,
      pipelineStatus: "present_in_gcc" as const,
      confirmationReason: "UAE evidence suggests the product is already present locally under a different brand identity.",
      evidence,
    };
  }

  return {
    confirmationStatus: "present_in_gcc" as const,
    pipelineStatus: "present_in_gcc" as const,
    confirmationReason: "UAE evidence indicates that this branded product is already present in the market.",
    evidence,
  };
}

function companyPresenceSummary(company: CompanyDoc) {
  const partnerHits = (company.existingMenaPartners ?? []).filter((partner) =>
    partner.geographies.some((geography) =>
      GCC_PLUS_COUNTRIES.some((country) => normalizeName(geography).includes(normalizeName(country)))
    )
  );

  const hasExplicitGccLink = partnerHits.length > 0;
  const menaPresence = company.menaPresence ?? company.menaChannelStatus;
  const partnershipStrength = company.menaPartnershipStrength;

  if (
    menaPresence === "established" ||
    partnershipStrength === "entrenched" ||
    partnershipStrength === "moderate" ||
    hasExplicitGccLink
  ) {
    const reason = hasExplicitGccLink
      ? `${company.name} already has GCC++ partner or affiliate signals (${partnerHits.map((partner) => partner.name).slice(0, 3).join(", ")}).`
      : `${company.name} already shows established or meaningful MENA channel coverage.`;
    return {
      presenceStatus: "blocked" as const,
      presenceReason: reason,
      evidence: [
        ...(company.bdEvidenceItems ?? []).slice(0, 2).map((item) => ({
          stage: "presence" as const,
          title: item.source,
          claim: item.claim,
          url: item.url,
          sourceType: "company" as const,
          confidence: "likely" as const,
        })),
        ...partnerHits.slice(0, 3).map((partner) => ({
          stage: "presence" as const,
          title: partner.source ?? `${company.name} GCC++ partner signal`,
          claim: `${partner.name} is linked to ${company.name} as ${partner.role.replaceAll("_", " ")} across ${partner.geographies.join(", ")}.`,
          url: partner.url,
          sourceType: "company" as const,
          confidence: partner.confidence,
        })),
      ],
    };
  }

  if (menaPresence === "none" || partnershipStrength === "none") {
    return {
      presenceStatus: "weak_absent" as const,
      presenceReason: `${company.name} currently looks clear of meaningful GCC++ channel coverage in the stored company research.`,
      evidence: (company.bdEvidenceItems ?? []).slice(0, 2).map((item) => ({
        stage: "presence" as const,
        title: item.source,
        claim: item.claim,
        url: item.url,
        sourceType: "company" as const,
        confidence: "likely" as const,
      })),
    };
  }

  if (menaPresence === "limited" || partnershipStrength === "limited") {
    return {
      presenceStatus: "connected" as const,
      presenceReason: `${company.name} shows some MENA connectivity, but not enough to fully close the opportunity.`,
      evidence: (company.bdEvidenceItems ?? []).slice(0, 2).map((item) => ({
        stage: "presence" as const,
        title: item.source,
        claim: item.claim,
        url: item.url,
        sourceType: "company" as const,
        confidence: "likely" as const,
      })),
    };
  }

  return {
    presenceStatus: "unknown" as const,
    presenceReason: `${company.name} is linked to the product, but the stored company record does not yet contain enough GCC++ presence detail for a hard gate.`,
    evidence: [] as OpportunityEvidenceInput[],
  };
}

function determinePresence(args: {
  commercialOwnerEntity?: HydratedEntity;
  manufacturerEntity?: HydratedEntity;
}) {
  const ownerCompany = args.commercialOwnerEntity?.company;
  if (ownerCompany) {
    const ownerPresence = companyPresenceSummary(ownerCompany);
    return {
      ...ownerPresence,
      recommendedEntity: args.commercialOwnerEntity,
      recommendedRole:
        args.commercialOwnerEntity?.role === "mah"
          ? ("mah" as const)
          : args.commercialOwnerEntity?.role === "applicant"
            ? ("applicant" as const)
            : args.commercialOwnerEntity?.role === "licensor"
              ? ("licensor" as const)
              : ("unknown" as const),
    };
  }

  const manufacturerCompany = args.manufacturerEntity?.company;
  if (manufacturerCompany) {
    const manufacturerPresence = companyPresenceSummary(manufacturerCompany);
    return {
      ...manufacturerPresence,
      recommendedEntity: args.manufacturerEntity,
      recommendedRole: "manufacturer" as const,
    };
  }

  if (args.commercialOwnerEntity) {
    return {
      presenceStatus: "unknown" as const,
      presenceReason: `${args.commercialOwnerEntity.entityName} is recognized as the commercial owner, but it is not yet linked to a structured company record.`,
      evidence: [] as OpportunityEvidenceInput[],
      recommendedEntity: args.commercialOwnerEntity,
      recommendedRole:
        args.commercialOwnerEntity.role === "mah"
          ? ("mah" as const)
          : args.commercialOwnerEntity.role === "applicant"
            ? ("applicant" as const)
            : args.commercialOwnerEntity.role === "licensor"
              ? ("licensor" as const)
              : ("unknown" as const),
    };
  }

  if (args.manufacturerEntity) {
    return {
      presenceStatus: "unknown" as const,
      presenceReason: `${args.manufacturerEntity.entityName} is the best-known linked manufacturer, but it is not yet linked to a structured company record.`,
      evidence: [] as OpportunityEvidenceInput[],
      recommendedEntity: args.manufacturerEntity,
      recommendedRole: "manufacturer" as const,
    };
  }

  return {
    presenceStatus: "unknown" as const,
    presenceReason: "No structured commercial-owner or manufacturer entity is linked to this canonical product yet.",
    evidence: [] as OpportunityEvidenceInput[],
    recommendedEntity: undefined,
    recommendedRole: "unknown" as const,
  };
}

function averagePatentUrgency(linkedDrugs: LinkedDrugDoc[]) {
  const values = linkedDrugs
    .map((drug) => drug.patentUrgencyScore)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildRanking(args: {
  confirmationStatus:
    | "candidate"
    | "confirmed_absent"
    | "present_in_gcc"
    | "likely_present_under_different_brand"
    | "likely_generic_equivalent_present"
    | "ambiguous_match";
  presenceStatus: "unknown" | "weak_absent" | "connected" | "blocked";
  recommendedRole: "mah" | "applicant" | "licensor" | "manufacturer" | "unknown";
  product: CanonicalProductDoc;
  linkedDrugs: LinkedDrugDoc[];
  marketRows: CanonicalMarketRow[];
}) {
  const bestMarketScore = Math.max(
    0,
    ...args.marketRows.map((row) => row.priorityScore ?? row.commercialOpportunityScore ?? 0)
  );
  const whitespaceMarkets = args.marketRows.filter((row) => row.availabilityStatus === "not_found").length;
  const patentUrgency = averagePatentUrgency(args.linkedDrugs);

  const whitespaceComponent =
    args.confirmationStatus === "confirmed_absent"
      ? 4
      : args.confirmationStatus === "candidate"
        ? 1.5
        : args.confirmationStatus === "ambiguous_match"
          ? -1.5
          : args.confirmationStatus === "likely_present_under_different_brand"
            ? -0.5
            : args.confirmationStatus === "likely_generic_equivalent_present"
              ? -1
              : -2.5;

  const presenceComponent =
    args.presenceStatus === "weak_absent"
      ? 3
      : args.presenceStatus === "connected"
        ? 1
        : args.presenceStatus === "unknown"
          ? 0.75
          : -3;

  const roleComponent =
    args.recommendedRole === "mah" || args.recommendedRole === "applicant" || args.recommendedRole === "licensor"
      ? 2
      : args.recommendedRole === "manufacturer"
        ? 1
        : 0.5;

  const postureComponent =
    (args.product.productType === "biosimilar" ? -0.5 : 0) +
    (patentUrgency >= 8 ? 1.5 : patentUrgency >= 6 ? 1 : 0) +
    (whitespaceMarkets >= 3 ? 1 : whitespaceMarkets >= 1 ? 0.5 : 0);

  const marketComponent = Math.min(3, bestMarketScore / 3);
  const rankingScore = Math.max(
    0,
    Math.min(10, Number((whitespaceComponent + presenceComponent + roleComponent + postureComponent + marketComponent).toFixed(2)))
  );

  const topCountries = [...args.marketRows]
    .sort((left, right) => (right.priorityScore ?? 0) - (left.priorityScore ?? 0))
    .slice(0, 3)
    .map((row) => row.country);

  return {
    rankingScore,
    rankingReason: `Score ${rankingScore}/10 because whitespace is ${args.confirmationStatus.replaceAll("_", " ")}, GCC++ company presence is ${args.presenceStatus.replaceAll("_", " ")}, the pursuit role is ${args.recommendedRole.replaceAll("_", " ")}, and the strongest current markets are ${topCountries.join(", ") || "still being derived"}.`,
    marketSignalsSummary:
      topCountries.length > 0
        ? `Top GCC++ priorities are ${topCountries.join(", ")} based on current market analysis and whitespace evidence.`
        : "No prioritized GCC++ markets are available yet for this product.",
  };
}

export const backfillCanonicalEntityCompanyLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").collect();
    const companyIdByName = new Map<string, Id<"companies">>();
    const duplicateNames = new Set<string>();

    for (const company of companies) {
      const key = normalizeName(company.name);
      if (companyIdByName.has(key)) {
        duplicateNames.add(key);
        continue;
      }
      companyIdByName.set(key, company._id);
    }

    let updated = 0;
    for (const entity of await ctx.db.query("canonicalProductEntities").collect()) {
      if (entity.companyId) continue;
      const key = normalizeName(entity.entityName);
      if (!key || duplicateNames.has(key)) continue;
      const companyId = companyIdByName.get(key);
      if (!companyId) continue;
      await ctx.db.patch(entity._id, { companyId, updatedAt: Date.now() });
      updated += 1;
    }

    return { updated };
  },
});

export const getPipelineInputs = internalQuery({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }): Promise<PipelineInputs | null> => {
    const [product, entities, linkedDrugs, marketRows] = await Promise.all([
      ctx.db.get(canonicalProductId),
      ctx.db
        .query("canonicalProductEntities")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("drugs")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("canonicalProductMarketAnalyses")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
    ]);

    if (!product) return null;

    const hydratedEntities = await Promise.all(
      entities.map(async (entity) => ({
        ...entity,
        company: entity.companyId ? await ctx.db.get(entity.companyId) : null,
      }))
    );

    return {
      product,
      entities: hydratedEntities.sort(sortEntities),
      linkedDrugs,
      marketRows,
    };
  },
});

export const upsert = mutation({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    pipelineStatus: PIPELINE_STATUS_VALIDATOR,
    confirmationStatus: CONFIRMATION_STATUS_VALIDATOR,
    presenceStatus: PRESENCE_STATUS_VALIDATOR,
    targetCountries: v.array(v.string()),
    focusCountry: v.optional(v.string()),
    uaeAvailabilityStatus: v.optional(v.union(
      v.literal("formally_registered"),
      v.literal("tender_formulary_only"),
      v.literal("shortage_listed"),
      v.literal("hospital_import_only"),
      v.literal("not_found"),
      v.literal("ambiguous"),
      v.literal("unverified")
    )),
    uaeGenericAvailability: v.optional(v.union(
      v.literal("originator_only"),
      v.literal("originator_plus_generics"),
      v.literal("generic_only"),
      v.literal("not_available"),
      v.literal("unclear")
    )),
    commercialOwnerEntityId: v.optional(v.id("canonicalProductEntities")),
    manufacturerEntityId: v.optional(v.id("canonicalProductEntities")),
    recommendedPursuitEntityId: v.optional(v.id("canonicalProductEntities")),
    recommendedPursuitRole: v.optional(PURSUIT_ROLE_VALIDATOR),
    recommendedPursuitCompanyId: v.optional(v.id("companies")),
    confirmationReason: v.optional(v.string()),
    presenceReason: v.optional(v.string()),
    marketSignalsSummary: v.optional(v.string()),
    rankingScore: v.optional(v.number()),
    rankingReason: v.optional(v.string()),
    lastPipelineRunAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("canonicalProductOpportunities")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", args.canonicalProductId))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("canonicalProductOpportunities", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const replaceEvidence = mutation({
  args: {
    canonicalProductOpportunityId: v.id("canonicalProductOpportunities"),
    evidence: v.array(v.object({
      stage: EVIDENCE_STAGE_VALIDATOR,
      title: v.optional(v.string()),
      claim: v.string(),
      url: v.optional(v.string()),
      sourceType: EVIDENCE_SOURCE_TYPE_VALIDATOR,
      confidence: v.union(v.literal("confirmed"), v.literal("likely"), v.literal("inferred")),
      country: v.optional(v.string()),
      sourceSystem: v.optional(v.union(
        v.literal("cms"),
        v.literal("nhsbsa"),
        v.literal("sfda"),
        v.literal("eda_egypt"),
        v.literal("mohap_uae"),
        v.literal("bfarm_amice"),
        v.literal("who"),
        v.literal("nupco"),
        v.literal("evaluate"),
        v.literal("clarivate"),
        v.literal("lauer_taxe"),
        v.literal("manual"),
        v.literal("other")
      )),
    })),
  },
  handler: async (ctx, { canonicalProductOpportunityId, evidence }) => {
    const existing = await ctx.db
      .query("canonicalProductOpportunityEvidence")
      .withIndex("by_canonical_product_opportunity", (q) =>
        q.eq("canonicalProductOpportunityId", canonicalProductOpportunityId)
      )
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (const item of evidence) {
      await ctx.db.insert("canonicalProductOpportunityEvidence", {
        canonicalProductOpportunityId,
        ...item,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

async function buildOpportunityState(
  ctx: ActionCtx,
  canonicalProductId: Id<"canonicalProducts">
) {
  await ctx.runAction(api.productMarketAnalysis.analyzeCanonicalProductMarkets, {
    canonicalProductId,
  });

  const inputs = await ctx.runQuery(internal.canonicalOpportunities.getPipelineInputs, {
    canonicalProductId,
  });

  if (!inputs) return null;

  const commercialOwnerEntity = pickCommercialOwnerEntity(inputs.entities);
  const manufacturerEntity = pickManufacturerEntity(inputs.entities);
  const confirmation = determineConfirmation({
    product: inputs.product,
    uaeRow: pickUaeRow(inputs.marketRows),
  });
  const presence = determinePresence({
    commercialOwnerEntity,
    manufacturerEntity,
  });
  const ranking = buildRanking({
    confirmationStatus: confirmation.confirmationStatus,
    presenceStatus: presence.presenceStatus,
    recommendedRole: presence.recommendedRole,
    product: inputs.product,
    linkedDrugs: inputs.linkedDrugs,
    marketRows: inputs.marketRows,
  });

  let pipelineStatus: CanonicalOpportunity["pipelineStatus"] = confirmation.pipelineStatus;
  if (confirmation.confirmationStatus === "confirmed_absent") {
    if (presence.presenceStatus === "blocked") {
      pipelineStatus = "presence_blocked";
    } else {
      pipelineStatus = ranking.rankingScore > 0 ? "ranked" : "ready_for_market_research";
    }
  }

  return {
    inputs,
    commercialOwnerEntity,
    manufacturerEntity,
    confirmation,
    presence,
    ranking,
    pipelineStatus,
  };
}

export const getByCanonicalProductInputs = query({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }) => {
    return await ctx.runQuery(internal.canonicalOpportunities.getPipelineInputs, {
      canonicalProductId,
    });
  },
});

export const getByCanonicalProduct = query({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }) => {
    const opportunity = await ctx.db
      .query("canonicalProductOpportunities")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
      .unique();

    if (!opportunity) return null;

    const [entities, evidence] = await Promise.all([
      ctx.db
        .query("canonicalProductEntities")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("canonicalProductOpportunityEvidence")
        .withIndex("by_canonical_product_opportunity", (q) => q.eq("canonicalProductOpportunityId", opportunity._id))
        .collect(),
    ]);

    const entityIds = [
      opportunity.commercialOwnerEntityId,
      opportunity.manufacturerEntityId,
      opportunity.recommendedPursuitEntityId,
    ].filter((value): value is Id<"canonicalProductEntities"> => Boolean(value));

    const selectedEntities = new Map(
      entities
        .filter((entity) => entityIds.includes(entity._id))
        .map((entity) => [entity._id, entity])
    );

    const companyIds = [
      ...new Set(
        [...selectedEntities.values()]
          .map((entity) => entity.companyId)
          .filter((value): value is Id<"companies"> => Boolean(value))
      ),
    ];
    const companies = await Promise.all(companyIds.map(async (id) => await ctx.db.get(id)));
    const companiesById = new Map(
      companies.filter((company): company is CompanyDoc => Boolean(company)).map((company) => [company._id, company])
    );

    function hydrateEntity(entityId?: Id<"canonicalProductEntities">) {
      if (!entityId) return null;
      const entity = selectedEntities.get(entityId);
      if (!entity) return null;
      return {
        ...entity,
        company: entity.companyId ? companiesById.get(entity.companyId) ?? null : null,
      };
    }

    return {
      ...opportunity,
      commercialOwnerEntity: hydrateEntity(opportunity.commercialOwnerEntityId),
      manufacturerEntity: hydrateEntity(opportunity.manufacturerEntityId),
      recommendedPursuitEntity: hydrateEntity(opportunity.recommendedPursuitEntityId),
      evidence: evidence.sort((left, right) => left.stage.localeCompare(right.stage)),
    };
  },
});

async function listByPipelineStatus(
  ctx: QueryCtx,
  statuses: CanonicalOpportunity["pipelineStatus"][],
  limit: number
) {
  const rows = await ctx.db.query("canonicalProductOpportunities").collect();
  return rows
    .filter((row) => statuses.includes(row.pipelineStatus))
    .sort((left, right) => (right.rankingScore ?? 0) - (left.rankingScore ?? 0))
    .slice(0, limit);
}

export const listCandidates = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["candidate", "confirmed_absent", "ready_for_market_research"], limit),
});

export const listConfirmed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["confirmed_absent", "ready_for_market_research", "ranked"], limit),
});

export const listBlocked = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["presence_blocked", "present_in_gcc", "ambiguous_match"], limit),
});

export const listRanked = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["ranked"], limit),
});

export const runPipeline = action({
  args: {
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    syncReferenceSources: v.optional(v.boolean()),
    includeBfarm: v.optional(v.boolean()),
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "canonical_gcc_pipeline",
      companyName: args.canonicalProductId ? "single_canonical_product" : "all_canonical_products",
      targetCountries: ["UAE"],
    });

    const appendLog = async (
      message: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => {
      await ctx.runMutation(api.discoveryJobs.appendLog, { id: jobId, message, level });
    };

    try {
      if (args.syncReferenceSources) {
        await appendLog("Syncing FDA and EMA reference products before pipeline evaluation...");
        await ctx.runAction(api.productIntelligenceActions.syncFdaProducts, {
          searchTerm: args.searchTerm,
          limit: args.limit ?? 25,
        });
        await ctx.runAction(api.productIntelligenceActions.syncEmaCentralProducts, {
          searchTerm: args.searchTerm,
          limit: args.limit ?? 50,
        });
        if (args.includeBfarm) {
          await ctx.runAction(api.productIntelligenceActions.syncBfarmProducts, {
            searchTerm: args.searchTerm,
            limit: args.limit ?? 25,
          });
        }
        await ctx.runAction(api.productIntelligenceActions.rebuildCanonicalProductLinks, {});
      }

      const linkResult = await ctx.runMutation(
        internal.canonicalOpportunities.backfillCanonicalEntityCompanyLinks,
        {}
      );
      if (linkResult.updated > 0) {
        await appendLog(`Linked ${linkResult.updated} canonical entities back to structured company records.`);
      }

      const canonicalProductIds: Id<"canonicalProducts">[] = args.canonicalProductId
        ? [args.canonicalProductId]
        : (await ctx.runQuery(api.productIntelligence.listCanonicalProducts, {})).map((product) => product._id);

      let ranked = 0;
      let blocked = 0;
      let ambiguous = 0;
      let touched = 0;

      for (const canonicalProductId of canonicalProductIds) {
        const state = await buildOpportunityState(ctx, canonicalProductId);
        if (!state) continue;

        const opportunityId = await ctx.runMutation(api.canonicalOpportunities.upsert, {
          canonicalProductId,
          pipelineStatus: state.pipelineStatus,
          confirmationStatus: state.confirmation.confirmationStatus,
          presenceStatus: state.presence.presenceStatus,
          targetCountries: ["UAE", ...GCC_PLUS_COUNTRIES.filter((country) => country !== "UAE")],
          focusCountry: "UAE",
          uaeAvailabilityStatus: pickUaeRow(state.inputs.marketRows)?.availabilityStatus,
          uaeGenericAvailability: pickUaeRow(state.inputs.marketRows)?.genericAvailability,
          commercialOwnerEntityId: state.commercialOwnerEntity?._id,
          manufacturerEntityId: state.manufacturerEntity?._id,
          recommendedPursuitEntityId: state.presence.recommendedEntity?._id,
          recommendedPursuitRole: state.presence.recommendedRole,
          recommendedPursuitCompanyId: state.presence.recommendedEntity?.company?._id,
          confirmationReason: state.confirmation.confirmationReason,
          presenceReason: state.presence.presenceReason,
          marketSignalsSummary: state.ranking.marketSignalsSummary,
          rankingScore: state.pipelineStatus === "ranked" ? state.ranking.rankingScore : undefined,
          rankingReason: state.pipelineStatus === "ranked" ? state.ranking.rankingReason : undefined,
          lastPipelineRunAt: Date.now(),
        });

        await ctx.runMutation(api.canonicalOpportunities.replaceEvidence, {
          canonicalProductOpportunityId: opportunityId,
          evidence: dedupeEvidence([
            ...state.confirmation.evidence,
            ...state.presence.evidence,
            {
              stage: "ranking",
              title: "Canonical GCC++ opportunity ranking",
              claim: state.ranking.rankingReason,
              sourceType: "internal",
              confidence: "inferred",
            },
          ]),
        });

        touched += 1;
        if (state.pipelineStatus === "ranked") ranked += 1;
        if (state.pipelineStatus === "presence_blocked" || state.pipelineStatus === "present_in_gcc") blocked += 1;
        if (state.pipelineStatus === "ambiguous_match") ambiguous += 1;
      }

      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: touched,
        skippedDuplicates: 0,
        summary: `Canonical GCC++ pipeline refreshed ${touched} products (${ranked} ranked, ${blocked} blocked/present, ${ambiguous} ambiguous).`,
      });

      return {
        jobId,
        touched,
        ranked,
        blocked,
        ambiguous,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Canonical GCC++ pipeline failed.";
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage: message,
      });
      throw error;
    }
  },
});
