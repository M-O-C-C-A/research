import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSustainableGate } from "./sustainableOpportunityQualification.ts";

const now = Date.UTC(2026, 8, 1);
const recentApproval = Date.UTC(2021, 0, 1);

const validInput = {
  isOfficial: true,
  approvedAt: recentApproval,
  now,
  productMatchCount: 1,
  ownershipConfirmed: true,
  isTop20Owner: false,
  hasConfirmedMenaPresence: false,
  targetStatuses: {
    "Saudi Arabia": "verified_absent",
    UAE: "verified_absent",
    Egypt: "verified_absent",
  },
} as const;

test("qualifies recent official home approvals missing from target markets", () => {
  const gate = evaluateSustainableGate(validInput);
  assert.equal(gate.eligible, true);
  assert.deepEqual(gate.qualifyingCountries, ["Saudi Arabia", "UAE", "Egypt"]);
});

test("blocks registered and under-registration target markets", () => {
  assert.equal(
    evaluateSustainableGate({
      ...validInput,
      targetStatuses: { ...validInput.targetStatuses, UAE: "registered" },
    }).eligible,
    false
  );
  assert.equal(
    evaluateSustainableGate({
      ...validInput,
      targetStatuses: { ...validInput.targetStatuses, Egypt: "under_registration" },
    }).eligible,
    false
  );
});

test("blocks top-20 owners, confirmed MENA presence, and ambiguous products", () => {
  for (const input of [
    { ...validInput, isTop20Owner: true },
    { ...validInput, hasConfirmedMenaPresence: true },
    { ...validInput, productMatchCount: 2 },
  ]) {
    assert.equal(evaluateSustainableGate(input).eligible, false);
  }
});

test("does not infer absence from unknown target-country data", () => {
  const gate = evaluateSustainableGate({
    ...validInput,
    targetStatuses: {
      "Saudi Arabia": "unknown",
      UAE: "not_found_unverified",
      Egypt: undefined,
    },
  });

  assert.equal(gate.eligible, false);
  assert.deepEqual(gate.qualifyingCountries, []);
  assert.deepEqual(gate.reviewCountries, ["Saudi Arabia", "UAE", "Egypt"]);
});
