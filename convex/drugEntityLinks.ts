import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const relationshipTypeValidator = v.union(
  v.literal("manufacturer"),
  v.literal("market_authorization_holder"),
  v.literal("licensor"),
  v.literal("regional_partner"),
  v.literal("distributor")
);

const confidenceValidator = v.union(
  v.literal("confirmed"),
  v.literal("likely"),
  v.literal("inferred")
);

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) => {
    const links = await ctx.db
      .query("drugEntityLinks")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect();

    return await Promise.all(
      links.map(async (link) => ({
        ...link,
        company: link.companyId ? await ctx.db.get(link.companyId) : null,
      }))
    );
  },
});

export const replaceForDrug = mutation({
  args: {
    drugId: v.id("drugs"),
    links: v.array(
      v.object({
        companyId: v.optional(v.id("companies")),
        entityName: v.optional(v.string()),
        relationshipType: relationshipTypeValidator,
        jurisdiction: v.optional(v.string()),
        isPrimary: v.boolean(),
        notes: v.optional(v.string()),
        source: v.optional(v.string()),
        url: v.optional(v.string()),
        confidence: confidenceValidator,
      })
    ),
  },
  handler: async (ctx, { drugId, links }) => {
    const existing = await ctx.db
      .query("drugEntityLinks")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect();

    for (const link of existing) {
      await ctx.db.delete(link._id);
    }

    const now = Date.now();
    for (const link of links) {
      if (!link.companyId && !link.entityName) {
        continue;
      }
      await ctx.db.insert("drugEntityLinks", {
        drugId,
        ...link,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
