import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    therapeuticArea: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { therapeuticArea, status, limit }) => {
    const effectiveStatus = status ?? "active";
    if (therapeuticArea) {
      const results = await ctx.db
        .query("gapOpportunities")
        .withIndex("by_therapeutic_area", (q) =>
          q.eq("therapeuticArea", therapeuticArea)
        )
        .order("desc")
        .take(limit ?? 100);
      return results.filter((r) => r.status === effectiveStatus);
    }
    return await ctx.db
      .query("gapOpportunities")
      .withIndex("by_status", (q) => q.eq("status", effectiveStatus))
      .order("desc")
      .take(limit ?? 100);
  },
});

export const listTop = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_gap_score")
      .order("desc")
      .take(50);
    return all
      .filter((r) => r.status === "active")
      .slice(0, limit ?? 10);
  },
});

export const get = query({
  args: { id: v.id("gapOpportunities") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const total = active.length;
    const avgScore =
      total > 0
        ? active.reduce((sum, r) => sum + r.gapScore, 0) / total
        : 0;
    const byArea: Record<string, number> = {};
    for (const r of active) {
      byArea[r.therapeuticArea] = (byArea[r.therapeuticArea] ?? 0) + 1;
    }
    return { total, avgScore, byArea };
  },
});

export const create = mutation({
  args: {
    therapeuticArea: v.string(),
    indication: v.string(),
    targetCountries: v.array(v.string()),
    gapScore: v.number(),
    demandEvidence: v.string(),
    supplyGap: v.string(),
    competitorLandscape: v.string(),
    suggestedDrugClasses: v.array(v.string()),
    tenderSignals: v.optional(v.string()),
    whoDiseaseBurden: v.optional(v.string()),
    regulatoryFeasibility: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    sources: v.optional(
      v.array(v.object({ title: v.string(), url: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("gapOpportunities", {
      ...args,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("gapOpportunities"),
    therapeuticArea: v.optional(v.string()),
    indication: v.optional(v.string()),
    targetCountries: v.optional(v.array(v.string())),
    gapScore: v.optional(v.number()),
    demandEvidence: v.optional(v.string()),
    supplyGap: v.optional(v.string()),
    competitorLandscape: v.optional(v.string()),
    suggestedDrugClasses: v.optional(v.array(v.string())),
    tenderSignals: v.optional(v.string()),
    whoDiseaseBurden: v.optional(v.string()),
    regulatoryFeasibility: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    sources: v.optional(
      v.array(v.object({ title: v.string(), url: v.string() }))
    ),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const linkDrug = mutation({
  args: { id: v.id("gapOpportunities"), drugId: v.id("drugs") },
  handler: async (ctx, { id, drugId }) => {
    const gap = await ctx.db.get(id);
    if (!gap) return;
    const existing = gap.linkedDrugIds ?? [];
    if (!existing.includes(drugId)) {
      await ctx.db.patch(id, {
        linkedDrugIds: [...existing, drugId],
        updatedAt: Date.now(),
      });
    }
  },
});

export const linkCompany = mutation({
  args: { id: v.id("gapOpportunities"), companyId: v.id("companies") },
  handler: async (ctx, { id, companyId }) => {
    const gap = await ctx.db.get(id);
    if (!gap) return;
    const existing = gap.linkedCompanyIds ?? [];
    if (!existing.includes(companyId)) {
      await ctx.db.patch(id, {
        linkedCompanyIds: [...existing, companyId],
        updatedAt: Date.now(),
      });
    }
  },
});
