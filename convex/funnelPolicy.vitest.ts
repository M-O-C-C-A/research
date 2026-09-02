import { describe, expect, it } from "vitest";
import { calculateWeightedScore, contactReadyBlockers } from "./funnelPolicy";

const ready = {
  productIdentityConfirmed: true,
  ownerConfirmed: true,
  registrationStatus: "verified_absent",
  rightsStatus: "clear_no_conflict_found",
  strongSignalCount: 1,
  mediumSignalCount: 0,
  feasibilityReviewed: true,
  economicsStatus: "conservative_range",
  criticalReviewOpen: false,
  weightedScore: 70,
  contactVerifiedAt: 1_000,
  contactHasRoute: true,
  now: 2_000,
};

describe("canonical funnel policy", () => {
  it("applies the approved 25/20/15/15/15/10 score weights", () => {
    expect(calculateWeightedScore({
      gapValidity: 100,
      commercialValue: 50,
      urgencyDemand: 80,
      regulatoryFeasibility: 60,
      partnerRightsReachability: 40,
      evidenceConfidence: 90,
    })).toBe(71);
  });

  it("allows a fully reviewed assessment at the 70 point threshold", () => {
    expect(contactReadyBlockers(ready)).toEqual([]);
  });

  it("never treats a public not-found result as verified absence", () => {
    const blockers = contactReadyBlockers({ ...ready, registrationStatus: "not_found_unverified" });
    expect(blockers).toContain("A public not-found result still needs authorized absence review.");
  });

  it("requires one strong or two independent medium demand sources", () => {
    expect(contactReadyBlockers({ ...ready, strongSignalCount: 0, mediumSignalCount: 1 }))
      .toContain("Demand needs one strong official signal or two independent medium-strength sources.");
    expect(contactReadyBlockers({ ...ready, strongSignalCount: 0, mediumSignalCount: 2 })).toEqual([]);
  });

  it("blocks UNVALIDATED sizing even if the score passes", () => {
    expect(contactReadyBlockers({ ...ready, economicsStatus: "unvalidated" }))
      .toContain("Commercial sizing is still UNVALIDATED.");
  });

  it("expires contact verification after 90 days", () => {
    const day = 24 * 60 * 60 * 1_000;
    const blockers = contactReadyBlockers({ ...ready, contactVerifiedAt: 0, now: 91 * day });
    expect(blockers).toContain("Named contact verification is older than 90 days or missing.");
  });
});
