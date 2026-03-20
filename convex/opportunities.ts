import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) =>
    ctx.db
      .query("opportunities")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect(),
});

export const upsert = mutation({
  args: {
    drugId: v.id("drugs"),
    country: v.string(),
    competitorPresence: v.optional(v.string()),
    regulatoryStatus: v.optional(v.string()),
    marketSizeEstimate: v.optional(v.string()),
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
