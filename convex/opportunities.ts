import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

const AVAILABILITY_STATUS_VALIDATOR = v.union(
  v.literal("formally_registered"),
  v.literal("tender_formulary_only"),
  v.literal("shortage_listed"),
  v.literal("hospital_import_only"),
  v.literal("not_found"),
  v.literal("ambiguous"),
  v.literal("unverified")
);

const MARKET_ACCESS_ROUTE_VALIDATOR = v.union(
  v.literal("public_tender"),
  v.literal("private_hospital"),
  v.literal("retail_pharmacy"),
  v.literal("specialty_center"),
  v.literal("named_patient")
);

const COUNTRY_SCORE_BREAKDOWN_VALIDATOR = v.object({
  demand: v.number(),
  competition: v.number(),
  regulatory: v.number(),
  price: v.number(),
  partnerability: v.number(),
});

const EVIDENCE_ITEM_VALIDATOR = v.object({
  claim: v.string(),
  title: v.optional(v.string()),
  url: v.optional(v.string()),
  sourceType: v.union(
    v.literal("official_registry"),
    v.literal("shortage_list"),
    v.literal("tender_portal"),
    v.literal("public_procurement"),
    v.literal("essential_medicines"),
    v.literal("market_report"),
    v.literal("internal")
  ),
  confidence: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("inferred")
  ),
});

const SOURCE_CATEGORY_VALIDATOR = v.union(
  v.literal("official"),
  v.literal("commercial_database"),
  v.literal("proxy")
);

const SOURCE_SYSTEM_VALIDATOR = v.union(
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
);

const PRICE_TYPE_VALIDATOR = v.union(
  v.literal("registered"),
  v.literal("list"),
  v.literal("tariff"),
  v.literal("reimbursement"),
  v.literal("asp"),
  v.literal("tender"),
  v.literal("retail"),
  v.literal("hospital"),
  v.literal("other")
);

const SIGNAL_TYPE_VALIDATOR = v.union(
  v.literal("tender"),
  v.literal("procurement"),
  v.literal("reimbursement"),
  v.literal("tariff"),
  v.literal("channel"),
  v.literal("competition"),
  v.literal("proxy")
);

const SIGNAL_STRENGTH_VALIDATOR = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
);

const OPPORTUNITY_KIND_VALIDATOR = v.union(
  v.literal("commercial_opportunity"),
  v.literal("tender_opportunity"),
  v.literal("commercial_and_tender"),
  v.literal("no_clear_opportunity"),
  v.literal("insufficient_commercial_evidence")
);

const PRICING_CONFIDENCE_VALIDATOR = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("unknown")
);

const PRICE_POSITIONING_VALIDATOR = v.union(
  v.literal("premium"),
  v.literal("parity"),
  v.literal("discount"),
  v.literal("unknown")
);

const COMPETITION_INTENSITY_VALIDATOR = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("unknown")
);

const COMMERCIAL_EVIDENCE_STATUS_VALIDATOR = v.union(
  v.literal("strong"),
  v.literal("partial"),
  v.literal("proxy_only"),
  v.literal("insufficient")
);

const TENDER_SIGNAL_STRENGTH_VALIDATOR = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none")
);

const COMMERCIAL_SUMMARY_MODE_VALIDATOR = v.union(
  v.literal("auto"),
  v.literal("manual")
);

type OpportunityDoc = Doc<"opportunities">;
type PriceEvidenceDoc = Doc<"priceEvidence">;
type CommercialSignalDoc = Doc<"commercialSignals">;

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

function priorityForSourceCategory(category: PriceEvidenceDoc["sourceCategory"]) {
  return category === "official" ? 3 : category === "commercial_database" ? 2 : 1;
}

function priorityForPriceType(priceType: PriceEvidenceDoc["priceType"]) {
  switch (priceType) {
    case "reimbursement":
      return 9;
    case "tariff":
      return 8;
    case "registered":
      return 7;
    case "list":
      return 6;
    case "asp":
      return 5;
    case "tender":
      return 4;
    case "hospital":
      return 3;
    case "retail":
      return 2;
    default:
      return 1;
  }
}

