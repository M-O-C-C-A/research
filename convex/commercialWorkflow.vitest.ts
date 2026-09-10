// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.vitest.ts"]);
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.workspaceMembers.ensureCurrent, {});
  const ids = await t.run(async (ctx) => {
    const companyId = await ctx.db.insert("companies", {
      name: "QA Pharma",
      country: "Germany",
      therapeuticAreas: [],
      status: "active",
    });
    const drugId = await ctx.db.insert("drugs", {
      companyId,
      name: "QA product",
      genericName: "qa molecule",
      therapeuticArea: "QA",
      indication: "QA",
      approvalStatus: "approved",
      status: "active",
    });
    const draft: Omit<Doc<"decisionOpportunities">, "_id" | "_creationTime"> = {
      drugId,
      companyId,
      title: "QA pursuit",
      status: "needs_validation",
      therapeuticArea: "QA",
      productName: "QA product",
      genericName: "qa molecule",
      approachEntityName: "QA Pharma",
      approachEntityRole: "market_authorization_holder",
      focusMarkets: ["UAE"],
      gapType: "regulatory_gap",
      productIdentityStatus: "confirmed",
      gapSummary: "QA",
      commercialRationale: "QA",
      marketAttractiveness: "QA",
      demandProxy: "QA",
      competitivePressure: "QA",
      regulatoryFeasibility: "moderate",
      timelineRange: "QA",
      keyConstraint: "QA",
      entryStrategy: "licensing",
      entryStrategyRationale: "QA",
      whyThisMarket: "QA",
      whyNow: "QA",
      whyThisPartner: "QA",
      targetRole: "BD",
      contactConfidence: "none",
      outreachSubject: "",
      outreachDraft: "",
      confidenceLevel: "low",
      confidenceSummary: "QA",
      assumptions: [],
      sourceCount: 1,
      priorityScore: 70,
      scoreBreakdown: {
        gapValidity: 70,
        commercialValue: 70,
        urgency: 70,
        feasibility: 70,
        partnerReachability: 70,
        evidenceConfidence: 70,
      },
      scoreExplanation: "QA",
      whyThisMarketExplanation: "QA",
      whyNowExplanation: "QA",
      howToEnterExplanation: "QA",
      whyThisPartnerExplanation: "QA",
      createdAt: 1,
      updatedAt: 1,
      lastPromotedAt: 1,
      funnelStage: "needs_evidence",
      evidenceEngineVersion: "v1.1",
    };
    const opportunityId = await ctx.db.insert("decisionOpportunities", draft);
    return { opportunityId, draft };
  });
  return { t, ...ids };
}
describe("commercial workflow persistence", () => {
  it("previews migration, rejects stale previews, restores only large-pharma quarantine and is idempotent", async () => {
    const { t, opportunityId, draft } = await setup();
    const duplicateId = await t.run(async (ctx) => {
      await ctx.db.patch(opportunityId, {
        legacyQuarantinedAt: 1,
        legacyQuarantineReason:
          "Owner matches the maintained top-20 pharma exclusion list.",
      });
      return ctx.db.insert("decisionOpportunities", {
        ...draft,
        legacyQuarantinedAt: 1,
        legacyQuarantineReason: "Duplicate product-owner pursuit",
      });
    });
    const args = {
      paginationOpts: { cursor: null, numItems: 20 },
      dryRun: true,
    };
    const preview = await t.mutation(
      api.opportunityPolicyMigration.migratePage,
      args,
    );
    expect(preview).toMatchObject({
      affected: 2,
      restoredLargePharma: 1,
      preservedQuarantine: 1,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(opportunityId)))?.evidenceEngineVersion,
    ).toBe("v1.1");
    await expect(
      t.mutation(api.opportunityPolicyMigration.migratePage, {
        ...args,
        dryRun: false,
        expectedFingerprint: "stale",
      }),
    ).rejects.toThrow("preview changed");
    await t.mutation(api.opportunityPolicyMigration.migratePage, {
      ...args,
      dryRun: false,
      expectedFingerprint: preview.fingerprint,
    });
    expect(
      (await t.run((ctx) => ctx.db.get(opportunityId)))?.legacyQuarantinedAt,
    ).toBeUndefined();
    expect(
      (await t.run((ctx) => ctx.db.get(duplicateId)))?.legacyQuarantinedAt,
    ).toBe(1);
    expect(
      (await t.mutation(api.opportunityPolicyMigration.migratePage, args))
        .affected,
    ).toBe(0);
  });
  it("persists three scenarios and invalidates approval after forecast edits", async () => {
    const { t, opportunityId } = await setup();
    const scenario = {
      eligiblePatients: 1000,
      reachablePct: 50,
      reimbursementReachPct: 100,
      annualPatientGrowthPct: 0,
      adoptionPct: [20, 20, 20, 20, 20],
      unitsPerPatient: 12,
      netPrice: 10,
      annualPriceGrowthPct: 0,
      launchDelayMonths: 0,
      kemedicaSharePct: 100,
      unitCost: 2,
      annualOperatingCost: 1000,
      upfrontCost: 2000,
      workingCapitalPct: 10,
      probabilityOfSuccessPct: 50,
      publicSharePct: 0,
      tenderDiscountPct: 0,
    };
    const input = {
      therapeuticArea: "QA",
      epidemiology: "QA",
      targetPatients: "QA",
      decisionMakers: "QA",
      marketDynamics: "QA",
      reimbursement: "QA",
      affordability: "QA",
      competition: "QA",
      reputation: "QA",
      willingness: "QA",
      feasibility: "QA",
      assumptionEvidence: "Synthetic test assumptions",
      unitBasis: "tablet",
      startYear: 2026,
      prices: [],
      scenarios: (["downside", "base", "upside"] as const).map((name) => ({
        ...scenario,
        name,
      })),
    };
    const id = await t.mutation(api.commercialAssessments.saveStudy, {
      opportunityId,
      country: "UAE",
      input,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(id, { reviewedAt: Date.now() });
      await ctx.db.patch(opportunityId, { forecastBaseCashUsd: 39800 });
    });
    const updatedId = await t.mutation(api.commercialAssessments.saveStudy, {
      opportunityId,
      country: "UAE",
      input: {
        ...input,
        scenarios: input.scenarios.map((s) => ({ ...s, netPrice: 12 })),
      },
    });
    expect(updatedId).toBe(id);
    const result = await t.query(api.commercialAssessments.get, {
      opportunityId,
      country: "UAE",
    });
    expect(result.study.reviewedAt).toBeUndefined();
    expect(
      result.output.forecasts.find((f: { name: string }) => f.name === "base")
        .cumulativeCash,
    ).toBe(51560);
    expect(
      (await t.run((ctx) => ctx.db.get(opportunityId)))?.forecastBaseCashUsd,
    ).toBeUndefined();
    await expect(
      t.mutation(api.commercialAssessments.saveStudy, {
        opportunityId,
        country: "UAE",
        input: { ...input, scenarios: input.scenarios.slice(0, 2) },
      }),
    ).rejects.toThrow("Provide downside, base, and upside");
  });
  it("preserves raw negative fit and reports an unsaved study as missing", async () => {
    const { t, opportunityId } = await setup();
    const no = { value: false, source: "", observedAt: 0 };
    await t.mutation(api.commercialAssessments.saveFit, {
      opportunityId,
      input: {
        channels: [
          {
            country: "UAE",
            status: "OWN_AFFILIATE",
            partner: "Local",
            productScope: "QA",
            source: "https://company.example/affiliate",
            observedAt: Date.now(),
          },
        ],
        staffCount: 6000,
        staffSource: "https://company.example/annual",
        staffObservedAt: Date.now(),
        outLicensed: no,
        partneringContact: no,
        conferenceExhibitor: no,
      },
    });
    expect(
      (await t.run((ctx) => ctx.db.get(opportunityId)))?.companyFitScore,
    ).toBe(-60);
    const result = await t.query(api.commercialAssessments.get, {
      opportunityId,
      country: "UAE",
    });
    expect(result.fitResult.score).toBe(-60);
    expect(result.study).toBeNull();
  });
});
