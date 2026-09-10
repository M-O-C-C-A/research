import { describe, expect, it } from "vitest";
import {
  calculateCompanyFit,
  calculateForecast,
  compareOpportunityRank,
  REGIONAL_MARKETS,
  type CompanyFitInput,
  type ForecastScenario,
} from "./opportunityAssessmentPolicy";
import { buildCommercialOutput } from "./commercialOutputPolicy";
import { parseEgyptSalesRow } from "./egyptSalesPolicy";
import { contactReadyBlockers } from "./funnelPolicy";
const now = Date.UTC(2026, 8, 9);
const signal = {
  value: true,
  source: "https://company.example/partnering",
  observedAt: now,
};
const fit: CompanyFitInput = {
  channels: REGIONAL_MARKETS.map((country) => ({
    country,
    status: "NONE",
    partner: "",
    productScope: "company-wide",
    source: "https://company.example/markets",
    observedAt: now,
  })),
  staffCount: 249,
  staffSource: signal.source,
  staffObservedAt: now,
  outLicensed: signal,
  partneringContact: signal,
  conferenceExhibitor: signal,
};
export const scenario: ForecastScenario = {
  name: "base",
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
describe("v1.2 commercial policy", () => {
  it("adds exact fit contributions without clamping", () => {
    expect(calculateCompanyFit(fit, now).score).toBe(140);
    for (const [status, points] of [
      ["NONE", 40],
      ["DISTRIBUTOR_ONLY", 20],
      ["UNKNOWN", 5],
      ["EXCLUSIVE_AGENT", -30],
      ["OWN_AFFILIATE", -40],
    ] as const) {
      expect(
        calculateCompanyFit(
          { ...fit, channels: fit.channels.map((c) => ({ ...c, status })) },
          now,
        ).contributions.mena_channel_status,
      ).toBe(points);
    }
  });
  it("handles staff boundaries and evidence expiry", () => {
    for (const [staffCount, points] of [
      [249, 30],
      [250, 15],
      [5000, 15],
      [5001, -20],
    ])
      expect(
        calculateCompanyFit({ ...fit, staffCount }, now).contributions
          .company_size,
      ).toBe(points);
    expect(calculateCompanyFit(fit, now + 366 * 86400000).score).toBe(5);
    expect(
      calculateCompanyFit({ ...fit, staffSource: "" }, now).contributions
        .company_size,
    ).toBe(0);
    expect(
      calculateCompanyFit({ ...fit, channels: fit.channels.slice(1) }, now)
        .channelStatus,
    ).toBe("UNKNOWN");
  });
  it("preserves negative company fit", () => {
    const no = { value: false, source: "", observedAt: 0 };
    expect(
      calculateCompanyFit(
        {
          ...fit,
          staffCount: 6000,
          channels: [{ ...fit.channels[0], status: "OWN_AFFILIATE" }],
          outLicensed: no,
          partneringContact: no,
          conferenceExhibitor: no,
        },
        now,
      ).score,
    ).toBe(-60);
  });
  it("calculates cash, payback, working capital and launch delays independently", () => {
    const f = calculateForecast(scenario);
    expect(f.years[0]).toMatchObject({
      patients: 100,
      units: 1200,
      revenue: 12000,
      costs: 3400,
      workingCapital: 1200,
      cash: 7400,
      cumulativeCash: 5400,
    });
    expect(f.cumulativeCash).toBe(39800);
    expect(f.riskAdjustedCash).toBe(18900);
    expect(f.paybackYear).toBe(1);
    expect(
      calculateForecast({ ...scenario, launchDelayMonths: 6 }).years[0].revenue,
    ).toBe(6000);
    expect(
      calculateForecast({ ...scenario, launchDelayMonths: 60 }).cumulativeCash,
    ).toBe(-7000);
    expect(
      calculateForecast({
        ...scenario,
        publicSharePct: 50,
        tenderDiscountPct: 20,
      }).years[0].revenue,
    ).toBe(10800);
    expect(
      calculateForecast({ ...scenario, reimbursementReachPct: 50 }).years[0]
        .patients,
    ).toBe(50);
    expect(() =>
      calculateForecast({ ...scenario, adoptionPct: [NaN, 0, 0, 0, 0] }),
    ).toThrow();
    expect(() => calculateForecast({ ...scenario, netPrice: -1 })).toThrow();
  });
  it("keeps overlapping sales periods separate and zero distinct from blank", () => {
    const row = parseEgyptSalesRow({
      "Molecule\n": "INN",
      "Product\n": "Brand",
      "Jan 2026\nLC Value": 0,
      "Jan 2026\nUnits": null,
      "YTD Feb 2026\nLC Value": 20,
      "MAT Feb 2026\nUnits": 100,
    });
    expect(row?.observations).toEqual([
      { period: "Jan 2026", periodKind: "monthly", value: 0 },
      { period: "YTD Feb 2026", periodKind: "YTD", value: 20 },
      { period: "MAT Feb 2026", periodKind: "MAT", units: 100 },
    ]);
  });
  it("uses company fit and cash only after opportunity score", () => {
    const rows = [
      { priorityScore: 80, companyFitScore: -60 },
      { priorityScore: 70, companyFitScore: 140 },
      { priorityScore: 80, companyFitScore: 40, forecastBaseCashUsd: 0 },
      { priorityScore: 80, companyFitScore: 40, forecastBaseCashUsd: 50 },
    ].sort(compareOpportunityRank);
    expect(rows[0].forecastBaseCashUsd).toBe(50);
    expect(rows[3].priorityScore).toBe(70);
  });
  it("lets registered candidates pass readiness and only requires applicable nominee review", () => {
    const ready = {
      evidenceEngineVersion: "v1.2",
      registrationStatus: "registered",
      whiteSpaceStatus: "matches_found",
      sourceExpiresAt: now + 1000,
      productIdentityConfirmed: true,
      ownerConfirmed: true,
      rightsStatus: "clear_no_conflict_found",
      strongSignalCount: 1,
      mediumSignalCount: 0,
      feasibilityReviewed: true,
      economicsStatus: "conservative_range",
      criticalReviewOpen: false,
      weightedScore: 75,
      contactVerifiedAt: now,
      contactHasRoute: true,
      commercialApprovalStatus: "approved",
      intendedLocalApplicant: "KEMEDICA",
      nomineeRequired: false,
      now,
      gateSnapshot: {
        g1ReferenceApproval: "PASS",
        g2EligibleCategory: "PASS",
        g3WhiteSpace: "PASS",
        g4CompanyAndRights: "PASS",
        g5PriceChain: "PASS",
        g6LifetimeEconomics: "PASS",
        g7Demand: "PASS",
      },
    };
    expect(contactReadyBlockers(ready)).toEqual([]);
    expect(contactReadyBlockers({ ...ready, nomineeRequired: true })).toContain(
      "The nominee covenant has not been reviewed.",
    );
    expect(
      contactReadyBlockers({ ...ready, rightsStatus: "conflict" }),
    ).not.toEqual([]);
  });
  it("excludes directional, mismatched and stale prices from the corridor", () => {
    const anchor = {
      kind: "germany_reference" as const,
      country: "Germany",
      amount: 100,
      currency: "EUR",
      unitsPerPack: 10,
      unitBasis: "tablet",
      fxToUsd: 1.1,
      fxSource: "ECB dated rate",
      fxObservedAt: now,
      priceType: "retail list",
      presentation: "INN 5mg tablet",
      source: "https://source.example/price",
      observedAt: now,
      comparable: true,
    };
    const input = {
      therapeuticArea: "Area",
      epidemiology: "Source",
      targetPatients: "Source",
      decisionMakers: "Source",
      marketDynamics: "Source",
      reimbursement: "Source",
      affordability: "Source",
      competition: "Source",
      reputation: "Source",
      willingness: "Source",
      feasibility: "Source",
      assumptionEvidence: "Source",
      unitBasis: "tablet",
      startYear: 2026,
      scenarios: [scenario],
      prices: [
        anchor,
        {
          ...anchor,
          kind: "gcc_registered" as const,
          country: "UAE",
          amount: 200,
        },
        { ...anchor, kind: "directional" as const, amount: 10000 },
      ],
    };
    const output = buildCommercialOutput(input, now);
    expect(output.corridor).toMatchObject({
      low: 11,
      high: 22,
      complete: true,
    });
    expect(
      buildCommercialOutput({ ...input, unitBasis: "vial" }, now).corridor,
    ).toBeNull();
    expect(
      buildCommercialOutput(input, now + 366 * 86400000).corridor,
    ).toBeNull();
  });
});