function getPricingConfidence(priceRows: PriceEvidenceDoc[]) {
  if (priceRows.some((row) => row.sourceCategory === "official")) return "high" as const;
  if (priceRows.some((row) => row.sourceCategory === "commercial_database")) {
    return "medium" as const;
  }
  if (priceRows.some((row) => row.sourceCategory === "proxy")) return "low" as const;
  return "unknown" as const;
}

function getCommercialEvidenceStatus(
  priceRows: PriceEvidenceDoc[],
  signals: CommercialSignalDoc[]
) {
  if (
    priceRows.some((row) => row.sourceCategory === "official") &&
    signals.some((signal) => signal.sourceCategory === "official")
  ) {
    return "strong" as const;
  }
  if (priceRows.length > 0 && signals.length > 0) return "partial" as const;
  if (
    priceRows.length > 0 &&
    priceRows.every((row) => row.sourceCategory === "proxy") &&
    signals.every((signal) => signal.sourceCategory === "proxy")
  ) {
    return "proxy_only" as const;
  }
  return "insufficient" as const;
}

function getTenderSignalStrength(signals: CommercialSignalDoc[]) {
  const tenderSignals = signals.filter(
    (signal) => signal.signalType === "tender" || signal.signalType === "procurement"
  );
  if (tenderSignals.some((signal) => signal.signalStrength === "high")) return "high" as const;
  if (tenderSignals.some((signal) => signal.signalStrength === "medium")) {
    return "medium" as const;
  }
  if (tenderSignals.length > 0) return "low" as const;
  return "none" as const;
}

function getCompetitionIntensity(args: {
  opportunity?: OpportunityDoc | null;
  signals: CommercialSignalDoc[];
}) {
  if (
    args.signals.some(
      (signal) =>
        signal.signalType === "competition" && signal.signalStrength === "high"
    ) ||
    args.opportunity?.competitorPresence === "high"
  ) {
    return "high" as const;
  }
  if (
    args.signals.some(
      (signal) =>
        signal.signalType === "competition" && signal.signalStrength === "medium"
    ) ||
    args.opportunity?.competitorPresence === "medium"
  ) {
    return "medium" as const;
  }
  if (
    args.signals.some((signal) => signal.signalType === "competition") ||
    args.opportunity?.competitorPresence === "low" ||
    args.opportunity?.competitorPresence === "none"
  ) {
    return "low" as const;
  }
  return "unknown" as const;
}

function summarizePriceRows(priceRows: PriceEvidenceDoc[]) {
  if (priceRows.length === 0) {
    return {
      priceCorridor: undefined,
      primaryPriceBenchmark: undefined,
      competitivePriceSummary: undefined,
      pricePositioning: "unknown" as const,
    };
  }

  const sorted = [...priceRows].sort((left, right) => {
    const categoryDelta =
      priorityForSourceCategory(right.sourceCategory) -
      priorityForSourceCategory(left.sourceCategory);
    if (categoryDelta !== 0) return categoryDelta;
    const typeDelta =
      priorityForPriceType(right.priceType) - priorityForPriceType(left.priceType);
    if (typeDelta !== 0) return typeDelta;
    return right.observedAt - left.observedAt;
  });
  const benchmark = sorted[0];
  const currencies = [...new Set(priceRows.map((row) => row.currency))];
  const sameCurrency = currencies.length === 1;
  const amounts = sameCurrency
    ? [...priceRows.map((row) => row.amount)].sort((a, b) => a - b)
    : [];

  const priceCorridor =
    sameCurrency && amounts.length > 0
      ? `${formatCurrency(amounts[0], currencies[0])} - ${formatCurrency(
          amounts[amounts.length - 1],
          currencies[0]
        )}`
      : `Mixed price records across ${currencies.join(", ")}`;

  const medianAmount =
    sameCurrency && amounts.length > 0
      ? amounts[Math.floor(amounts.length / 2)]
      : undefined;
  const competitivePriceSummary =
    sameCurrency && amounts.length > 1
      ? `Observed ${priceRows.length} price points. Low ${formatCurrency(
          amounts[0],
          currencies[0]
        )}, median ${formatCurrency(medianAmount!, currencies[0])}, high ${formatCurrency(
          amounts[amounts.length - 1],
          currencies[0]
        )}.`
      : benchmark
        ? `Primary benchmark: ${formatCurrency(benchmark.amount, benchmark.currency)} (${benchmark.priceType.replaceAll(
            "_",
            " "
          )}).`
        : undefined;

  const pricePositioning =
    benchmark.sourceCategory === "official"
      ? ("parity" as const)
      : benchmark.sourceCategory === "commercial_database"
        ? ("premium" as const)
        : ("discount" as const);

  return {
    priceCorridor,
    primaryPriceBenchmark: `${formatCurrency(benchmark.amount, benchmark.currency)} · ${benchmark.priceType.replaceAll(
      "_",
      " "
    )} · ${benchmark.sourceCategory.replaceAll("_", " ")}`,
    competitivePriceSummary,
    pricePositioning,
  };
}

