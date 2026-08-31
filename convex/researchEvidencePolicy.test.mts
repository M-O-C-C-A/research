import test from "node:test";
import assert from "node:assert/strict";
import { canStoreResearchFinding } from "./researchEvidencePolicy.ts";

const base = {
  kind: "product_profile" as const,
  hasProviderSource: true,
  hasClaim: true,
  hasExcerpt: true,
  hasKnownCompany: false,
  knownCompanyCount: 0,
  hasNamedContact: false,
  hasContactTitle: false,
  hasPublicContactRoute: false,
};

test("keeps only provider-returned source claims", () => {
  assert.equal(canStoreResearchFinding({ ...base, hasProviderSource: false }), false);
  assert.equal(canStoreResearchFinding(base), true);
});

test("rejects ambiguous ownership and incomplete contacts", () => {
  assert.equal(canStoreResearchFinding({ ...base, kind: "ownership" }), false);
  assert.equal(canStoreResearchFinding({ ...base, kind: "ownership", hasKnownCompany: true }), true);
  assert.equal(canStoreResearchFinding({ ...base, kind: "contact", knownCompanyCount: 1 }), false);
  assert.equal(canStoreResearchFinding({
    ...base,
    kind: "contact",
    knownCompanyCount: 1,
    hasNamedContact: true,
    hasContactTitle: true,
    hasPublicContactRoute: true,
  }), true);
});

test("never accepts UAE registration claims from web research", () => {
  assert.equal(canStoreResearchFinding({ ...base, kind: "registration", country: "UAE" }), false);
  assert.equal(canStoreResearchFinding({ ...base, kind: "registration", country: "Saudi Arabia" }), true);
  assert.equal(canStoreResearchFinding({ ...base, kind: "registration", country: "Egypt" }), true);
});
