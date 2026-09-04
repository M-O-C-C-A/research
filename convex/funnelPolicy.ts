export const CONTACT_READY_SCORE = 70;
export const CONTACT_FRESHNESS_MS = 90 * 24 * 60 * 60 * 1_000;
export const MONTHLY_CONTACT_READY_TARGET = 15;

export type AssessmentScores = {
  gapValidity: number;
  commercialValue: number;
  urgencyDemand: number;
  regulatoryFeasibility: number;
  partnerRightsReachability: number;
  evidenceConfidence: number;
};

export function calculateWeightedScore(scores: AssessmentScores) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return Math.round(
    clamp(scores.gapValidity) * 0.25 +
      clamp(scores.commercialValue) * 0.2 +
      clamp(scores.urgencyDemand) * 0.15 +
      clamp(scores.regulatoryFeasibility) * 0.15 +
      clamp(scores.partnerRightsReachability) * 0.15 +
      clamp(scores.evidenceConfidence) * 0.1,
  );
}

export function contactReadyBlockers(input: {
  productIdentityConfirmed: boolean;
  ownerConfirmed: boolean;
  registrationStatus: string;
  rightsStatus: string;
  strongSignalCount: number;
  mediumSignalCount: number;
  feasibilityReviewed: boolean;
  economicsStatus: string;
  criticalReviewOpen: boolean;
  weightedScore: number;
  contactVerifiedAt?: number;
  contactHasRoute: boolean;
  now: number;
  evidenceEngineVersion?: string;
  whiteSpaceStatus?: string;
  sourceExpiresAt?: number;
  companyReasonCode?: string;
  companyReasonEvidenceUrl?: string;
  commercialApprovalStatus?: string;
  intendedLocalApplicant?: string;
  nomineeCovenantStatus?: string;
  gateSnapshot?: {
    g1ReferenceApproval: string;
    g2EligibleCategory: string;
    g3WhiteSpace: string;
    g4CompanyAndRights: string;
    g5PriceChain: string;
    g6LifetimeEconomics: string;
    g7Demand: string;
  };
}) {
  const blockers: string[] = [];
  if (!input.productIdentityConfirmed)
    blockers.push("Product identity is not confirmed from official evidence.");
  if (!input.ownerConfirmed)
    blockers.push("Product owner or licensor is not confirmed.");
  if (input.evidenceEngineVersion === "v1.1") {
    if (
      !["no_match_in_snapshot", "no_match_in_targeted_check"].includes(
        input.whiteSpaceStatus ?? "",
      )
    )
      blockers.push(
        "A current snapshot or documented targeted registry check has not produced a scoped no-match finding.",
      );
    if (!input.sourceExpiresAt || input.sourceExpiresAt <= input.now)
      blockers.push(
        "The target-country registry evidence is stale or missing.",
      );
    if (
      !["ALREADY_PARTNERED_ELSEWHERE", "OUT_LICENSING"].includes(
        input.companyReasonCode ?? "UNCLASSIFIED",
      )
    ) {
      blockers.push("A cited positive company-intent reason is not approved.");
    }
    if (!input.companyReasonEvidenceUrl)
      blockers.push("Company-intent evidence needs a source URL.");
    if (input.commercialApprovalStatus !== "approved")
      blockers.push("Provisional commercial assumptions need human approval.");
    if (!input.intendedLocalApplicant?.trim())
      blockers.push("The intended local applicant is not recorded.");
    if (
      !["reviewed", "accepted"].includes(
        input.nomineeCovenantStatus ?? "not_requested",
      )
    )
      blockers.push("The nominee covenant has not been reviewed.");
    const requiredGates = input.gateSnapshot
      ? [
          input.gateSnapshot.g1ReferenceApproval,
          input.gateSnapshot.g2EligibleCategory,
          input.gateSnapshot.g3WhiteSpace,
          input.gateSnapshot.g4CompanyAndRights,
          input.gateSnapshot.g5PriceChain,
          input.gateSnapshot.g6LifetimeEconomics,
          input.gateSnapshot.g7Demand,
        ]
      : [];
    if (
      requiredGates.length !== 7 ||
      requiredGates.some((gate) => gate !== "PASS")
    )
      blockers.push("G1–G7 must all be PASS before contact readiness.");
  } else if (input.registrationStatus !== "verified_absent") {
    blockers.push(
      input.registrationStatus === "not_found_unverified"
        ? "A public not-found result still needs authorized absence review."
        : "Target-country registration absence is not verified.",
    );
  }
  if (input.rightsStatus !== "clear_no_conflict_found") {
    blockers.push(
      "Local agent, partner, and territory-rights clearance is incomplete.",
    );
  }
  if (input.strongSignalCount < 1 && input.mediumSignalCount < 2) {
    blockers.push(
      "Demand needs one strong official signal or two independent medium-strength sources.",
    );
  }
  if (!input.feasibilityReviewed)
    blockers.push(
      "Registration and route-to-market feasibility are not reviewed.",
    );
  if (input.economicsStatus === "unvalidated")
    blockers.push("Commercial sizing is still UNVALIDATED.");
  if (input.criticalReviewOpen)
    blockers.push("A critical review item remains open.");
  if (input.weightedScore < CONTACT_READY_SCORE)
    blockers.push(`Weighted score is below ${CONTACT_READY_SCORE}/100.`);
  if (
    !input.contactVerifiedAt ||
    input.now - input.contactVerifiedAt > CONTACT_FRESHNESS_MS
  ) {
    blockers.push(
      "Named contact verification is older than 90 days or missing.",
    );
  }
  if (!input.contactHasRoute)
    blockers.push(
      "The named contact has no public email or direct LinkedIn route.",
    );
  return blockers;
}
