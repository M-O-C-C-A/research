import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const all = await ctx.db.query("companies").order("asc").collect();
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.therapeuticAreas.some((a) => a.toLowerCase().includes(q))
    );
  },
});

export const get = query({
  args: { id: v.id("companies") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    name: v.string(),
    country: v.string(),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    therapeuticAreas: v.array(v.string()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("companies", { ...args, status: "active" }),
});

export const update = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    therapeuticAreas: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("companies").collect();
    return { total: all.length };
  },
});
