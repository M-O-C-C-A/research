import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    companyId: v.id("companies"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { companyId, limit }) => {
    const results = await ctx.db
      .query("bdActivities")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .order("desc")
      .take(limit ?? 50);
    return results;
  },
});

export const create = mutation({
  args: {
    companyId: v.id("companies"),
    type: v.union(
      v.literal("note"),
      v.literal("email_sent"),
      v.literal("email_received"),
      v.literal("call"),
      v.literal("meeting"),
      v.literal("stage_change"),
      v.literal("deal_update"),
      v.literal("outreach_update"),
      v.literal("regulatory_follow_up"),
    ),
    content: v.string(),
    previousStage: v.optional(v.string()),
    newStage: v.optional(v.string()),
    dealValue: v.optional(v.number()),
    outreachAngle: v.optional(v.string()),
    countryInterest: v.optional(v.array(v.string())),
    documentsRequested: v.optional(v.array(v.string())),
    exclusivityInterest: v.optional(v.string()),
    regulatoryFollowUp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bdActivities", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("bdActivities") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
