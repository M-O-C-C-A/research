// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.vitest.ts"]);

describe("source dispatcher bootstrap", () => {
  it("makes new automated sources due on the first run", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.continuousOpportunityEngine.seedSourceRegistry, {});
    const due = await t.query(internal.continuousOpportunityEngine.listDueSourceRegistries, {});
    expect(due.some(source => source.sourceRegistry === "drugs_fda")).toBe(true);
    expect(due.every(source => source.cadence !== "manual")).toBe(true);
  });

  it("preserves overdue schedules, failed health and operator settings across repeated runs", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.continuousOpportunityEngine.seedSourceRegistry, {});
    const sources = await t.query(api.continuousOpportunityEngine.listSourceHealth, {});
    const fda = sources.find(source => source.sourceRegistry === "drugs_fda")!;
    const ema = sources.find(source => source.sourceRegistry === "ema_medicine_downloads")!;
    await t.run(async ctx => {
      await ctx.db.patch(fda._id, { nextFetchAt: 1, rateLimitPerMinute: 2 });
      await ctx.db.patch(ema._id, { status: "structural_change", lastError: "Parser needs review", nextFetchAt: 1 });
    });
    await t.mutation(api.continuousOpportunityEngine.seedSourceRegistry, {});
    await t.mutation(api.continuousOpportunityEngine.seedSourceRegistry, {});
    const after = await t.query(api.continuousOpportunityEngine.listSourceHealth, {});
    expect(after).toHaveLength(sources.length);
    expect(after.find(source => source._id === fda._id)).toMatchObject({ nextFetchAt: 1, rateLimitPerMinute: 2 });
    expect(after.find(source => source._id === ema._id)).toMatchObject({ status: "structural_change", lastError: "Parser needs review", nextFetchAt: 1 });
    const due = await t.query(internal.continuousOpportunityEngine.listDueSourceRegistries, {});
    expect(due.some(source => source._id === fda._id)).toBe(true);
    expect(due.some(source => source._id === ema._id)).toBe(false);
  });
});
