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

function mergeEvidenceItems(
  existing?: Array<{
    claim: string;
    title: string;
    url: string;
    sourceKind:
      | "official_registry"
      | "ema"
      | "government_publication"
      | "tender_portal"
      | "who_or_gbd"
      | "market_report";
    country?: string;
    productOrClass?: string;
    confidence: "confirmed" | "likely" | "inferred";
  }>,
  incoming?: Array<{
    claim: string;
    title: string;
    url: string;
    sourceKind:
      | "official_registry"
      | "ema"
      | "government_publication"
      | "tender_portal"
      | "who_or_gbd"
      | "market_report";
    country?: string;
    productOrClass?: string;
    confidence: "confirmed" | "likely" | "inferred";
  }>
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
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { therapeuticArea, status, limit }) => {
    const effectiveStatus = status ?? "active";
    if (therapeuticArea) {
      const results = await ctx.db
        .query("gapOpportunities")
        .withIndex("by_therapeutic_area", (q) =>
          q.eq("therapeuticArea", therapeuticArea)
        )
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
    gapType: v.optional(v.union(
      v.literal("regulatory_gap"),
      v.literal("formulary_gap"),
      v.literal("shortage_gap"),
      v.literal("tender_pull"),
      v.literal("channel_whitespace")
    )),
    validationStatus: v.optional(v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("insufficient_evidence")
    )),
    evidenceSummary: v.optional(v.string()),
    verifiedRegisteredCount: v.optional(v.number()),
    verifiedMissingCount: v.optional(v.number()),
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
        v.literal("market_report")
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
    const existing = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_status_and_dedupe_key", (q) =>
        q.eq("status", "active").eq("dedupeKey", dedupeKey)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        therapeuticArea: args.therapeuticArea,
        indication: args.indication,
        targetCountries: mergeUniqueStrings([
          ...existing.targetCountries,
          ...args.targetCountries,
        ]),
        gapScore: Math.max(existing.gapScore, args.gapScore),
        gapType: args.gapType ?? existing.gapType,
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
    gapType: v.optional(v.union(
      v.literal("regulatory_gap"),
      v.literal("formulary_gap"),
      v.literal("shortage_gap"),
      v.literal("tender_pull"),
      v.literal("channel_whitespace")
    )),
    validationStatus: v.optional(v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("insufficient_evidence")
    )),
    evidenceSummary: v.optional(v.string()),
    verifiedRegisteredCount: v.optional(v.number()),
    verifiedMissingCount: v.optional(v.number()),
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
        v.literal("market_report")
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
