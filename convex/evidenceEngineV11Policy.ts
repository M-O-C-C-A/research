export const EVIDENCE_ENGINE_VERSION = "v1.1" as const;
export const SNAPSHOT_COVERAGE_TOLERANCE_PCT = 5;
export const PRESENTATION_SATURATION_THRESHOLD = 3;
export const CONTACT_READY_MONTHLY_TARGET = 15;

export type TargetCountry = "Saudi Arabia" | "UAE" | "Egypt";
export type AbsenceConfidence = "high" | "medium" | "low";
export type WhiteSpaceStatus =
  | "matches_found"
  | "no_match_in_snapshot"
  | "no_match_in_targeted_check"
  | "not_checked"
  | "source_unhealthy";
export type CompanyReasonCode =
  | "UNCLASSIFIED"
  | "ALREADY_PARTNERED_ELSEWHERE"
  | "OUT_LICENSING"
  | "PARKED"
  | "IGNORING"
  | "STRUCTURAL_NO";
export type GateStatus = "PASS" | "FAIL" | "UNVALIDATED" | "PROVISIONAL";

const DOSAGE_FORM_ALIASES: Record<string, string> = {
  cap: "capsule",
  caps: "capsule",
  capsule: "capsule",
  capsules: "capsule",
  inj: "injection",
  injectable: "injection",
  injection: "injection",
  iv: "injection",
  tab: "tablet",
  tabs: "tablet",
  tablet: "tablet",
  tablets: "tablet",
  oral_solution: "oral solution",
  solution_for_injection: "injection",
  solution_for_infusion: "infusion",
};

export function normalizeEvidenceText(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9.%/]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeDosageForm(value: string) {
  const normalized = normalizeEvidenceText(value).replaceAll(" ", "_");
  return DOSAGE_FORM_ALIASES[normalized] ?? normalized.replaceAll("_", " ");
}

export function normalizeStrength(value: string) {
  return normalizeEvidenceText(value)
    .replace(/\s*(mg|mcg|g|ml|iu|%)\s*/g, "$1")
    .replace(/\s*\/\s*/g, "/");
}

export function normalizedPresentationKey(input: {
  inn: string;
  dosageForm: string;
  strength: string;
}) {
  return [
    normalizeEvidenceText(input.inn),
    normalizeDosageForm(input.dosageForm),
    normalizeStrength(input.strength),
  ].join("|");
}

export function targetConfidence(country: TargetCountry): AbsenceConfidence {
  if (country === "Saudi Arabia") return "high";
  if (country === "UAE") return "medium";
  return "low";
}

export function evaluateSnapshotCoverage(
  currentRowCount: number,
  previousRowCount?: number,
) {
  if (!Number.isInteger(currentRowCount) || currentRowCount <= 0) {
    return { health: "rejected" as const, coverageChangePct: undefined };
  }
  if (!previousRowCount || previousRowCount <= 0) {
    return { health: "needs_review" as const, coverageChangePct: undefined };
  }
  const coverageChangePct =
    ((currentRowCount - previousRowCount) / previousRowCount) * 100;
  return {
    health:
      Math.abs(coverageChangePct) > SNAPSHOT_COVERAGE_TOLERANCE_PCT
        ? ("rejected" as const)
        : ("accepted" as const),
    coverageChangePct,
  };
}

export function whiteSpaceFinding(
  matchCount: number,
  sourceHealthy: boolean,
): WhiteSpaceStatus {
  if (!sourceHealthy) return "source_unhealthy";
  return matchCount > 0 ? "matches_found" : "no_match_in_snapshot";
}

export function whiteSpaceStatement(input: {
  country: TargetCountry;
  status: WhiteSpaceStatus;
  snapshotDate?: number;
}) {
  if (input.status === "matches_found")
    return `A matching presentation is listed in ${input.country}.`;
  if (input.status === "source_unhealthy")
    return `${input.country} source coverage is unhealthy; no conclusion is available.`;
  if (input.status === "not_checked")
    return input.country === "UAE"
      ? "UAE registration evidence has not been checked against the authorized directory snapshot."
      : `${input.country} requires a dated, documented targeted registry check.`;
  const date = input.snapshotDate
    ? new Date(input.snapshotDate).toISOString().slice(0, 10)
    : "the recorded date";
  return input.status === "no_match_in_targeted_check"
    ? `No match found during the targeted ${input.country} registry check dated ${date}. This is not proof of market absence.`
    : `No match found in the ${input.country} snapshot dated ${date}.`;
}

export function isPositiveCompanyReason(reason: CompanyReasonCode) {
  return reason === "ALREADY_PARTNERED_ELSEWHERE" || reason === "OUT_LICENSING";
}

export function evaluateEvidenceGates(input: {
  referenceApproved: boolean;
  eligibleCategory: boolean;
  whiteSpaceStatus: WhiteSpaceStatus;
  companyReasonCode: CompanyReasonCode;
  rightsCleared: boolean;
  referencePriceAvailable: boolean;
  priceChainPasses?: boolean;
  economicsCalculated: boolean;
  commercialApproved: boolean;
  demandQualified: boolean;
}) {
  return {
    g1ReferenceApproval: input.referenceApproved
      ? ("PASS" as const)
      : ("FAIL" as const),
    g2EligibleCategory: input.eligibleCategory
      ? ("PASS" as const)
      : ("FAIL" as const),
    g3WhiteSpace: [
      "no_match_in_snapshot",
      "no_match_in_targeted_check",
    ].includes(input.whiteSpaceStatus)
      ? ("PASS" as const)
      : input.whiteSpaceStatus === "matches_found"
        ? ("FAIL" as const)
        : ("UNVALIDATED" as const),
    g4CompanyAndRights:
      isPositiveCompanyReason(input.companyReasonCode) && input.rightsCleared
        ? ("PASS" as const)
        : input.companyReasonCode === "IGNORING" ||
            input.companyReasonCode === "STRUCTURAL_NO"
          ? ("FAIL" as const)
          : ("UNVALIDATED" as const),
    g5PriceChain: !input.referencePriceAvailable
      ? ("UNVALIDATED" as const)
      : input.priceChainPasses
        ? ("PASS" as const)
        : ("FAIL" as const),
    g6LifetimeEconomics: !input.economicsCalculated
      ? ("UNVALIDATED" as const)
      : input.commercialApproved
        ? ("PASS" as const)
        : ("PROVISIONAL" as const),
    g7Demand: input.demandQualified
      ? ("PASS" as const)
      : ("UNVALIDATED" as const),
  };
}

export function isReferenceMarketCandidate(input: {
  authorizationStatus: string;
  productLifecycle?: string;
  isTop20Pharma: boolean;
  isWholesaler: boolean;
}) {
  return (
    input.authorizationStatus === "approved" &&
    input.productLifecycle !== "pipeline" &&
    !input.isTop20Pharma &&
    !input.isWholesaler
  );
}

export function canonicalPursuitKey(
  normalizedPresentation: string,
  ownerId: string,
) {
  return `${normalizedPresentation}|${ownerId}`;
}

export function canGenerateOutreach(stage: string, engineVersion?: string) {
  return stage === "contact_ready" && engineVersion === EVIDENCE_ENGINE_VERSION;
}

export function shouldReopenParked(
  previousEvidenceHash: string,
  currentEvidenceHash: string,
) {
  return previousEvidenceHash !== currentEvidenceHash;
}
