import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) =>
    ctx.db
      .query("opportunities")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect(),
});

export const listAllForEngine = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("opportunities").collect(),
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

    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updatedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("opportunities", {
      drugId,
      country,
      ...fields,
      updatedAt: Date.now(),
    });
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("opportunities").collect();
    const scored = all.filter(
      (o) => o.opportunityScore !== undefined && o.opportunityScore >= 7
    );
    return { total: all.length, highOpportunity: scored.length };
  },
});
