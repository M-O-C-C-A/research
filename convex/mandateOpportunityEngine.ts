export const MANDATE_COUNTRIES = ["Saudi Arabia", "UAE", "Egypt"] as const;

export const OPPORTUNITY_TYPES = [
  "NEW_MARKET_GAP",
  "UNMET_CLINICAL_NEED",
  "CURRENT_SHORTAGE",
  "ANTICIPATED_SHORTAGE",
  "SECOND_SOURCE",
  "TENDER_DEMAND",
  "REGULATORY_INCENTIVE",
  "PIPELINE_OPPORTUNITY",
] as const;

export const SCORE_CAPS = {
  unmetNeed: 25,
  marketEvidence: 20,
  competitiveGap: 15,
  regulatoryFeasibility: 15,
  commercialAttractiveness: 15,
  partnerability: 10,
} as const;

export type MandateCountry = (typeof MANDATE_COUNTRIES)[number];
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type MandateDecision = "PURSUE" | "VALIDATE" | "HOLD" | "REJECT";
export type SourceTier = "Tier A" | "Tier B" | "Tier C" | "Tier D" | "Tier E";
export type EvidenceConfidence = "confirmed" | "likely" | "inferred";

export type MandateScoreBreakdown = {
  unmetNeed: number;
  marketEvidence: number;
  competitiveGap: number;
  regulatoryFeasibility: number;
  commercialAttractiveness: number;
  partnerability: number;
};

export type MandateEvidenceInput = {
  claim: string;
  title?: string;
  url?: string;
  evidenceType?: string;
  sourceTier?: SourceTier;
  sourceType?: string;
  country?: string;
  excerpt?: string;
  confidence?: EvidenceConfidence;
};

export type MandateOpportunityInput = {
  productName: string;
  genericName: string;
  indication?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  therapeuticArea?: string;
  manufacturerName?: string;
  marketAuthorizationHolderName?: string;
  approvalStatus?: "approved" | "pending" | "withdrawn";
  euRegulatoryStatus?: string;
  productIdentityStatus?: "confirmed" | "likely" | "uncertain";
  focusMarkets: string[];
  gapType?: string;
  gapSummary?: string;
  demandProxy?: string;
  commercialRationale?: string;
  marketSizeEstimate?: string;
  competitivePressure?: string;
  regulatoryFeasibility?: "easy" | "moderate" | "complex" | "unknown";
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactLinkedinUrl?: string;
  contactConfidence?: "confirmed" | "likely" | "inferred" | "none";
  companyName?: string;
  companySize?: "sme" | "mid" | "large";
  menaPresence?: "none" | "limited" | "established";
  partnerabilitySignals?: string[];
  existingMenaPartners?: Array<{ name: string; geographies: string[]; role: string }>;
  opportunityRows?: Array<{
    country: string;
    availabilityStatus?: string;
    regulatoryStatus?: string;
    competitorPresence?: string;
    competitionIntensity?: string;
    tenderOpportunity?: boolean;
    tenderSignalStrength?: string;
    annualOpportunityRange?: string;
    commercialOpportunityScore?: number;
    marketSizeEstimate?: string;
    patientPopulationText?: string;
    addressablePopulation?: string;
    evidenceItems?: MandateEvidenceInput[];
  }>;
  evidence: MandateEvidenceInput[];
};

export type MandateCountryAssessmentDraft = {
  country: MandateCountry;
  registration: string;
  availability: string;
  shortage: string;
  anticipatedShortage: string;
  incentiveList: string;
  alternatives: string;
  competition: string;
  demandEvidence: string;
  procurementEvidence: string;
  regulatoryPath: string;
  commercialPotential: string;
  existingRepresentation?: string;
  unknowns: string[];
  absenceStatus: "VERIFIED_ABSENT" | "UNKNOWN" | "NOT_APPLICABLE";
};