function summarizeCommercialSignals(signals: CommercialSignalDoc[]) {
  if (signals.length === 0) return undefined;
  return signals
    .slice()
    .sort((left, right) => right.observedAt - left.observedAt)
    .slice(0, 3)
    .map((signal) => `${signal.signalType.replaceAll("_", " ")}: ${signal.summary}`)
    .join(" ");
}

function deriveOpportunityKind(args: {
  opportunity?: OpportunityDoc | null;
  priceRows: PriceEvidenceDoc[];
  signals: CommercialSignalDoc[];
  tenderStrength: "high" | "medium" | "low" | "none";
  evidenceStatus: "strong" | "partial" | "proxy_only" | "insufficient";
}) {
  if (args.evidenceStatus === "insufficient") {
    return "insufficient_commercial_evidence" as const;
  }
  const tenderDriven =
    args.tenderStrength !== "none" ||
    args.opportunity?.marketAccessRoute === "public_tender" ||
    args.opportunity?.availabilityStatus === "tender_formulary_only";
  const commercialDriven =
    args.priceRows.length > 0 ||
    ["private_hospital", "retail_pharmacy", "specialty_center"].includes(
      args.opportunity?.marketAccessRoute ?? ""
    );

  if (tenderDriven && commercialDriven) return "commercial_and_tender" as const;
  if (tenderDriven) return "tender_opportunity" as const;
  if (commercialDriven) return "commercial_opportunity" as const;
  return "no_clear_opportunity" as const;
}

function computeCommercialOpportunityScore(args: {
  opportunity?: OpportunityDoc | null;
  pricingConfidence: "high" | "medium" | "low" | "unknown";
  tenderStrength: "high" | "medium" | "low" | "none";
  competitionIntensity: "low" | "medium" | "high" | "unknown";
  evidenceStatus: "strong" | "partial" | "proxy_only" | "insufficient";
}) {
  const base = args.opportunity?.opportunityScore ?? 5;
  const pricingBoost =
    args.pricingConfidence === "high"
      ? 1.4
      : args.pricingConfidence === "medium"
        ? 0.8
        : args.pricingConfidence === "low"
          ? 0.2
          : -0.4;
  const tenderBoost =
    args.tenderStrength === "high"
      ? 1.1
      : args.tenderStrength === "medium"
        ? 0.6
        : args.tenderStrength === "low"
          ? 0.2
          : 0;
  const competitionDrag =
    args.competitionIntensity === "high"
      ? -1.4
      : args.competitionIntensity === "medium"
        ? -0.7
        : args.competitionIntensity === "low"
          ? 0.4
          : 0;
  const evidenceAdjustment =
    args.evidenceStatus === "strong"
      ? 0.8
      : args.evidenceStatus === "partial"
        ? 0.2
        : args.evidenceStatus === "proxy_only"
          ? -0.3
          : -1;
  return clampScore(base + pricingBoost + tenderBoost + competitionDrag + evidenceAdjustment);
}

