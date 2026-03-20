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
    // BD fields
    bdStatus: v.optional(v.union(
      v.literal("prospect"),
      v.literal("contacted"),
      v.literal("engaged"),
      v.literal("negotiating"),
      v.literal("contracted"),
      v.literal("disqualified"),
    )),
    bdScore: v.optional(v.number()),
    bdScoreRationale: v.optional(v.string()),
    companySize: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaPresence: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    revenueEstimate: v.optional(v.string()),
    employeeCount: v.optional(v.string()),
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
    // BD fields
    bdStatus: v.optional(v.union(
      v.literal("prospect"),
      v.literal("contacted"),
      v.literal("engaged"),
      v.literal("negotiating"),
      v.literal("contracted"),
      v.literal("disqualified"),
    )),
    bdScore: v.optional(v.number()),
    bdScoreRationale: v.optional(v.string()),
    companySize: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaPresence: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    revenueEstimate: v.optional(v.string()),
    employeeCount: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    bdNotes: v.optional(v.string()),
    bdScoredAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

// Atomic stage change + activity log
export const moveStage = mutation({
  args: {
    id: v.id("companies"),
    newStatus: v.union(
      v.literal("prospect"),
      v.literal("contacted"),
      v.literal("engaged"),
      v.literal("negotiating"),
      v.literal("contracted"),
      v.literal("disqualified"),
    ),
  },
  handler: async (ctx, { id, newStatus }) => {
    const company = await ctx.db.get(id);
    if (!company) return;
    const previousStage = company.bdStatus ?? "prospect";
    await ctx.db.patch(id, { bdStatus: newStatus });
    await ctx.db.insert("bdActivities", {
      companyId: id,
      type: "stage_change",
      content: `Moved from ${previousStage} to ${newStatus}`,
      previousStage,
      newStage: newStatus,
      createdAt: Date.now(),
    });
  },
});

export const listByBdStatus = query({
  args: {
    bdStatus: v.union(
      v.literal("prospect"),
      v.literal("contacted"),
      v.literal("engaged"),
      v.literal("negotiating"),
      v.literal("contracted"),
      v.literal("disqualified"),
    ),
  },
  handler: async (ctx, { bdStatus }) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_bd_status", (q) => q.eq("bdStatus", bdStatus))
      .collect();
  },
});

export const listTopBdScored = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_bd_score")
      .order("desc")
      .take(limit ?? 10);
  },
});

export const pipelineStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("companies").collect();
    const counts: Record<string, number> = {
      prospect: 0,
      contacted: 0,
      engaged: 0,
      negotiating: 0,
      contracted: 0,
      disqualified: 0,
      unset: 0,
    };
    for (const c of all) {
      const stage = c.bdStatus ?? "prospect";
      counts[stage] = (counts[stage] ?? 0) + 1;
    }
    const activeCount = (counts.engaged ?? 0) + (counts.negotiating ?? 0);
    return { counts, total: all.length, activeCount };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("companies").collect();
    return { total: all.length };
  },
});

export const listByIds = query({
  args: { ids: v.array(v.id("companies")) },
  handler: async (ctx, { ids }) => {
    const results = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return results.filter((r): r is NonNullable<typeof r> => r != null);
  },
});