export type MandateReportDraft = {
  product: {
    inn: string;
    brand: string;
    indication: string;
    strengthForm: string;
    route: string;
    mah: string;
    manufacturer: string;
    euRegulatoryStatus: string;
  };
  thesis: string;
  opportunityTypes: OpportunityType[];
  countryAssessments: MandateCountryAssessmentDraft[];
  manufacturerFit: {
    company: string;
    menaPresence: string;
    existingPartners: string;
    internationalLicensingEvidence: string;
    relevantContact: string;
    whyTheyMightWorkWithKemedica: string;
  };
  economics: {
    estimatedAddressablePatients: string;
    potentialUnits: string;
    priceEvidence: string;
    potentialRevenueRange: string;
    expectedMarginRange: string;
    confidence: "high" | "medium" | "low" | "UNVALIDATED";
    missingInformation: string[];
  };
  risks: string[];
  score: MandateScoreBreakdown;
  totalScore: number;
  decision: MandateDecision;
  rejectionReason?: string;
  nextAction: string;
  validationNeeds: string[];
  discoveryDirections: Array<"EU_TO_MIDDLE_EAST" | "MENA_TO_EU">;
  evidence: Array<Required<Pick<MandateEvidenceInput, "claim" | "title" | "url" | "sourceType" | "excerpt" | "confidence">> & {
    sourceTier: SourceTier;
    publicationDate?: string;
    retrievalDate: string;
    country?: MandateCountry;
  }>;
};

function text(value?: string | null, fallback = "UNKNOWN") {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, Number(value.toFixed(1))));
}

function hasMeaningful(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && !["unknown", "unvalidated", "not yet verified"].includes(normalized));
}

function countryFromString(value?: string): MandateCountry | undefined {
  return MANDATE_COUNTRIES.find((country) => country.toLowerCase() === value?.toLowerCase());
}

function isOfficialEvidence(item: MandateEvidenceInput) {
  return (
    item.sourceTier === "Tier A" ||
    ["regulatory", "market", "gap"].includes(item.evidenceType ?? "") ||
    ["official_registry", "shortage_list", "tender_portal", "public_procurement"].includes(
      item.sourceType ?? ""
    )
  );
}

