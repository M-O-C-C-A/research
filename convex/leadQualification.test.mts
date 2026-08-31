import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLeadGate, isOutreachQualifyingSignal } from "./leadQualification.ts";

const now = Date.UTC(2026, 7, 28);
const validInput = {
  isOfficial: true,
  observedAt: now - 2 * 24 * 60 * 60 * 1000,
  now,
  signalType: "shortage",
  productMatchCount: 1,
  ownershipConfirmed: true,
  conflictingMarketAccess: false,
  hasNamedContact: true,
  hasPublicRoute: true,
  contactVerifiedAt: now - 3 * 24 * 60 * 60 * 1000,
};

test("publishes only a complete evidence-first lead", () => {
  assert.equal(evaluateLeadGate(validInput).eligible, true);
});

test("fails closed for missing ownership, conflicts, stale sources, and absent contacts", () => {
  for (const input of [
    { ...validInput, ownershipConfirmed: false },
    { ...validInput, conflictingMarketAccess: true },
    { ...validInput, observedAt: now - 15 * 24 * 60 * 60 * 1000 },
    { ...validInput, hasNamedContact: false, hasPublicRoute: false },
  ]) {
    assert.equal(evaluateLeadGate(input).eligible, false);
  }
});

test("keeps registration evidence out of the outreach workflow", () => {
  assert.equal(isOutreachQualifyingSignal("registration"), false);
  assert.equal(evaluateLeadGate({ ...validInput, signalType: "registration" }).eligible, false);
  assert.equal(isOutreachQualifyingSignal("tender"), true);
});
