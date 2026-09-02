export const CONTACT_READY_SCORE = 70;
export const CONTACT_FRESHNESS_MS = 90 * 24 * 60 * 60 * 1_000;
export const MONTHLY_CONTACT_READY_CAP = 15;

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
}) {
  const blockers: string[] = [];
  if (!input.productIdentityConfirmed) blockers.push("Product identity is not confirmed from official evidence.");
  if (!input.ownerConfirmed) blockers.push("Product owner or licensor is not confirmed.");
  if (input.registrationStatus !== "verified_absent") {
    blockers.push(
      input.registrationStatus === "not_found_unverified"
        ? "A public not-found result still needs authorized absence review."
        : "Target-country registration absence is not verified.",
    );
  }
  if (input.rightsStatus !== "clear_no_conflict_found") {
    blockers.push("Local agent, partner, and territory-rights clearance is incomplete.");
  }
  if (input.strongSignalCount < 1 && input.mediumSignalCount < 2) {
    blockers.push("Demand needs one strong official signal or two independent medium-strength sources.");
  }
  if (!input.feasibilityReviewed) blockers.push("Registration and route-to-market feasibility are not reviewed.");
  if (input.economicsStatus === "unvalidated") blockers.push("Commercial sizing is still UNVALIDATED.");
  if (input.criticalReviewOpen) blockers.push("A critical review item remains open.");
  if (input.weightedScore < CONTACT_READY_SCORE) blockers.push(`Weighted score is below ${CONTACT_READY_SCORE}/100.`);
  if (!input.contactVerifiedAt || input.now - input.contactVerifiedAt > CONTACT_FRESHNESS_MS) {
    blockers.push("Named contact verification is older than 90 days or missing.");
  }
  if (!input.contactHasRoute) blockers.push("The named contact has no public email or direct LinkedIn route.");
  return blockers;
}
