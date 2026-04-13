import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  buildGapDedupeKey,
  mergeMultilineText,
  mergeUniqueStrings,
} from "./gapIdentity";

function mergeSources(
  existing?: Array<{ title: string; url: string }>,
  incoming?: Array<{ title: string; url: string }>
) {
  const all = [...(existing ?? []), ...(incoming ?? [])];
  return [...new Map(all.map((item) => [item.url, item])).values()];
}

type EvidenceSourceKind =
  | "official_registry"
  | "ema"
  | "government_publication"
  | "tender_portal"
  | "who_or_gbd"
  | "market_report"
  | "pubmed"
  | "clinical_trial";

type EvidenceItem = {
  claim: string;
  title: string;
  url: string;
  sourceKind: EvidenceSourceKind;
  country?: string;
  productOrClass?: string;
  confidence: "confirmed" | "likely" | "inferred";
};

function mergeEvidenceItems(
  existing?: EvidenceItem[],
  incoming?: EvidenceItem[]
) {
  const all = [...(existing ?? []), ...(incoming ?? [])];
  return [
    ...new Map(
      all.map((item) => [
        `${item.url}|${item.claim}|${item.country ?? ""}|${item.productOrClass ?? ""}`,
        item,
      ])
    ).values(),
  ];
}

export const list = query({
  args: {
    therapeuticArea: v.optional(v.string()),
    analysisLens: v.optional(v.union(
      v.literal("demand_led"),
      v.literal("product_led"),
      v.literal("mixed")
    )),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { therapeuticArea, analysisLens, status, limit }) => {
    const effectiveStatus = status ?? "active";
    if (therapeuticArea) {
      const results = await ctx.db
        .query("gapOpportunities")
        .withIndex("by_therapeutic_area", (q) =>
          q.eq("therapeuticArea", therapeuticArea)
        )
        .order("desc")
        .take(limit ?? 100);
      return results.filter(
        (r) =>
          r.status === effectiveStatus &&
          (!analysisLens || r.analysisLens === analysisLens)
      );
    }
    if (analysisLens) {
      const results = await ctx.db
        .query("gapOpportunities")
        .withIndex("by_analysis_lens", (q) => q.eq("analysisLens", analysisLens))
        .order("desc")
        .take(limit ?? 100);
      return results.filter((r) => r.status === effectiveStatus);
    }
    return await ctx.db
      .query("gapOpportunities")
      .withIndex("by_status", (q) => q.eq("status", effectiveStatus))
      .order("desc")
      .take(limit ?? 100);
  },
});

export const listTop = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_gap_score")
      .order("desc")
      .take(50);
    return all
      .filter((r) => r.status === "active")
      .slice(0, limit ?? 10);
  },
});

