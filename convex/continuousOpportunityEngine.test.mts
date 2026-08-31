import test from "node:test";
import assert from "node:assert/strict";

const engineModulePath = "./continuousOpportunityEngine.ts";
const {
  calculateModel1ExpectedValue,
  calculateModel4ExpectedValue,
  canMarkVerifiedAbsent,
  isTop20OwnerName,
} = (await import(engineModulePath)) as typeof import("./continuousOpportunityEngine");

test("top-20 owner matching excludes maintained parent names", () => {
  assert.equal(isTop20OwnerName("Amgen Europe B.V."), true);
  assert.equal(isTop20OwnerName("Janssen-Cilag International NV"), true);
  assert.equal(isTop20OwnerName("Small Therapeutics GmbH"), false);
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

test("verified absence requires authoritative registry search metadata", () => {
  assert.equal(
    canMarkVerifiedAbsent({
      status: "not_registered",
      searchedNames: ["Examplea"],
      searchedInnVariants: ["examplimab"],
      officialRegistry: "EDA",
    }),
    true
  );
  assert.equal(
    canMarkVerifiedAbsent({
      status: "not_registered",
      searchedNames: [],
      searchedInnVariants: ["examplimab"],
      officialRegistry: "EDA",
    }),
    false
  );
  assert.equal(
    canMarkVerifiedAbsent({
      status: "unknown",
      searchedNames: ["Examplea"],
      searchedInnVariants: ["examplimab"],
      officialRegistry: "EDA",
    }),
    false
  );
});
