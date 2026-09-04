import test from "node:test";
import assert from "node:assert/strict";

const engineModulePath = "./continuousOpportunityEngine.ts";
const {
  calculatePeakSales,
  calculateModel1ExpectedValue,
  calculateModel4ExpectedValue,
  calculateRiskAdjustedMargin,
  canMarkVerifiedAbsent,
  defaultMarketMarginRate,
  deriveInternationalPriceAnchorForTest,
  isTop20OwnerName,
  isTop20OwnerExcluded,
} = (await import(
  engineModulePath
)) as typeof import("./continuousOpportunityEngine");

test("top-20 owner matching excludes maintained parent names", () => {
  assert.equal(isTop20OwnerName("Amgen Europe B.V."), true);
  assert.equal(isTop20OwnerName("Janssen-Cilag International NV"), true);
  assert.equal(isTop20OwnerName("Small Therapeutics GmbH"), false);
});

test("top-20 exclusion fails closed when a classification fact is missing", () => {
  assert.equal(isTop20OwnerExcluded("Eisai GmbH", undefined), true);
  assert.equal(isTop20OwnerExcluded("AstraZeneca AB", false), true);
  assert.equal(isTop20OwnerExcluded("Small Therapeutics GmbH", true), true);
  assert.equal(isTop20OwnerExcluded("Small Therapeutics GmbH", false), false);
});

test("Model 1 economics includes operating burden and probability", () => {
  const value = calculateModel1ExpectedValue({
    annualOpportunityRange: "USD 2M-6M",
    grossMarginPct: 30,
    tenderDiscountPct: 20,
    registrationCostUsd: 75_000,
    annualPvCostUsd: 25_000,
    workingCapitalPct: 10,
    probabilityOfSuccessPct: 50,
  });

  assert.equal(value, 270_000);
});

test("Model 4 economics uses broker and sub-license fees with lower operating burden", () => {
  const value = calculateModel4ExpectedValue({
    annualOpportunityRange: "USD 2M-6M",
    successFeePct: 3,
    sublicenseRoyaltyPct: 2,
    operatingCostUsd: 15_000,
    probabilityOfSuccessPct: 25,
  });

  assert.equal(value, 46_250);
});

test("country margin defaults match KEMEDICA screen assumptions", () => {
  assert.equal(defaultMarketMarginRate("Egypt"), 28);
  assert.equal(defaultMarketMarginRate("Saudi Arabia"), 32);
  assert.equal(defaultMarketMarginRate("UAE"), 35);
  assert.equal(defaultMarketMarginRate("Qatar"), 30);
});

test("screen sizing formula calculates peak sales from the five-step cascade", () => {
  const peakSales = calculatePeakSales({
    eligiblePatients: 10_000,
    diagnosedReachableRate: 50,
    brandedTreatmentRate: 40,
    kemedicaShareRate: 10,
    netPricePerPatientYearUsd: 20_000,
  });

  assert.equal(peakSales, 4_000_000);
});

test("risk-adjusted margin applies market margin and two probabilities", () => {
  const riskAdjustedMargin = calculateRiskAdjustedMargin({
    peakSalesUsd: 4_000_000,
    marketMarginRate: 32,
    licenseSignedProbability: 50,
    registrationGrantedProbability: 75,
  });

  assert.equal(riskAdjustedMargin, 480_000);
});

test("international price anchor averages convertible registered and list prices", () => {
  const anchor = deriveInternationalPriceAnchorForTest([
    {
      amount: 1000,
      currency: "USD",
      country: "United States",
      priceType: "registered",
      sourceCategory: "official",
    },
    {
      amount: 3673,
      currency: "AED",
      country: "UAE",
      priceType: "list",
      sourceCategory: "official",
    },
    {
      amount: 99,
      currency: "BTC",
      country: "Nowhere",
      priceType: "registered",
      sourceCategory: "proxy",
    },
    {
      amount: 500,
      currency: "USD",
      country: "Tenderland",
      priceType: "tender",
      sourceCategory: "official",
    },
  ]);

  assert.equal(anchor?.averageUsd, 1000);
  assert.equal(anchor?.count, 2);
  assert.equal(anchor?.officialCount, 2);
});

test("verified absence requires authoritative registry search metadata", () => {
  assert.equal(
    canMarkVerifiedAbsent({
      status: "not_registered",
      searchedNames: ["Examplea"],
      searchedInnVariants: ["examplimab"],
      officialRegistry: "EDA",
    }),
    true,
  );
  assert.equal(
    canMarkVerifiedAbsent({
      status: "not_registered",
      searchedNames: [],
      searchedInnVariants: ["examplimab"],
      officialRegistry: "EDA",
    }),
    false,
  );
  assert.equal(
    canMarkVerifiedAbsent({
      status: "unknown",
      searchedNames: ["Examplea"],
      searchedInnVariants: ["examplimab"],
      officialRegistry: "EDA",
    }),
    false,
  );
});
