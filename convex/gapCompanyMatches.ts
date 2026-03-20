import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByGap = query({
  args: { gapOpportunityId: v.id("gapOpportunities"), limit: v.optional(v.number()) },
  handler: async (ctx, { gapOpportunityId, limit }) => {
    const matches = await ctx.db
      .query("gapCompanyMatches")
      .withIndex("by_gap_opportunity", (q) =>
        q.eq("gapOpportunityId", gapOpportunityId)
      )
      .collect();

    const enriched = await Promise.all(
      matches.map(async (match) => ({
        ...match,
        company: await ctx.db.get(match.companyId),
      }))
    );

    return enriched
      .filter((entry) => entry.company !== null)
      .sort((a, b) => b.distributorFitScore - a.distributorFitScore)
      .slice(0, limit ?? 50);
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies"), limit: v.optional(v.number()) },
  handler: async (ctx, { companyId, limit }) => {
    const matches = await ctx.db
      .query("gapCompanyMatches")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    const enriched = await Promise.all(
      matches.map(async (match) => ({
        ...match,
        gap: await ctx.db.get(match.gapOpportunityId),
      }))
    );

    return enriched
      .filter((entry) => entry.gap !== null)
      .sort((a, b) => b.distributorFitScore - a.distributorFitScore)
      .slice(0, limit ?? 20);
  },
});

export const upsert = mutation({
  args: {
    gapOpportunityId: v.id("gapOpportunities"),
    companyId: v.id("companies"),
    distributorFitScore: v.number(),
    rationale: v.string(),
    overlapSummary: v.optional(v.string()),
    overlappingDrugClasses: v.optional(v.array(v.string())),
    targetCountries: v.array(v.string()),
    estimatedEaseOfEntry: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    competitiveWhitespace: v.optional(v.string()),
    recommendedFirstOutreachAngle: v.optional(v.string()),
    confidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    evidenceLinks: v.optional(
      v.array(v.object({ title: v.string(), url: v.string() }))
    ),
    priorityTier: v.optional(
      v.union(
        v.literal("tier_1"),
        v.literal("tier_2"),
        v.literal("tier_3"),
        v.literal("deprioritized")
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gapCompanyMatches")
      .withIndex("by_gap_opportunity_and_company", (q) =>
        q.eq("gapOpportunityId", args.gapOpportunityId).eq("companyId", args.companyId)
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("gapCompanyMatches", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});
