import test from "node:test";
import assert from "node:assert/strict";

const engineModulePath = "./decisionOpportunityEngine.ts";
const { buildDecisionOpportunityDraft, resolveFocusMarketSelection } = (await import(
  engineModulePath
)) as typeof import("./decisionOpportunityEngine");

type BuildArgs = Parameters<typeof buildDecisionOpportunityDraft>[0];
type GapInput = BuildArgs["gap"];
type DrugInput = BuildArgs["drug"];
type CompanyInput = NonNullable<BuildArgs["company"]>;
type MatchInput = NonNullable<BuildArgs["match"]>;

function makeGap(targetCountries: string[]) {
  return {
    targetCountries,
    validationStatus: "confirmed",
    gapScore: 8,
    demandEvidence: "Strong oncology demand signal.",
    evidenceSummary: "Whitespace validated against structured market checks.",
    supplyGap: "Limited local access.",
    competitorLandscape: "Competition is manageable.",
    indication: "Liver Cancer",
    tenderSignals: "",
    regulatoryFeasibility: "medium",
  } as unknown as GapInput;
}

function makeDrug(registrations: Array<{ country: string; status: "registered" | "not_found" | "unverified" }>) {
  return {
    name: "Truxima",
    genericName: "Rituximab",
    therapeuticArea: "Oncology",
    menaRegistrations: registrations.map((registration) => ({
      ...registration,
      registrationNumber: undefined,
    })),
    menaRegistrationCount: registrations.filter((registration) => registration.status === "registered")
      .length,
    patentUrgencyScore: 1.5,
    primaryManufacturerName: "Celltrion",
    primaryMarketAuthorizationHolderName: "Celltrion",
  } as unknown as DrugInput;
}

function makeCompany() {
  return {
    name: "Celltrion Healthcare",
    entityRoles: ["market_authorization_holder"],
    commercialControlLevel: "full",
    menaPartnershipStrength: "light",
    distributorFitScore: 7.5,
    distributorFitRationale: "Reachable BD surface.",
    keyContacts: [],
  } as unknown as CompanyInput;
}

function makeMatch() {
  return {
    distributorFitScore: 7.2,
  } as unknown as MatchInput;
}

test("confirmed UAE registration removes UAE from focus markets and updates rationale", () => {
  const draft = buildDecisionOpportunityDraft({
    gap: makeGap(["Saudi Arabia", "UAE"]),
    company: makeCompany(),
    drug: makeDrug([{ country: "UAE", status: "registered" }]),
    match: makeMatch(),
    sourceCount: 4,
    opportunities: [],
  });

  assert.ok(draft);
  assert.deepEqual(draft.focusMarkets, ["Saudi Arabia"]);
  assert.deepEqual(draft.blockedFocusMarkets, ["UAE"]);
  assert.match(draft.whyThisMarket, /UAE is already formally registered/i);
  assert.match(draft.confidenceSummary, /scoped to Saudi Arabia/i);
  assert.match(draft.scoreExplanation, /UAE was removed from whitespace scoring/i);
});

test("confirmed UAE registration with no remaining focus market prevents promotion", () => {
  const draft = buildDecisionOpportunityDraft({
    gap: makeGap(["UAE"]),
    company: makeCompany(),
    drug: makeDrug([{ country: "UAE", status: "registered" }]),
    match: makeMatch(),
    sourceCount: 4,
    opportunities: [],
  });

  assert.equal(draft, null);
});

test("non-focus registrations still apply as softer context while UAE remains eligible", () => {
  const draft = buildDecisionOpportunityDraft({
    gap: makeGap(["UAE"]),
    company: makeCompany(),
    drug: makeDrug([{ country: "Egypt", status: "registered" }]),
    match: makeMatch(),
    sourceCount: 4,
    opportunities: [],
  });

  assert.ok(draft);
  assert.deepEqual(draft.focusMarkets, ["UAE"]);
  assert.equal(draft.scoreBreakdown.gapValidity, 8.3);
});

test("unverified UAE status does not trigger the hard UAE block", () => {
  const selection = resolveFocusMarketSelection({
    gap: makeGap(["Saudi Arabia", "UAE"]),
    drug: makeDrug([{ country: "UAE", status: "unverified" }]),
  });

  assert.deepEqual(selection.selectedFocusMarkets, ["Saudi Arabia", "UAE"]);
  assert.deepEqual(selection.blockedFocusMarkets, []);
});
