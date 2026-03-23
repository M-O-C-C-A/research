import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    ctx.db
      .query("discoveryJobs")
      .withIndex("by_started")
      .order("desc")
      .take(limit),
});

export const get = query({
  args: { id: v.id("discoveryJobs") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) =>
    ctx.db
      .query("discoveryJobs")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .order("desc")
      .take(10),
});

export const recentStats = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("discoveryJobs")
      .withIndex("by_started")
      .order("desc")
      .take(5);
    return recent;
  },
});

export const create = mutation({
  args: {
    type: v.union(
      v.literal("companies"),
      v.literal("drugs"),
      v.literal("bd_scoring"),
      v.literal("gap_analysis"),
      v.literal("gap_analysis_flow"),
      v.literal("demand_signals"),
      v.literal("prospect_research"),
      v.literal("gap_evidence_enrichment"),
    ),
    companyId: v.optional(v.id("companies")),
    companyName: v.optional(v.string()),
    gapOpportunityId: v.optional(v.id("gapOpportunities")),
    therapeuticArea: v.optional(v.string()),
    targetCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { type, companyId, companyName, gapOpportunityId, therapeuticArea, targetCountries }) =>
    ctx.db.insert("discoveryJobs", {
      type,
      status: "running",
      companyId,
      companyName,
      gapOpportunityId,
      therapeuticArea,
      targetCountries,
      startedAt: Date.now(),
      log: [],
      provider: "openai",
      model: "gpt-4.1",
      retryCount: 0,
      warnings: 0,
      requestIds: [],
    }),
});

export const appendLog = mutation({
  args: {
    id: v.id("discoveryJobs"),
    message: v.string(),
    level: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
  },
  handler: async (ctx, { id, message, level }) => {
    const job = await ctx.db.get(id);
    if (!job) return;
    await ctx.db.patch(id, {
      log: [...job.log, { timestamp: Date.now(), message, level }].slice(-200),
    });
  },
});

export const recordTelemetry = mutation({
  args: {
    id: v.id("discoveryJobs"),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    retryCountDelta: v.optional(v.number()),
    warningDelta: v.optional(v.number()),
    requestId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, provider, model, retryCountDelta, warningDelta, requestId }
  ) => {
    const job = await ctx.db.get(id);
    if (!job) return;

    const requestIds = requestId
      ? [...(job.requestIds ?? []), requestId].slice(-20)
      : job.requestIds;

    await ctx.db.patch(id, {
      provider: provider ?? job.provider,
      model: model ?? job.model,
      retryCount: (job.retryCount ?? 0) + (retryCountDelta ?? 0),
      warnings: (job.warnings ?? 0) + (warningDelta ?? 0),
      requestIds,
    });
  },
});

export const complete = mutation({
  args: {
    id: v.id("discoveryJobs"),
    newItemsFound: v.number(),
    skippedDuplicates: v.number(),
    summary: v.string(),
  },
  handler: async (ctx, { id, newItemsFound, skippedDuplicates, summary }) => {
    const job = await ctx.db.get(id);
    if (!job) return;
    await ctx.db.patch(id, {
      status: "completed",
      newItemsFound,
      skippedDuplicates,
      summary,
      completedAt: Date.now(),
      log: [
        ...job.log,
        { timestamp: Date.now(), message: summary, level: "success" as const },
      ].slice(-200),
    });
  },
});

export const fail = mutation({
  args: {
    id: v.id("discoveryJobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { id, errorMessage }) => {
    const job = await ctx.db.get(id);
    if (!job) return;
    await ctx.db.patch(id, {
      status: "error",
      errorMessage,
      completedAt: Date.now(),
      log: [
        ...job.log,
        { timestamp: Date.now(), message: errorMessage, level: "error" as const },
      ].slice(-200),
    });
  },
});