async function deriveCommercialSummary(
  ctx: QueryCtx | MutationCtx,
  drugId: Id<"drugs">,
  country: string,
  opportunity?: OpportunityDoc | null
) {
  const [priceRows, signals] = await Promise.all([
    ctx.db
      .query("priceEvidence")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .collect(),
    ctx.db
      .query("commercialSignals")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .collect(),
  ]);

  const pricingConfidence = getPricingConfidence(priceRows);
  const evidenceStatus = getCommercialEvidenceStatus(priceRows, signals);
  const tenderStrength = getTenderSignalStrength(signals);
  const competition = getCompetitionIntensity({ opportunity, signals });
  const priceSummary = summarizePriceRows(priceRows);
  const signalSummary = summarizeCommercialSignals(signals);
  const opportunityKind = deriveOpportunityKind({
    opportunity,
    priceRows,
    signals,
    tenderStrength,
    evidenceStatus,
  });

  const competitivePriceSummary = [priceSummary.competitivePriceSummary, signalSummary]
    .filter(Boolean)
    .join(" ");

  return {
    priceRows,
    signals,
    summary: {
      pricingConfidence,
      priceCorridor: priceSummary.priceCorridor,
      primaryPriceBenchmark: priceSummary.primaryPriceBenchmark,
      pricePositioning: priceSummary.pricePositioning,
      competitionIntensity: competition,
      competitivePriceSummary: competitivePriceSummary || undefined,
      tenderOpportunity: tenderStrength !== "none",
      tenderSignalStrength: tenderStrength,
      commercialEvidenceStatus: evidenceStatus,
      opportunityKind,
      commercialOpportunityScore: computeCommercialOpportunityScore({
        opportunity,
        pricingConfidence,
        tenderStrength,
        competitionIntensity: competition,
        evidenceStatus,
      }),
    },
  };
}

async function recomputeCommercialSummary(
  ctx: MutationCtx,
  drugId: Id<"drugs">,
  country: string,
  opts?: { force?: boolean }
) {
  const existing = await ctx.db
    .query("opportunities")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
    .unique();

  if (!existing) return null;
  if (existing.commercialSummaryMode === "manual" && !opts?.force) {
    return existing;
  }

  const { summary } = await deriveCommercialSummary(ctx, drugId, country, existing);
  await ctx.db.patch(existing._id, {
    ...summary,
    commercialSummaryMode: existing.commercialSummaryMode ?? "auto",
    updatedAt: Date.now(),
  });
  return await ctx.db.get(existing._id);
}

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) =>
    ctx.db
      .query("opportunities")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect(),
});

export const getByDrugAndCountry = query({
  args: { drugId: v.id("drugs"), country: v.string() },
  handler: async (ctx, { drugId, country }) =>
    ctx.db
      .query("opportunities")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .unique(),
});

export const listAllForEngine = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("opportunities").collect(),
});

export const listPriceEvidence = query({
  args: { drugId: v.id("drugs"), country: v.string() },
  handler: async (ctx, { drugId, country }) =>
    ctx.db
      .query("priceEvidence")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .collect(),
});

export const listCommercialSignals = query({
  args: { drugId: v.id("drugs"), country: v.string() },
  handler: async (ctx, { drugId, country }) =>
    ctx.db
      .query("commercialSignals")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .collect(),
});

export const summarizeByDrugAndCountry = query({
  args: { drugId: v.id("drugs"), country: v.string() },
  handler: async (ctx, { drugId, country }) => {
    const opportunity = await ctx.db
      .query("opportunities")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .unique();
    const { summary, priceRows, signals } = await deriveCommercialSummary(
      ctx,
      drugId,
      country,
      opportunity
    );
    return { summary, priceRows, signals, opportunity };
  },
});

