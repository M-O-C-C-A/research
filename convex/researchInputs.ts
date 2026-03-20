import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) =>
    ctx.db
      .query("researchInputs")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .order("desc")
      .collect(),
});

export const add = mutation({
  args: {
    drugId: v.id("drugs"),
    title: v.string(),
    sourceType: v.union(
      v.literal("pdf"),
      v.literal("image"),
      v.literal("text")
    ),
    content: v.string(),
    seedTerms: v.optional(v.array(v.string())),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("researchInputs", {
      ...args,
      seedTerms: args.seedTerms ?? [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("researchInputs") },
  handler: async (ctx, { id }) => {
    const input = await ctx.db.get(id);
    if (input?.storageId) {
      await ctx.storage.delete(input.storageId);
    }
    await ctx.db.delete(id);
  },
});