export const get = query({
  args: { id: v.id("gapOpportunities") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listByCanonicalProduct = query({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, { canonicalProductId, status }) => {
    const effectiveStatus = status ?? "active";
    const rows = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_canonical_product", (q) =>
        q.eq("canonicalProductId", canonicalProductId)
      )
      .collect();
    return rows
      .filter((row) => row.status === effectiveStatus)
      .sort((left, right) => right.gapScore - left.gapScore);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const total = active.length;
    const avgScore =
      total > 0
        ? active.reduce((sum, r) => sum + r.gapScore, 0) / total
        : 0;
    const byArea: Record<string, number> = {};
    for (const r of active) {
      byArea[r.therapeuticArea] = (byArea[r.therapeuticArea] ?? 0) + 1;
    }
    return { total, avgScore, byArea };
  },
});

export const create = mutation({
  args: {
    therapeuticArea: v.string(),
    indication: v.string(),
    targetCountries: v.array(v.string()),
    gapScore: v.number(),
    analysisLens: v.optional(v.union(
      v.literal("demand_led"),
      v.literal("product_led"),
      v.literal("mixed")
    )),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    gapType: v.optional(v.union(
      v.literal("regulatory_gap"),
      v.literal("formulary_gap"),
      v.literal("shortage_gap"),
      v.literal("tender_pull"),
      v.literal("channel_whitespace")
    )),
    productGapKind: v.optional(v.union(
      v.literal("fda_absent_mena"),
      v.literal("ema_absent_mena"),
      v.literal("fda_ema_absent_mena"),
      v.literal("different_brand_present"),
      v.literal("generic_present"),
      v.literal("off_patent"),
      v.literal("near_patent_expiry"),
      v.literal("biosimilar_opportunity"),
      v.literal("reference_biologic_opportunity"),
      v.literal("unclear_presence")
    )),
    validationStatus: v.optional(v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("insufficient_evidence")
    )),
    evidenceSummary: v.optional(v.string()),
    verifiedRegisteredCount: v.optional(v.number()),
    verifiedMissingCount: v.optional(v.number()),
    companyFootprintStatus: v.optional(v.union(
      v.literal("clean_whitespace"),
      v.literal("regional_representation_detected"),
      v.literal("portfolio_presence_detected"),
      v.literal("regional_representation_and_portfolio_presence"),
      v.literal("unclear_company_presence")
    )),
    companyFootprintReason: v.optional(v.string()),
    companyFootprintCountries: v.optional(v.array(v.string())),
    companyPortfolioPresenceCount: v.optional(v.number()),
    demandEvidence: v.string(),
    supplyGap: v.string(),
    competitorLandscape: v.string(),
    suggestedDrugClasses: v.array(v.string()),
    tenderSignals: v.optional(v.string()),
    whoDiseaseBurden: v.optional(v.string()),
    regulatoryFeasibility: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    sources: v.optional(
      v.array(v.object({ title: v.string(), url: v.string() }))
    ),
    evidenceItems: v.optional(v.array(v.object({
      claim: v.string(),
      title: v.string(),
      url: v.string(),
      sourceKind: v.union(
        v.literal("official_registry"),
        v.literal("ema"),
        v.literal("government_publication"),
        v.literal("tender_portal"),
        v.literal("who_or_gbd"),
        v.literal("market_report"),
        v.literal("pubmed"),
        v.literal("clinical_trial")
      ),
      country: v.optional(v.string()),
      productOrClass: v.optional(v.string()),
      confidence: v.union(
        v.literal("confirmed"),
        v.literal("likely"),
        v.literal("inferred")
      ),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dedupeKey = buildGapDedupeKey(args);
    const existingByDedupe = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_status_and_dedupe_key", (q) =>
        q.eq("status", "active").eq("dedupeKey", dedupeKey)
      )
      .unique();
    const existingByCanonical = args.canonicalProductId
      ? (
        await ctx.db
          .query("gapOpportunities")
          .withIndex("by_canonical_product", (q) =>
            q.eq("canonicalProductId", args.canonicalProductId)
          )
          .collect()
      ).find(
        (row) =>
          row.status === "active" &&
          row.targetCountries.join("|") === args.targetCountries.join("|")
      )
      : null;
    const existing = existingByDedupe ?? existingByCanonical;

    if (existing) {
      const mergedAnalysisLens =
        existing.analysisLens && args.analysisLens && existing.analysisLens !== args.analysisLens
          ? "mixed"
          : (args.analysisLens ?? existing.analysisLens);
      await ctx.db.patch(existing._id, {
        therapeuticArea: args.therapeuticArea,
        indication: args.indication,
        targetCountries: mergeUniqueStrings([
          ...existing.targetCountries,
          ...args.targetCountries,
        ]),
        gapScore: Math.max(existing.gapScore, args.gapScore),
        analysisLens: mergedAnalysisLens,
        canonicalProductId: args.canonicalProductId ?? existing.canonicalProductId,
        gapType: args.gapType ?? existing.gapType,
        productGapKind: args.productGapKind ?? existing.productGapKind,
        validationStatus:
          args.validationStatus === "confirmed" ||
          existing.validationStatus !== "confirmed"
            ? (args.validationStatus ?? existing.validationStatus)
            : existing.validationStatus,
        evidenceSummary:
          mergeMultilineText(existing.evidenceSummary, args.evidenceSummary) ??
          existing.evidenceSummary,
        verifiedRegisteredCount: Math.max(
          existing.verifiedRegisteredCount ?? 0,
          args.verifiedRegisteredCount ?? 0
        ),
        verifiedMissingCount: Math.max(
          existing.verifiedMissingCount ?? 0,
          args.verifiedMissingCount ?? 0
        ),
        companyFootprintStatus: args.companyFootprintStatus ?? existing.companyFootprintStatus,
        companyFootprintReason:
          mergeMultilineText(existing.companyFootprintReason, args.companyFootprintReason) ??
          existing.companyFootprintReason,
        companyFootprintCountries: mergeUniqueStrings([
          ...(existing.companyFootprintCountries ?? []),
          ...(args.companyFootprintCountries ?? []),
        ]),
        companyPortfolioPresenceCount: Math.max(
          existing.companyPortfolioPresenceCount ?? 0,
          args.companyPortfolioPresenceCount ?? 0
        ),
        demandEvidence: mergeMultilineText(existing.demandEvidence, args.demandEvidence),
        supplyGap: mergeMultilineText(existing.supplyGap, args.supplyGap) ?? existing.supplyGap,
        competitorLandscape:
          mergeMultilineText(existing.competitorLandscape, args.competitorLandscape) ??
          existing.competitorLandscape,
        suggestedDrugClasses: mergeUniqueStrings([
          ...existing.suggestedDrugClasses,
          ...args.suggestedDrugClasses,
        ]),
        tenderSignals: mergeMultilineText(existing.tenderSignals, args.tenderSignals),
        whoDiseaseBurden: mergeMultilineText(existing.whoDiseaseBurden, args.whoDiseaseBurden),
        regulatoryFeasibility: args.regulatoryFeasibility ?? existing.regulatoryFeasibility,
        sources: mergeSources(existing.sources, args.sources),
        evidenceItems: mergeEvidenceItems(existing.evidenceItems, args.evidenceItems),
        dedupeKey,
        linkedDrugIds: existing.linkedDrugIds,
        linkedCompanyIds: existing.linkedCompanyIds,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("gapOpportunities", {
      ...args,
      status: "active",
      dedupeKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("gapOpportunities"),
    therapeuticArea: v.optional(v.string()),
    indication: v.optional(v.string()),
    targetCountries: v.optional(v.array(v.string())),
    gapScore: v.optional(v.number()),
    analysisLens: v.optional(v.union(
      v.literal("demand_led"),
      v.literal("product_led"),
      v.literal("mixed")
    )),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    gapType: v.optional(v.union(
      v.literal("regulatory_gap"),
      v.literal("formulary_gap"),
      v.literal("shortage_gap"),
      v.literal("tender_pull"),
      v.literal("channel_whitespace")
    )),
    productGapKind: v.optional(v.union(
      v.literal("fda_absent_mena"),
      v.literal("ema_absent_mena"),
      v.literal("fda_ema_absent_mena"),
      v.literal("different_brand_present"),
      v.literal("generic_present"),
      v.literal("off_patent"),
      v.literal("near_patent_expiry"),
      v.literal("biosimilar_opportunity"),
      v.literal("reference_biologic_opportunity"),
      v.literal("unclear_presence")
    )),
    validationStatus: v.optional(v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("insufficient_evidence")
    )),
    evidenceSummary: v.optional(v.string()),
    verifiedRegisteredCount: v.optional(v.number()),
    verifiedMissingCount: v.optional(v.number()),
    companyFootprintStatus: v.optional(v.union(
      v.literal("clean_whitespace"),
      v.literal("regional_representation_detected"),
      v.literal("portfolio_presence_detected"),
      v.literal("regional_representation_and_portfolio_presence"),
      v.literal("unclear_company_presence")
    )),
    companyFootprintReason: v.optional(v.string()),
    companyFootprintCountries: v.optional(v.array(v.string())),
    companyPortfolioPresenceCount: v.optional(v.number()),
    demandEvidence: v.optional(v.string()),
    supplyGap: v.optional(v.string()),
    competitorLandscape: v.optional(v.string()),
    suggestedDrugClasses: v.optional(v.array(v.string())),
    tenderSignals: v.optional(v.string()),
    whoDiseaseBurden: v.optional(v.string()),
    regulatoryFeasibility: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    lastEnrichedAt: v.optional(v.number()),
    sources: v.optional(
      v.array(v.object({ title: v.string(), url: v.string() }))
    ),
    evidenceItems: v.optional(v.array(v.object({
      claim: v.string(),
      title: v.string(),
      url: v.string(),
      sourceKind: v.union(
        v.literal("official_registry"),
        v.literal("ema"),
        v.literal("government_publication"),
        v.literal("tender_portal"),
        v.literal("who_or_gbd"),
        v.literal("market_report"),
        v.literal("pubmed"),
        v.literal("clinical_trial")
      ),
      country: v.optional(v.string()),
      productOrClass: v.optional(v.string()),
      confidence: v.union(
        v.literal("confirmed"),
        v.literal("likely"),
        v.literal("inferred")
      ),
    }))),
  },
  handler: async (ctx, { id, ...fields }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return;
    const nextTherapeuticArea = fields.therapeuticArea ?? existing.therapeuticArea;
    const nextIndication = fields.indication ?? existing.indication;
    const nextTargetCountries = fields.targetCountries ?? existing.targetCountries;
    await ctx.db.patch(id, {
      ...fields,
      dedupeKey: buildGapDedupeKey({
        therapeuticArea: nextTherapeuticArea,
        indication: nextIndication,
        targetCountries: nextTargetCountries,
        canonicalProductId: fields.canonicalProductId ?? existing.canonicalProductId,
        productGapKind: fields.productGapKind ?? existing.productGapKind,
      }),
      updatedAt: Date.now(),
    });
  },
});

export const linkDrug = mutation({
  args: { id: v.id("gapOpportunities"), drugId: v.id("drugs") },
  handler: async (ctx, { id, drugId }) => {
    const gap = await ctx.db.get(id);
    if (!gap) return;
    const existing = gap.linkedDrugIds ?? [];
    if (!existing.includes(drugId)) {
      await ctx.db.patch(id, {
        linkedDrugIds: [...existing, drugId],
        updatedAt: Date.now(),
      });
    }
  },
});

export const linkCompany = mutation({
  args: { id: v.id("gapOpportunities"), companyId: v.id("companies") },
  handler: async (ctx, { id, companyId }) => {
    const gap = await ctx.db.get(id);
    if (!gap) return;
    const existing = gap.linkedCompanyIds ?? [];
    if (!existing.includes(companyId)) {
      await ctx.db.patch(id, {
        linkedCompanyIds: [...existing, companyId],
        updatedAt: Date.now(),
      });
    }
  },
});