export const upsert = mutation({
  args: {
    drugId: v.id("drugs"),
    country: v.string(),
    competitorPresence: v.optional(v.string()),
    regulatoryStatus: v.optional(v.string()),
    marketSizeEstimate: v.optional(v.string()),
    availabilityStatus: v.optional(AVAILABILITY_STATUS_VALIDATOR),
    matchedBrandName: v.optional(v.string()),
    matchedGenericName: v.optional(v.string()),
    genericEquivalentDetected: v.optional(v.boolean()),
    addressablePopulation: v.optional(v.string()),
    treatmentVolumeProxy: v.optional(v.string()),
    priceCorridor: v.optional(v.string()),
    primaryPriceBenchmark: v.optional(v.string()),
    pricingConfidence: v.optional(PRICING_CONFIDENCE_VALIDATOR),
    pricePositioning: v.optional(PRICE_POSITIONING_VALIDATOR),
    competitionIntensity: v.optional(COMPETITION_INTENSITY_VALIDATOR),
    competitivePriceSummary: v.optional(v.string()),
    tenderOpportunity: v.optional(v.boolean()),
    tenderSignalStrength: v.optional(TENDER_SIGNAL_STRENGTH_VALIDATOR),
    commercialEvidenceStatus: v.optional(COMMERCIAL_EVIDENCE_STATUS_VALIDATOR),
    opportunityKind: v.optional(OPPORTUNITY_KIND_VALIDATOR),
    commercialOpportunityScore: v.optional(v.number()),
    commercialSummaryMode: v.optional(COMMERCIAL_SUMMARY_MODE_VALIDATOR),
    annualOpportunityRange: v.optional(v.string()),
    publicChannelShare: v.optional(v.number()),
    privateChannelShare: v.optional(v.number()),
    countryScoreBreakdown: v.optional(COUNTRY_SCORE_BREAKDOWN_VALIDATOR),
    marketAccessRoute: v.optional(MARKET_ACCESS_ROUTE_VALIDATOR),
    marketAccessNotes: v.optional(v.string()),
    regulatoryTimeline: v.optional(v.string()),
    regulatoryRequirements: v.optional(v.array(v.string())),
    evidenceItems: v.optional(v.array(EVIDENCE_ITEM_VALIDATOR)),
    opportunityScore: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { drugId, country, ...fields }) => {
    const existing = await ctx.db
      .query("opportunities")
      .withIndex("by_drug_and_country", (q) =>
        q.eq("drugId", drugId).eq("country", country)
      )
      .unique();

    const manualMode =
      fields.commercialSummaryMode ??
      (fields.opportunityKind ||
      fields.pricingConfidence ||
      fields.primaryPriceBenchmark ||
      fields.pricePositioning ||
      fields.competitionIntensity ||
      fields.competitivePriceSummary ||
      fields.tenderOpportunity !== undefined ||
      fields.tenderSignalStrength ||
      fields.commercialEvidenceStatus ||
      fields.commercialOpportunityScore !== undefined
        ? "manual"
        : existing?.commercialSummaryMode ?? "auto");

    let opportunityId: Id<"opportunities">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        commercialSummaryMode: manualMode,
        updatedAt: Date.now(),
      });
      opportunityId = existing._id;
    } else {
      opportunityId = await ctx.db.insert("opportunities", {
        drugId,
        country,
        ...fields,
        commercialSummaryMode: manualMode,
        updatedAt: Date.now(),
      });
    }

    if (manualMode !== "manual") {
      await recomputeCommercialSummary(ctx, drugId, country);
    }
    return opportunityId;
  },
});

