import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = therapeuticArea
      ? await ctx.db
          .query("drugs")
          .withIndex("by_therapeutic_area", (q) =>
            q.eq("therapeuticArea", therapeuticArea)
          )
          .collect()
      : await ctx.db.query("drugs").collect();

    if (!search) return rows;
    const term = search.toLowerCase();
    return rows.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.genericName.toLowerCase().includes(term) ||
        d.indication.toLowerCase().includes(term)
    );
  },
});

export const listEnriched = query({
  args: {
    search: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, { search, therapeuticArea }) => {
    const rows = therapeuticArea
      ? await ctx.db
          .query("drugs")
          .withIndex("by_therapeutic_area", (q) =>
            q.eq("therapeuticArea", therapeuticArea)
          )
          .collect()
      : await ctx.db.query("drugs").collect();

    const filtered = search
      ? rows.filter((d) => {
          const term = search.toLowerCase();
          return (
            d.name.toLowerCase().includes(term) ||
            d.genericName.toLowerCase().includes(term) ||
            d.indication.toLowerCase().includes(term)
          );
        })
      : rows;

    return Promise.all(
      filtered.map(async (d) => {
        const company = d.companyId ? await ctx.db.get(d.companyId) : null;
        return {
          ...d,
          companyName: company?.name ?? d.manufacturerName ?? "—",
        };
      })
    );
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) =>
    ctx.db
      .query("drugs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect(),
});

export const get = query({
  args: { id: v.id("drugs") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    companyId: v.optional(v.id("companies")),
    manufacturerName: v.optional(v.string()),
    name: v.string(),
    genericName: v.string(),
    therapeuticArea: v.string(),
    indication: v.string(),
    mechanism: v.optional(v.string()),
    approvalStatus: v.union(
      v.literal("approved"),
      v.literal("pending"),
      v.literal("withdrawn")
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("drugs", { ...args, status: "active" }),
});

export const update = mutation({
  args: {
    id: v.id("drugs"),
    name: v.optional(v.string()),
    genericName: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    indication: v.optional(v.string()),
    mechanism: v.optional(v.string()),
    approvalStatus: v.optional(
      v.union(
        v.literal("approved"),
        v.literal("pending"),
        v.literal("withdrawn")
      )
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    manufacturerName: v.optional(v.string()),
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const updateMenaRegistrations = mutation({
  args: {
    id: v.id("drugs"),
    menaRegistrations: v.array(v.object({
      country: v.string(),
      status: v.union(v.literal("registered"), v.literal("not_found"), v.literal("unverified")),
      registrationNumber: v.optional(v.string()),
      source: v.string(),
      url: v.optional(v.string()),
      verifiedAt: v.number(),
    })),
    menaRegistrationCount: v.optional(v.number()),
  },
  handler: async (ctx, { id, menaRegistrations, menaRegistrationCount }) => {
    await ctx.db.patch(id, { menaRegistrations, menaRegistrationCount });
  },
});

export const listWithPatentUrgency = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("drugs").take(limit ?? 100);
    return all
      .filter((d) => d.patentExpiryYear != null)
      .sort((a, b) => (a.patentExpiryYear ?? 9999) - (b.patentExpiryYear ?? 9999));
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("drugs").collect();
    return { total: all.length };
  },
});
