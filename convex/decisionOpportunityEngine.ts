import { Doc } from "./_generated/dataModel";
import { getCountryCapabilityProfile } from "./countryCapabilityProfiles";

export const FOCUS_MARKETS = ["Saudi Arabia", "UAE"] as const;

type GapDoc = Doc<"gapOpportunities">;
type CompanyDoc = Doc<"companies"> | null;
type DrugDoc = Doc<"drugs">;
type MatchDoc = Doc<"gapCompanyMatches"> | null;
type MarketOpportunityDoc = Doc<"opportunities">;

export type DecisionOpportunityDraft = {
  title: string;
  status: "active" | "needs_validation";
  therapeuticArea: string;
  productName: string;
  genericName: string;
  manufacturerName?: string;
  marketAuthorizationHolderName?: string;
  approachEntityName: string;
  approachEntityRole:
    | "manufacturer"
    | "market_authorization_holder"
    | "licensor"
    | "regional_partner"
    | "distributor"
    | "unknown";
  focusMarkets: string[];
  secondaryMarkets: string[];
  gapType:
    | "formulary_gap"
    | "regulatory_gap"
    | "shortage_gap"
    | "tender_pull"
    | "channel_whitespace"
    | "mixed";
  productIdentityStatus: "confirmed" | "likely" | "uncertain";
  gapSummary: string;
  commercialRationale: string;
  marketAttractiveness: string;
  marketSizeEstimate?: string;
  demandProxy: string;
  competitivePressure: string;
  regulatoryFeasibility: "easy" | "moderate" | "complex" | "unknown";
  timelineRange: string;
  keyConstraint: string;
  entryStrategy: "distributor" | "licensing" | "direct" | "watch";
  entryStrategyRationale: string;
  whyThisMarket: string;
  whyNow: string;
  whyThisPartner: string;
  targetRole: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactLinkedinUrl?: string;
  contactConfidence: "confirmed" | "likely" | "inferred" | "none";
  outreachReadiness: {
    gapConfirmed: boolean;
    ownershipConfirmed: boolean;
    contactConfirmed: boolean;
    reachableChannelAvailable: boolean;
    readyToSend: boolean;
  };
  outreachBlockers: string[];
  outreachSubject: string;
  outreachDraft: string;
  outreachPackage: {
    shortEmail: string;
    longEmail: string;
    linkedinMessage: string;
    callOpening: string;
    attachmentBrief: string;
  };
  confidenceLevel: "high" | "medium" | "low";
  confidenceSummary: string;
  assumptions: string[];
  sourceCount: number;
  priorityScore: number;
  scoreBreakdown: {
    gapValidity: number;
    commercialValue: number;
    urgency: number;
    feasibility: number;
    partnerReachability: number;
    evidenceConfidence: number;
  };
  scoreExplanation: string;
  whyThisMarketExplanation: string;
  whyNowExplanation: string;
  howToEnterExplanation: string;
  whyThisPartnerExplanation: string;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function summarizeText(value?: string | null, fallback = "Not yet verified.") {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function deriveGapType(gap: GapDoc): DecisionOpportunityDraft["gapType"] {
  if (gap.gapType) {
    return gap.gapType === "shortage_gap" ? "shortage_gap" : gap.gapType;
  }
  const tender = normalizeText(gap.tenderSignals);
  const supply = normalizeText(gap.supplyGap);
  if (tender) return "tender_pull";
  if (supply.includes("not in mena") || supply.includes("not registered")) {
    return "regulatory_gap";
  }
  if (normalizeText(gap.competitorLandscape).includes("no competitors")) {
    return "channel_whitespace";
  }
  if (normalizeText(gap.demandEvidence).includes("priority")) {
    return "formulary_gap";
  }
  return "mixed";
}

function deriveIdentityStatus(
  drug: DrugDoc,
  company: CompanyDoc
): DecisionOpportunityDraft["productIdentityStatus"] {
  if (
    drug.primaryManufacturerName &&
    drug.primaryMarketAuthorizationHolderName &&
    company?.entityRoles &&
    company.entityRoles.length > 0
  ) {
    return "confirmed";
  }
  if (drug.primaryManufacturerName || drug.manufacturerName || company?.name) {
    return "likely";
  }
  return "uncertain";
}

function deriveRegulatoryFeasibility(
  gap: GapDoc
): DecisionOpportunityDraft["regulatoryFeasibility"] {
  switch (gap.regulatoryFeasibility) {
    case "high":
      return "easy";
    case "medium":
      return "moderate";
    case "low":
      return "complex";
    default:
      return "unknown";
  }
}

function deriveTimelineRange(level: DecisionOpportunityDraft["regulatoryFeasibility"]) {
  switch (level) {
    case "easy":
      return "6-9 months";
    case "moderate":
      return "9-12 months";
    case "complex":
      return "12-18 months";
    default:
      return "Needs validation";
  }
}

function summarizeCommercialValue(opportunities: MarketOpportunityDoc[]) {
  const prioritized = opportunities.find((item) => item.annualOpportunityRange)?.annualOpportunityRange;
  if (prioritized) return prioritized;
  const benchmark = opportunities.find((item) => item.primaryPriceBenchmark)?.primaryPriceBenchmark;
  if (benchmark) return benchmark;
  const fallback = opportunities.find((item) => item.marketSizeEstimate)?.marketSizeEstimate;
  return fallback;
}

function summarizeMarketAccess(opportunities: MarketOpportunityDoc[]) {
  const route = opportunities.find((item) => item.marketAccessRoute)?.marketAccessRoute;
  return route ?? null;
}

function deriveKeyConstraint(
  company: CompanyDoc,
  match: MatchDoc,
  identityStatus: DecisionOpportunityDraft["productIdentityStatus"]
) {
  if (identityStatus === "uncertain") {
    return "MAH / brand ownership needs validation before outreach.";
  }
  if (company?.menaPartnershipStrength === "entrenched") {
    return "Existing regional partner footprint may limit white-space access.";
  }
  if (company?.commercialControlLevel === "limited") {
    return "Commercial control may sit outside the identified approach entity.";
  }
  return summarizeText(
    match?.competitiveWhitespace,
    "Local regulatory path and exclusivity structure still need validation."
  );
}

function deriveEntryStrategy(company: CompanyDoc): {
  entryStrategy: DecisionOpportunityDraft["entryStrategy"];
  rationale: string;
} {
  if (!company) {
    return {
      entryStrategy: "watch",
      rationale: "Approach entity still needs validation before recommending a route to market.",
    };
  }

  if (company.commercialControlLevel === "limited") {
    return {
      entryStrategy: "licensing",
      rationale: "Commercial control appears limited, so a licensing or rights-led conversation is safer than a pure distribution pitch.",
    };
  }

  if (company.menaPartnershipStrength === "entrenched") {
    return {
      entryStrategy: "direct",
      rationale: "The company already appears operationally established in MENA, so direct market management is more likely than a fresh distributor mandate.",
    };
  }

  if (company.menaPartnershipStrength === "moderate") {
    return {
      entryStrategy: "watch",
      rationale: "There is some existing MENA coverage, so this opportunity needs whitespace validation before outreach.",
    };
  }

  return {
    entryStrategy: "distributor",
    rationale: "The company looks reachable and channel-light, which fits KEMEDICA's distributor-led entry model.",
  };
}

function buildScoreBreakdown(args: {
  gap: GapDoc;
  company: CompanyDoc;
  match: MatchDoc;
  drug: DrugDoc;
  identityStatus: DecisionOpportunityDraft["productIdentityStatus"];
  regulatoryFeasibility: DecisionOpportunityDraft["regulatoryFeasibility"];
  focusMarkets: string[];
  sourceCount: number;
  opportunities: MarketOpportunityDoc[];
}) {
  const gapValidityBase =
    args.gap.validationStatus === "confirmed"
      ? 9.1
      : args.gap.validationStatus === "likely"
        ? args.identityStatus === "confirmed"
          ? 8.2
          : args.identityStatus === "likely"
            ? 6.9
            : 4.8
        : 3.2;
  const registrationsPenalty = Math.min(args.drug.menaRegistrationCount ?? 0, 3) * 1.2;
  const gapValidity = clampScore(gapValidityBase - registrationsPenalty);

  const tenderBoost =
    args.gap.tenderSignals ||
    args.opportunities.some((item) => item.tenderOpportunity)
      ? 1.2
      : 0;
  const focusMarketBoost = args.focusMarkets.length >= 2 ? 1 : 0.5;
  const pricingBoost =
    args.opportunities.find((item) => item.pricingConfidence === "high")
      ? 1.1
      : args.opportunities.find((item) => item.pricingConfidence === "medium")
        ? 0.6
        : args.opportunities.find((item) => item.pricingConfidence === "low")
          ? 0.2
          : -0.4;
  const competitionDrag =
    args.opportunities.find((item) => item.competitionIntensity === "high")
      ? 1
      : args.opportunities.find((item) => item.competitionIntensity === "medium")
        ? 0.5
        : 0;
  const commercialValue = clampScore(
    args.gap.gapScore * 0.65 + tenderBoost + focusMarketBoost + pricingBoost - competitionDrag
  );

  const patentBoost =
    args.drug.patentUrgencyScore != null ? Math.min(args.drug.patentUrgencyScore, 2) : 0.8;
  const urgency = clampScore(
    (args.gap.tenderSignals ? 4.8 : 3.9) + patentBoost + (args.focusMarkets.length >= 1 ? 1 : 0)
  );

  const feasibilityBase =
    args.regulatoryFeasibility === "easy"
      ? 8.4
      : args.regulatoryFeasibility === "moderate"
        ? 6.6
        : args.regulatoryFeasibility === "complex"
          ? 4.2
          : 5;
  const controlPenalty =
    args.company?.commercialControlLevel === "limited"
      ? 1.2
      : args.company?.commercialControlLevel === "shared"
        ? 0.4
        : 0;
  const feasibility = clampScore(feasibilityBase - controlPenalty);

  const partnerBase = args.match?.distributorFitScore ?? args.company?.distributorFitScore ?? args.company?.bdScore ?? 5;
  const contactBoost = args.company?.contactName ? 0.8 : 0;
  const partnerPenalty =
    args.company?.approachTargetRecommendation === "deprioritize"
      ? 2
      : args.company?.menaPartnershipStrength === "entrenched"
        ? 1.5
        : 0;
  const partnerReachability = clampScore(partnerBase + contactBoost - partnerPenalty);

  const evidenceConfidence = clampScore(
    (args.sourceCount >= 5 ? 8.6 : args.sourceCount >= 3 ? 7.2 : 5.8) +
      (args.identityStatus === "uncertain" ? -1.6 : 0)
  );

  return {
    gapValidity,
    commercialValue,
    urgency,
    feasibility,
    partnerReachability,
    evidenceConfidence,
  };
}

function averageScore(breakdown: DecisionOpportunityDraft["scoreBreakdown"]) {
  return clampScore(
    (breakdown.gapValidity +
      breakdown.commercialValue +
      breakdown.urgency +
      breakdown.feasibility +
      breakdown.partnerReachability +
      breakdown.evidenceConfidence) /
      6
  );
}

function deriveConfidenceLevel(
  scoreBreakdown: DecisionOpportunityDraft["scoreBreakdown"],
  identityStatus: DecisionOpportunityDraft["productIdentityStatus"],
  gapValidationStatus?: GapDoc["validationStatus"]
): DecisionOpportunityDraft["confidenceLevel"] {
  if (gapValidationStatus === "insufficient_evidence") return "low";
  const avg = averageScore(scoreBreakdown);
  if (identityStatus === "uncertain") return "low";
  if (avg >= 7.5) return "high";
  if (avg >= 5.8) return "medium";
  return "low";
}

function buildOutreachDraft(args: {
  company: CompanyDoc;
  drug: DrugDoc;
  focusMarkets: string[];
  gap: GapDoc;
  entryStrategy: DecisionOpportunityDraft["entryStrategy"];
  whyNow: string;
  opportunities: MarketOpportunityDoc[];
}) {
  const recipient = args.company?.contactName ?? "the international business development team";
  const opener =
    args.company?.contactName != null
      ? `Dear ${args.company.contactName},`
      : "Hello,";
  const body = [
    opener,
    "",
    `KEMEDICA is seeing a timely entry window for ${args.drug.name} (${args.drug.genericName}) in ${args.focusMarkets.join(" and ")}.`,
    `The opportunity is driven by ${args.gap.indication.toLowerCase()} demand, visible whitespace in current MENA coverage, and a ${args.entryStrategy}-led route that can be executed with focused in-market support.`,
    `${args.whyNow}`,
    "",
    `If ${args.company?.name ?? "your team"} is evaluating MENA expansion, we would welcome a short discussion on how KEMEDICA could validate the route-to-market, regulatory path, and commercial partner model for ${args.drug.name}.`,
    "",
    "Best regards,",
    "KEMEDICA BD Team",
  ];
  const firstMarket = args.focusMarkets[0];
  const marketOpportunity =
    args.opportunities.find((item) => item.country === firstMarket) ??
    args.opportunities[0];
  const marketAccessSummary =
    marketOpportunity?.marketAccessNotes ??
    (marketOpportunity?.marketAccessRoute
      ? `Preferred first route: ${marketOpportunity.marketAccessRoute.replaceAll("_", " ")}.`
      : `Preferred first route: ${args.entryStrategy}.`);
  const shortEmail = [
    opener,
    "",
    `KEMEDICA is seeing a near-term whitespace opportunity for ${args.drug.name} in ${args.focusMarkets.join(", ")}.`,
    `If useful, we can share a concise market-entry view covering regulatory path, pricing corridor, and access route.`,
    "",
    "Best regards,",
    "KEMEDICA BD Team",
  ].join("\n");
  const linkedinMessage = `KEMEDICA sees a credible MENA entry window for ${args.drug.name} in ${args.focusMarkets.join(", ")}. We have a concise view on regulatory path, market access, and commercial whitespace if an international BD discussion would be useful.`;
  const callOpening = `We are calling because ${args.drug.name} appears to have a practical MENA whitespace opening in ${args.focusMarkets.join(" and ")}, with ${marketAccessSummary.toLowerCase()}`;
  const attachmentBrief = [
    `${args.drug.name} (${args.drug.genericName})`,
    `Focus markets: ${args.focusMarkets.join(", ")}`,
    `Why now: ${args.whyNow}`,
    `Gap summary: ${args.gap.evidenceSummary ?? args.gap.supplyGap}`,
    `Route to market: ${marketAccessSummary}`,
  ].join("\n");

  return {
    subject: `${args.drug.name} expansion opportunity in ${args.focusMarkets.join(" & ")}`,
    draft: body.join("\n"),
    shortEmail,
    longEmail: body.join("\n"),
    linkedinMessage,
    callOpening,
    attachmentBrief,
    targetRole:
      args.company?.contactTitle ??
      "Head of International Business Development / Licensing",
    recipient,
  };
}

function buildOutreachReadiness(args: {
  gap: GapDoc;
  company: CompanyDoc;
  identityStatus: DecisionOpportunityDraft["productIdentityStatus"];
  opportunities: MarketOpportunityDoc[];
}) {
  const gapConfirmed = args.gap.validationStatus === "confirmed";
  const ownershipConfirmed = args.identityStatus === "confirmed";
  const contactConfirmed = !!args.company?.keyContacts?.some(
    (contact) => !!contact.email || !!contact.linkedinUrl
  ) || !!args.company?.contactEmail || !!args.company?.linkedinUrl;
  const reachableChannelAvailable = args.opportunities.some(
    (item) =>
      item.marketAccessRoute != null ||
      item.marketAccessNotes != null ||
      item.availabilityStatus === "not_found"
  );
  const readyToSend =
    gapConfirmed && ownershipConfirmed && contactConfirmed && reachableChannelAvailable;

  const blockers = [
    !gapConfirmed ? "Gap evidence is not yet confirmed from structured market signals." : null,
    !ownershipConfirmed ? "Product ownership / MAH still needs confirmation." : null,
    !contactConfirmed ? "No email-ready or LinkedIn-ready contact is verified yet." : null,
    !reachableChannelAvailable ? "No clear initial market-access route is defined yet." : null,
  ].filter((item): item is string => item !== null);

  return {
    readiness: {
      gapConfirmed,
      ownershipConfirmed,
      contactConfirmed,
      reachableChannelAvailable,
      readyToSend,
    },
    blockers,
  };
}

export function buildDecisionOpportunityDraft(args: {
  gap: GapDoc;
  company: CompanyDoc;
  drug: DrugDoc;
  match: MatchDoc;
  sourceCount: number;
  opportunities: MarketOpportunityDoc[];
}) : DecisionOpportunityDraft {
  const focusMarkets = FOCUS_MARKETS.filter((country) =>
    args.gap.targetCountries.includes(country)
  );
  const selectedFocusMarkets =
    focusMarkets.length > 0
      ? [...focusMarkets]
      : args.gap.targetCountries.slice(0, Math.min(2, args.gap.targetCountries.length));
  const secondaryMarkets = args.gap.targetCountries.filter(
    (country) => !selectedFocusMarkets.includes(country)
  );
  const identityStatus = deriveIdentityStatus(args.drug, args.company);
  const regulatoryFeasibility = deriveRegulatoryFeasibility(args.gap);
  const entryStrategy = deriveEntryStrategy(args.company);
  const gapType = deriveGapType(args.gap);
  const primaryCountryProfile = getCountryCapabilityProfile(selectedFocusMarkets[0] ?? "Saudi Arabia");
  const approachEntityName =
    args.company?.name ??
    args.drug.primaryMarketAuthorizationHolderName ??
    args.drug.primaryManufacturerName ??
    args.drug.manufacturerName ??
    "Unknown approach entity";
  const approachEntityRole =
    args.company?.entityRoles?.includes("market_authorization_holder")
      ? "market_authorization_holder"
      : args.company?.entityRoles?.[0] ?? "unknown";
  const scoreBreakdown = buildScoreBreakdown({
    gap: args.gap,
    company: args.company,
    match: args.match,
    drug: args.drug,
    identityStatus,
    regulatoryFeasibility,
    focusMarkets: selectedFocusMarkets,
    sourceCount: args.sourceCount,
    opportunities: args.opportunities,
  });
  const priorityScore = averageScore(scoreBreakdown);
  const confidenceLevel = deriveConfidenceLevel(
    scoreBreakdown,
    identityStatus,
    args.gap.validationStatus
  );
  const whyThisMarket = `${selectedFocusMarkets.join(" and ")} concentrate the clearest near-term whitespace, while ${secondaryMarkets.length > 0 ? secondaryMarkets.slice(0, 2).join(" and ") : "the rest of MENA"} remain secondary follow-on markets.`;
  const whyNow = args.gap.tenderSignals
    ? "Recent procurement and tender pull make this a live rather than hypothetical market-entry window."
    : "The current gap appears actionable now because KEMEDICA can pursue whitespace before local channels harden.";
  const whyThisPartner = args.company
    ? `${args.company.name} combines a reachable BD surface with product ownership signals that make a focused MENA entry conversation realistic.`
    : "The approach entity still needs confirmation before outreach should begin.";
  const outreach = buildOutreachDraft({
    company: args.company,
    drug: args.drug,
    focusMarkets: selectedFocusMarkets,
    gap: args.gap,
    entryStrategy: entryStrategy.entryStrategy,
    whyNow,
    opportunities: args.opportunities,
  });
  const outreachReadiness = buildOutreachReadiness({
    gap: args.gap,
    company: args.company,
    identityStatus,
    opportunities: args.opportunities,
  });
  const bestCommercialRange = summarizeCommercialValue(args.opportunities);
  const preferredAccessRoute = summarizeMarketAccess(args.opportunities);

  return {
    title: `${args.drug.name} -> ${selectedFocusMarkets.join(" / ")}`,
    status: identityStatus === "uncertain" ? "needs_validation" : "active",
    therapeuticArea: args.drug.therapeuticArea,
    productName: args.drug.name,
    genericName: args.drug.genericName,
    manufacturerName:
      args.drug.primaryManufacturerName ?? args.drug.manufacturerName ?? undefined,
    marketAuthorizationHolderName:
      args.drug.primaryMarketAuthorizationHolderName ?? undefined,
    approachEntityName,
    approachEntityRole,
    focusMarkets: selectedFocusMarkets,
    secondaryMarkets,
    gapType,
    productIdentityStatus: identityStatus,
    gapSummary: summarizeText(
      args.gap.evidenceSummary ?? args.gap.supplyGap,
      "MENA whitespace needs validation against official registrations."
    ),
    commercialRationale: `${summarizeText(args.gap.demandEvidence, "Demand signal still developing.")} ${summarizeText(
      args.opportunities.find((item) => item.primaryPriceBenchmark)?.primaryPriceBenchmark,
      ""
    )} ${args.company?.distributorFitRationale ?? args.company?.bdScoreRationale ?? ""}`.trim(),
    marketAttractiveness: summarizeText(
      args.opportunities.find((item) => item.competitivePriceSummary)?.competitivePriceSummary ??
        args.gap.competitorLandscape,
      "Competitor intensity still needs market-by-market validation."
    ),
    marketSizeEstimate:
      bestCommercialRange ??
      (args.drug.menaRegistrationCount != null
        ? `${args.drug.menaRegistrationCount} confirmed MENA registrations in current internal checks`
        : undefined),
    demandProxy: summarizeText(args.gap.demandEvidence, "Directional demand proxy needs validation."),
    competitivePressure: summarizeText(
      args.opportunities.find((item) => item.competitionIntensity)?.competitionIntensity ??
        args.gap.competitorLandscape,
      "Competitive pressure not yet structured."
    ),
    regulatoryFeasibility,
    timelineRange:
      args.opportunities.find((item) => item.regulatoryTimeline)?.regulatoryTimeline ??
      primaryCountryProfile.expectedTimeline ??
      deriveTimelineRange(regulatoryFeasibility),
    keyConstraint: deriveKeyConstraint(args.company, args.match, identityStatus),
    entryStrategy: entryStrategy.entryStrategy,
    entryStrategyRationale: entryStrategy.rationale,
    whyThisMarket,
    whyNow,
    whyThisPartner,
    targetRole: outreach.targetRole,
    contactName: args.company?.contactName ?? undefined,
    contactTitle: args.company?.contactTitle ?? undefined,
    contactEmail: args.company?.contactEmail ?? undefined,
    contactLinkedinUrl: args.company?.linkedinUrl ?? undefined,
    contactConfidence: args.company?.contactName
      ? (args.company.keyContacts?.[0]?.confidence ?? "likely")
      : "none",
    outreachReadiness: outreachReadiness.readiness,
    outreachBlockers: outreachReadiness.blockers,
    outreachSubject: outreach.subject,
    outreachDraft: outreach.draft,
    outreachPackage: {
      shortEmail: outreach.shortEmail,
      longEmail: outreach.longEmail,
      linkedinMessage: outreach.linkedinMessage,
      callOpening: outreach.callOpening,
      attachmentBrief: outreach.attachmentBrief,
    },
    confidenceLevel,
    confidenceSummary:
      args.gap.validationStatus === "insufficient_evidence"
        ? "Gap evidence is still insufficient, so this opportunity should not be treated as outreach-ready."
        : identityStatus === "uncertain"
        ? "Product ownership and local white-space need validation before treating this as outreach-ready."
        : `Confidence is ${confidenceLevel} because the opportunity has ${args.sourceCount} supporting evidence item(s), a persisted partner thesis, and ${preferredAccessRoute ? `a ${preferredAccessRoute.replaceAll("_", " ")} route` : "an initial route-to-market view"}.`,
    assumptions: [
      "Phase 1 ranking prioritizes Saudi Arabia and UAE over wider MENA coverage.",
      "Directional regulatory and commercial signals are not a substitute for final human validation.",
      identityStatus === "uncertain"
        ? "Product identity and MAH relationship remain partially unresolved."
        : "Current entity mapping is sufficient for first-pass outreach qualification.",
    ],
    sourceCount: args.sourceCount,
    priorityScore,
    scoreBreakdown,
    scoreExplanation: `Score ${priorityScore}/10 from gap validity ${scoreBreakdown.gapValidity}, commercial value ${scoreBreakdown.commercialValue}, urgency ${scoreBreakdown.urgency}, feasibility ${scoreBreakdown.feasibility}, partner reachability ${scoreBreakdown.partnerReachability}, and evidence confidence ${scoreBreakdown.evidenceConfidence}.`,
    whyThisMarketExplanation: whyThisMarket,
    whyNowExplanation: whyNow,
    howToEnterExplanation: entryStrategy.rationale,
    whyThisPartnerExplanation: whyThisPartner,
  };
}