function normalizeEvidence(items: MandateEvidenceInput[]) {
  const retrievalDate = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  return items
    .filter((item) => hasMeaningful(item.claim) && hasMeaningful(item.url))
    .map((item) => {
      const sourceTier = item.sourceTier ?? (isOfficialEvidence(item) ? "Tier A" : "Tier B");
      return {
        claim: text(item.claim),
        title: text(item.title, "Untitled source"),
        url: text(item.url),
        sourceType: text(item.sourceType, item.evidenceType ?? "public_web"),
        sourceTier,
        publicationDate: undefined,
        retrievalDate,
        excerpt: text(item.excerpt, item.claim),
        confidence: item.confidence ?? "likely",
        country: countryFromString(item.country),
      };
    })
    .filter((item) => {
      const key = `${item.url}|${item.claim}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function classifyOpportunity(input: MandateOpportunityInput): OpportunityType[] {
  const types = new Set<OpportunityType>();
  const gap = input.gapType ?? "";
  if (gap.includes("regulatory") || gap.includes("formulary") || gap.includes("channel")) {
    types.add("NEW_MARKET_GAP");
  }
  if (hasMeaningful(input.demandProxy) || hasMeaningful(input.gapSummary)) {
    types.add("UNMET_CLINICAL_NEED");
  }
  if (gap.includes("shortage") || input.evidence.some((item) => /current shortage/i.test(item.claim))) {
    types.add("CURRENT_SHORTAGE");
  }
  if (input.evidence.some((item) => /anticipated shortage/i.test(item.claim))) {
    types.add("ANTICIPATED_SHORTAGE");
  }
  if (input.evidence.some((item) => /tender|procurement/i.test(item.claim))) {
    types.add("TENDER_DEMAND");
  }
  if (input.approvalStatus === "pending" || input.euRegulatoryStatus?.toLowerCase().includes("under")) {
    types.add("PIPELINE_OPPORTUNITY");
  }
  if (input.evidence.some((item) => /incentive/i.test(item.claim))) {
    types.add("REGULATORY_INCENTIVE");
  }
  if (types.size === 0) types.add("UNMET_CLINICAL_NEED");
  return [...types];
}

function buildCountryAssessment(
  country: MandateCountry,
  input: MandateOpportunityInput
): MandateCountryAssessmentDraft {
  const row = input.opportunityRows?.find((item) => item.country === country);
  const countryEvidence = [
    ...input.evidence.filter((item) => item.country === country),
    ...(row?.evidenceItems ?? []),
  ];
  const hasShortage = countryEvidence.some((item) => /shortage/i.test(item.claim));
  const hasAnticipated = countryEvidence.some((item) => /anticipated/i.test(item.claim));
  const hasTender = countryEvidence.some((item) => /tender|procurement/i.test(item.claim));
  const availability = text(row?.availabilityStatus, country === "UAE" ? "UNKNOWN" : "UNKNOWN");
  const absenceStatus =
    availability === "not_found" && countryEvidence.some((item) => item.sourceType === "official_registry")
      ? "VERIFIED_ABSENT"
      : "UNKNOWN";

  return {
    country,
    registration: text(row?.regulatoryStatus ?? availability),
    availability,
    shortage: hasShortage ? "Evidence captured" : "UNKNOWN",
    anticipatedShortage: hasAnticipated ? "Evidence captured" : "UNKNOWN",
    incentiveList: countryEvidence.some((item) => /incentive/i.test(item.claim))
      ? "Evidence captured"
      : "UNKNOWN",
    alternatives: "UNKNOWN",
    competition: text(row?.competitionIntensity ?? row?.competitorPresence),
    demandEvidence: text(
      countryEvidence.find((item) => /demand|prevalence|patient|shortage|tender|procurement/i.test(item.claim))
        ?.claim ?? row?.patientPopulationText ?? row?.addressablePopulation
    ),
    procurementEvidence: hasTender ? text(countryEvidence.find((item) => /tender|procurement/i.test(item.claim))?.claim) : "UNKNOWN",
    regulatoryPath:
      country === "Saudi Arabia"
        ? "SFDA product registration with local applicant/importer requirements to validate."
        : country === "UAE"
          ? "EDE/MOHAP registration or imported official listing required; web claims remain validation context only."
          : "EDA registration path to validate against the official product category and dossier route.",
    commercialPotential: text(row?.annualOpportunityRange ?? row?.marketSizeEstimate),
    existingRepresentation:
      country === "UAE" ? text(input.existingMenaPartners?.find((partner) => partner.geographies.includes(country))?.name) : undefined,
    unknowns: [
      !row?.regulatoryStatus ? "Registration status requires authoritative confirmation." : "",
      !hasTender ? "Procurement/tender evidence is not yet validated." : "",
      !row?.annualOpportunityRange && !row?.marketSizeEstimate ? "Economics are UNVALIDATED." : "",
    ].filter(Boolean),
    absenceStatus,
  };
}

export function scoreMandateOpportunity(input: MandateOpportunityInput): MandateScoreBreakdown {
  const evidence = normalizeEvidence([
    ...input.evidence,
    ...(input.opportunityRows ?? []).flatMap((row) => row.evidenceItems ?? []),
  ]);
  const officialEvidenceCount = evidence.filter((item) => item.sourceTier === "Tier A").length;
  const targetCountryRows = input.opportunityRows?.filter((row) =>
    MANDATE_COUNTRIES.includes(row.country as MandateCountry)
  ) ?? [];
  const hasDemand = hasMeaningful(input.demandProxy) || evidence.some((item) => /demand|prevalence|shortage|tender|procurement/i.test(item.claim));
  const hasMarketSignal = evidence.some((item) => /shortage|tender|procurement|incentive/i.test(item.claim));
  const hasGap = input.focusMarkets.some((country) => MANDATE_COUNTRIES.includes(country as MandateCountry));
  const hasCommercialEvidence =
    hasMeaningful(input.marketSizeEstimate) ||
    targetCountryRows.some((row) => hasMeaningful(row.annualOpportunityRange) || hasMeaningful(row.marketSizeEstimate));
  const partnerable =
    input.companySize !== "large" &&
    input.menaPresence !== "established" &&
    (input.partnerabilitySignals?.length ?? 0) > 0;

  return {
    unmetNeed: clamp((hasDemand ? 14 : 4) + (hasMarketSignal ? 7 : 0) + (hasGap ? 4 : 0), SCORE_CAPS.unmetNeed),
    marketEvidence: clamp(officialEvidenceCount * 4 + (hasMarketSignal ? 6 : 0), SCORE_CAPS.marketEvidence),
    competitiveGap: clamp(
      targetCountryRows.some((row) => row.availabilityStatus === "formally_registered") ? 5 : hasGap ? 11 : 4,
      SCORE_CAPS.competitiveGap
    ),
    regulatoryFeasibility: clamp(
      input.regulatoryFeasibility === "easy"
        ? 13
        : input.regulatoryFeasibility === "moderate"
          ? 10
          : input.regulatoryFeasibility === "complex"
            ? 6
            : 3,
      SCORE_CAPS.regulatoryFeasibility
    ),
    commercialAttractiveness: clamp((hasCommercialEvidence ? 10 : 3) + (hasMarketSignal ? 3 : 0), SCORE_CAPS.commercialAttractiveness),
    partnerability: clamp(partnerable ? 8 : input.contactName || input.contactEmail || input.contactLinkedinUrl ? 5 : 2, SCORE_CAPS.partnerability),
  };
}

export function totalMandateScore(score: MandateScoreBreakdown) {
  return Object.values(score).reduce((sum, value) => sum + value, 0);
}

export function evaluateMandateDecision(input: MandateOpportunityInput, score: MandateScoreBreakdown) {
  const blockers: string[] = [];
  const validationNeeds: string[] = [];
  const hasIdentity =
    hasMeaningful(input.productName) &&
    hasMeaningful(input.genericName) &&
    hasMeaningful(input.indication) &&
    (hasMeaningful(input.manufacturerName) || hasMeaningful(input.marketAuthorizationHolderName));
  const hasApproval = input.approvalStatus === "approved" || input.approvalStatus === "pending";
  const hasDemand = score.unmetNeed >= 12 && score.marketEvidence >= 6;
  const hasRegulatoryPath = input.regulatoryFeasibility !== "unknown";
  const hasCommercial = score.commercialAttractiveness >= 8;
  const hasContactRoute =
    hasMeaningful(input.contactName) &&
    (hasMeaningful(input.contactEmail) || hasMeaningful(input.contactLinkedinUrl)) &&
    input.contactConfidence !== "none";

  if (!hasIdentity) blockers.push("IDENTITY_UNVERIFIED");
  if (!hasApproval) blockers.push("REGULATORY_PRODUCT_STATUS_UNVERIFIED");
  if (!hasDemand) validationNeeds.push("Validate demand with a Tier A shortage, tender, procurement, incentive, or epidemiology source.");
  if (!hasRegulatoryPath) validationNeeds.push("Validate the country-specific regulatory path with the competent authority or local RA advisor.");
  if (!hasCommercial) validationNeeds.push("Validate patient volume, expected units, and net price range.");
  if (!hasContactRoute) validationNeeds.push("Validate a named BD/licensing/international-commercial contact and public outreach route.");

  if (blockers.length > 0) {
    return { decision: "REJECT" as const, rejectionReason: blockers[0], validationNeeds };
  }
  if (validationNeeds.length === 0 && totalMandateScore(score) >= 70) {
    return { decision: "PURSUE" as const, validationNeeds };
  }
  if (validationNeeds.length <= 2 && totalMandateScore(score) >= 55) {
    return { decision: "VALIDATE" as const, validationNeeds };
  }
  return { decision: "HOLD" as const, validationNeeds };
}

export function buildMandateReportDraft(input: MandateOpportunityInput): MandateReportDraft {
  const evidence = normalizeEvidence([
    ...input.evidence,
    ...(input.opportunityRows ?? []).flatMap((row) => row.evidenceItems ?? []),
  ]);
  const score = scoreMandateOpportunity(input);
  const totalScore = totalMandateScore(score);
  const decisionResult = evaluateMandateDecision(input, score);
  const opportunityTypes = classifyOpportunity(input);
  const hasMenaSignal = evidence.some((item) =>
    /shortage|tender|procurement|incentive|sfda|nupco|etimad|egypt|uae|mohap|ede/i.test(
      `${item.claim} ${item.title} ${item.url}`
    )
  );

  return {
    product: {
      inn: text(input.genericName),
      brand: text(input.productName),
      indication: text(input.indication),
      strengthForm: [input.strength, input.dosageForm].filter(Boolean).join(" / ") || "UNKNOWN",
      route: text(input.route),
      mah: text(input.marketAuthorizationHolderName),
      manufacturer: text(input.manufacturerName),
      euRegulatoryStatus: text(input.euRegulatoryStatus, input.approvalStatus ?? "UNKNOWN"),
    },
    thesis: text(
      input.commercialRationale,
      `${text(input.productName)} may fit KEMEDICA if the market gap, demand, regulatory path, economics, and partner route can be validated.`
    ),
    opportunityTypes,
    countryAssessments: MANDATE_COUNTRIES.map((country) => buildCountryAssessment(country, input)),
    manufacturerFit: {
      company: text(input.companyName ?? input.manufacturerName ?? input.marketAuthorizationHolderName),
      menaPresence: text(input.menaPresence),
      existingPartners:
        input.existingMenaPartners?.map((partner) => `${partner.name} (${partner.geographies.join(", ")})`).join("; ") ??
        "UNKNOWN",
      internationalLicensingEvidence: text(input.partnerabilitySignals?.join("; ")),
      relevantContact: text(
        [input.contactName, input.contactTitle, input.contactEmail ?? input.contactLinkedinUrl]
          .filter(Boolean)
          .join(" / ")
      ),
      whyTheyMightWorkWithKemedica:
        input.menaPresence === "none" || input.menaPresence === "limited"
          ? "Limited visible MENA presence supports a local partner thesis, subject to rights validation."
          : "Existing regional presence may limit the available KEMEDICA role.",
    },
    economics: {
      estimatedAddressablePatients: text(
        input.opportunityRows?.find((row) => hasMeaningful(row.patientPopulationText))?.patientPopulationText ??
          input.opportunityRows?.find((row) => hasMeaningful(row.addressablePopulation))?.addressablePopulation
      ),
      potentialUnits: "UNVALIDATED",
      priceEvidence: text(input.marketSizeEstimate),
      potentialRevenueRange: text(
        input.opportunityRows?.find((row) => hasMeaningful(row.annualOpportunityRange))?.annualOpportunityRange ??
          input.marketSizeEstimate,
        "UNVALIDATED"
      ),
      expectedMarginRange: "UNVALIDATED",
      confidence: score.commercialAttractiveness >= 12 ? "medium" : "UNVALIDATED",
      missingInformation: [
        "Manufacturer transfer price",
        "Tender discount expectations",
        "MOQs, shelf life, logistics, pharmacovigilance, and working-capital assumptions",
      ],
    },
    risks: [
      ...decisionResult.validationNeeds,
      input.menaPresence === "established" ? "RIGHTS_UNAVAILABLE: existing MENA presence may constrain partnerability." : "",
      evidence.length === 0 ? "Evidence base is not yet sufficient for external outreach." : "",
    ].filter(Boolean),
    score,
    totalScore,
    decision: decisionResult.decision,
    rejectionReason: decisionResult.rejectionReason,
    nextAction:
      decisionResult.decision === "PURSUE"
        ? "Contact the named manufacturer/MAH BD route with the mandate report and request rights/representation validation."
        : decisionResult.validationNeeds[0] ?? "Validate the highest-risk missing evidence item before outreach.",
    validationNeeds: decisionResult.validationNeeds,
    discoveryDirections: ["EU_TO_MIDDLE_EAST", ...(hasMenaSignal ? (["MENA_TO_EU"] as const) : [])],
    evidence,
  };
}
