import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) =>
    ctx.db
      .query("reports")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .unique(),
});

export const upsert = mutation({
  args: {
    drugId: v.id("drugs"),
    content: v.optional(v.string()),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    sources: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, { drugId, ...fields }) => {
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...fields,
        updatedAt: now,
        ...(fields.status === "ready" ? { generatedAt: now } : {}),
      });
      return existing._id;
    }
    return ctx.db.insert("reports", {
      drugId,
      ...fields,
      updatedAt: now,
      ...(fields.status === "ready" ? { generatedAt: now } : {}),
    });
  },
});
