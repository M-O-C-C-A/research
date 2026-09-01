import test from "node:test";
import assert from "node:assert/strict";

const engineModulePath = "./mandateOpportunityEngine.ts";
const {
  buildMandateReportDraft,
  evaluateMandateDecision,
  scoreMandateOpportunity,
  totalMandateScore,
} = (await import(engineModulePath)) as typeof import("./mandateOpportunityEngine");

const baseInput = {
  productName: "Examplea",
  genericName: "examplimab",
  indication: "Rare inflammatory disease",
  strength: "100 mg",
  dosageForm: "solution for injection",
  route: "subcutaneous",
  manufacturerName: "Example Pharma",
  marketAuthorizationHolderName: "Example Pharma GmbH",
  approvalStatus: "approved" as const,
  euRegulatoryStatus: "EMA approved",
  productIdentityStatus: "confirmed" as const,
  focusMarkets: ["Saudi Arabia", "UAE", "Egypt"],
  gapType: "shortage_gap",
  gapSummary: "Limited registered alternatives and repeated shortage signals.",
  demandProxy: "Regulator shortage and tender evidence.",
  commercialRationale: "KEMEDICA can validate a local partner path for a limited-supply specialty product.",
  marketSizeEstimate: "USD 2M-6M annual opportunity",
  competitivePressure: "Limited competition.",
  regulatoryFeasibility: "moderate" as const,
  contactName: "Alex Example",
  contactTitle: "Head of International BD",
  contactEmail: "alex@example.com",
  contactConfidence: "confirmed" as const,
  companyName: "Example Pharma GmbH",
  companySize: "sme" as const,
  menaPresence: "limited" as const,
  partnerabilitySignals: ["Company publishes international partnering contact route."],
  existingMenaPartners: [],
  opportunityRows: [
    {
      country: "Saudi Arabia",
      availabilityStatus: "not_found",
      regulatoryStatus: "No exact registration found in official search",
      tenderOpportunity: true,
      tenderSignalStrength: "high",
      annualOpportunityRange: "USD 1M-3M",
      evidenceItems: [
        {
          claim: "SFDA current shortage signal for examplimab.",
          title: "SFDA current shortage",
          url: "https://www.sfda.gov.sa/en/currentlyInShortageList",
          sourceType: "shortage_list",
          sourceTier: "Tier A" as const,
          country: "Saudi Arabia",
          excerpt: "examplimab shortage listing",
          confidence: "confirmed" as const,
        },
      ],
    },
  ],
  evidence: [
    {
      claim: "EMA approved Examplea for rare inflammatory disease.",
      title: "EMA medicine data",
      url: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
      sourceType: "official_registry",
      sourceTier: "Tier A" as const,
      excerpt: "Examplea authorised medicine row",
      confidence: "confirmed" as const,
    },
    {
      claim: "NUPCO tender evidence references examplimab.",
      title: "NUPCO tenders",
      url: "https://www.nupco.com/tenders/tenders-list/",
      sourceType: "tender_portal",
      sourceTier: "Tier A" as const,
      country: "Saudi Arabia",
      excerpt: "examplimab tender line",
      confidence: "confirmed" as const,
    },
  ],
};

test("mandate score respects category caps and 100 point total", () => {
  const score = scoreMandateOpportunity({
    ...baseInput,
    evidence: [
      ...baseInput.evidence,
      ...Array.from({ length: 20 }, (_, index) => ({
        claim: `Official demand claim ${index}`,
        title: `Official source ${index}`,
        url: `https://example.gov/${index}`,
        sourceType: "official_registry",
        sourceTier: "Tier A" as const,
        excerpt: "official excerpt",
        confidence: "confirmed" as const,
      })),
    ],
  });

  assert.equal(score.unmetNeed <= 25, true);
  assert.equal(score.marketEvidence <= 20, true);
  assert.equal(score.competitiveGap <= 15, true);
  assert.equal(score.regulatoryFeasibility <= 15, true);
  assert.equal(score.commercialAttractiveness <= 15, true);
  assert.equal(score.partnerability <= 10, true);
  assert.equal(totalMandateScore(score) <= 100, true);
});

test("missing identity proof prevents PURSUE", () => {
  const input = {
    ...baseInput,
    manufacturerName: undefined,
    marketAuthorizationHolderName: undefined,
  };
  const score = scoreMandateOpportunity(input);
  const decision = evaluateMandateDecision(input, score);

  assert.equal(decision.decision, "REJECT");
  assert.equal(decision.rejectionReason, "IDENTITY_UNVERIFIED");
});

test("missing contact route prevents PURSUE and creates validation action", () => {
  const input = {
    ...baseInput,
    contactName: undefined,
    contactEmail: undefined,
    contactLinkedinUrl: undefined,
    contactConfidence: "none" as const,
  };
  const report = buildMandateReportDraft(input);

  assert.notEqual(report.decision, "PURSUE");
  assert.match(report.nextAction, /contact/i);
});

test("not_found availability is not verified absent without authoritative registry evidence", () => {
  const report = buildMandateReportDraft({
    ...baseInput,
    opportunityRows: [
      {
        country: "UAE",
        availabilityStatus: "not_found",
        regulatoryStatus: "No web search hit",
        evidenceItems: [],
      },
    ],
  });

  const uae = report.countryAssessments.find((row) => row.country === "UAE");
  assert.equal(uae?.absenceStatus, "UNKNOWN");
});

test("official registration evidence can mark a country verified absent", () => {
  const report = buildMandateReportDraft({
    ...baseInput,
    opportunityRows: [
      {
        country: "Egypt",
        availabilityStatus: "not_found",
        regulatoryStatus: "No exact registration found after INN and brand search",
        evidenceItems: [
          {
            claim: "EDA registry search did not find exact examplimab product.",
            title: "EDA search",
            url: "https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx",
            sourceType: "official_registry",
            sourceTier: "Tier A" as const,
            country: "Egypt",
            excerpt: "No exact row returned",
            confidence: "confirmed" as const,
          },
        ],
      },
    ],
  });

  const egypt = report.countryAssessments.find((row) => row.country === "Egypt");
  assert.equal(egypt?.absenceStatus, "VERIFIED_ABSENT");
});

test("report records both discovery directions when MENA demand signal exists", () => {
  const report = buildMandateReportDraft(baseInput);

  assert.deepEqual(report.discoveryDirections, ["EU_TO_MIDDLE_EAST", "MENA_TO_EU"]);
  assert.ok(report.opportunityTypes.includes("CURRENT_SHORTAGE"));
  assert.ok(report.opportunityTypes.includes("TENDER_DEMAND"));
});

test("report keeps EU to Middle East direction for product-led evidence only", () => {
  const report = buildMandateReportDraft({
    ...baseInput,
    gapType: "regulatory_gap",
    demandProxy: "Disease prevalence supports a product-led market check.",
    opportunityRows: [],
    evidence: [
      {
        claim: "EMA approved Examplea for rare inflammatory disease.",
        title: "EMA medicine data",
        url: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
        sourceType: "official_registry",
        sourceTier: "Tier A" as const,
        excerpt: "Examplea authorised medicine row",
        confidence: "confirmed" as const,
      },
    ],
  });

  assert.deepEqual(report.discoveryDirections, ["EU_TO_MIDDLE_EAST"]);
  assert.ok(report.opportunityTypes.includes("NEW_MARKET_GAP"));
});