export const upsertPriceEvidence = mutation({
  args: {
    id: v.optional(v.id("priceEvidence")),
    drugId: v.id("drugs"),
    country: v.string(),
    sourceCategory: SOURCE_CATEGORY_VALIDATOR,
    sourceSystem: SOURCE_SYSTEM_VALIDATOR,
    priceType: PRICE_TYPE_VALIDATOR,
    amount: v.number(),
    currency: v.string(),
    presentation: v.optional(v.string()),
    unitBasis: v.optional(v.string()),
    observedAt: v.number(),
    sourceTitle: v.string(),
    sourceUrl: v.optional(v.string()),
    confidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("inferred")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let recordId: Id<"priceEvidence">;
    if (args.id) {
      await ctx.db.patch(args.id, {
        ...args,
        updatedAt: now,
      });
      recordId = args.id;
    } else {
      recordId = await ctx.db.insert("priceEvidence", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
    await recomputeCommercialSummary(ctx, args.drugId, args.country);
    return recordId;
  },
});

export const deletePriceEvidence = mutation({
  args: { id: v.id("priceEvidence") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await ctx.db.delete(id);
    await recomputeCommercialSummary(ctx, existing.drugId, existing.country);
  },
});

export const upsertCommercialSignal = mutation({
  args: {
    id: v.optional(v.id("commercialSignals")),
    drugId: v.id("drugs"),
    country: v.string(),
    signalType: SIGNAL_TYPE_VALIDATOR,
    sourceCategory: SOURCE_CATEGORY_VALIDATOR,
    sourceSystem: SOURCE_SYSTEM_VALIDATOR,
    summary: v.string(),
    signalStrength: SIGNAL_STRENGTH_VALIDATOR,
    sourceTitle: v.string(),
    sourceUrl: v.optional(v.string()),
    observedAt: v.number(),
    confidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("inferred")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let recordId: Id<"commercialSignals">;
    if (args.id) {
      await ctx.db.patch(args.id, {
        ...args,
        updatedAt: now,
      });
      recordId = args.id;
    } else {
      recordId = await ctx.db.insert("commercialSignals", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
    await recomputeCommercialSummary(ctx, args.drugId, args.country);
    return recordId;
  },
});

export const deleteCommercialSignal = mutation({
  args: { id: v.id("commercialSignals") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    await ctx.db.delete(id);
    await recomputeCommercialSummary(ctx, existing.drugId, existing.country);
  },
});

export const recomputeCommercialSummaryForDrugCountry = mutation({
  args: {
    drugId: v.id("drugs"),
    country: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { drugId, country, force }) => {
    return await recomputeCommercialSummary(ctx, drugId, country, { force });
  },
});

export const importPriceEvidence = mutation({
  args: {
    records: v.array(
      v.object({
        drugId: v.id("drugs"),
        country: v.string(),
        sourceCategory: SOURCE_CATEGORY_VALIDATOR,
        sourceSystem: SOURCE_SYSTEM_VALIDATOR,
        priceType: PRICE_TYPE_VALIDATOR,
        amount: v.number(),
        currency: v.string(),
        presentation: v.optional(v.string()),
        unitBasis: v.optional(v.string()),
        observedAt: v.number(),
        sourceTitle: v.string(),
        sourceUrl: v.optional(v.string()),
        confidence: v.union(
          v.literal("confirmed"),
          v.literal("likely"),
          v.literal("inferred")
        ),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { records }) => {
    const touched = new Set<string>();
    for (const record of records) {
      await ctx.runMutation(api.opportunities.upsertPriceEvidence, record);
      touched.add(`${record.drugId}:${record.country}`);
    }
    return { imported: records.length, touched: touched.size };
  },
});

export const importCommercialSignals = mutation({
  args: {
    records: v.array(
      v.object({
        drugId: v.id("drugs"),
        country: v.string(),
        signalType: SIGNAL_TYPE_VALIDATOR,
        sourceCategory: SOURCE_CATEGORY_VALIDATOR,
        sourceSystem: SOURCE_SYSTEM_VALIDATOR,
        summary: v.string(),
        signalStrength: SIGNAL_STRENGTH_VALIDATOR,
        sourceTitle: v.string(),
        sourceUrl: v.optional(v.string()),
        observedAt: v.number(),
        confidence: v.union(
          v.literal("confirmed"),
          v.literal("likely"),
          v.literal("inferred")
        ),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { records }) => {
    const touched = new Set<string>();
    for (const record of records) {
      await ctx.runMutation(api.opportunities.upsertCommercialSignal, record);
      touched.add(`${record.drugId}:${record.country}`);
    }
    return { imported: records.length, touched: touched.size };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("opportunities").collect();
    const scored = all.filter(
      (o) => o.opportunityScore !== undefined && o.opportunityScore >= 7
    );
    const tenderDriven = all.filter(
      (o) => o.opportunityKind === "tender_opportunity" || o.opportunityKind === "commercial_and_tender"
    ).length;
    return {
      total: all.length,
      highOpportunity: scored.length,
      tenderDriven,
    };
  },
});
