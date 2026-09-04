import { describe, expect, it } from "vitest";
import {
  canGenerateOutreach,
  canonicalPursuitKey,
  evaluateEvidenceGates,
  evaluateSnapshotCoverage,
  isReferenceMarketCandidate,
  normalizedPresentationKey,
  shouldReopenParked,
  targetConfidence,
  whiteSpaceFinding,
  whiteSpaceStatement,
} from "./evidenceEngineV11Policy";

describe("KEMEDICA evidence engine v1.1 policy", () => {
  it("matches equivalent presentation spellings deterministically", () => {
    expect(
      normalizedPresentationKey({
        inn: "Aflibercept",
        dosageForm: "Solution for injection",
        strength: "40 mg / ml",
      }),
    ).toBe(
      normalizedPresentationKey({
        inn: "AFLIBERCEPT",
        dosageForm: "Injection",
        strength: "40mg/ml",
      }),
    );
  });

  it("rejects a registry snapshot when coverage moves beyond five percent", () => {
    expect(evaluateSnapshotCoverage(18_500, 20_000)).toMatchObject({
      health: "rejected",
      coverageChangePct: -7.5,
    });
    expect(evaluateSnapshotCoverage(20_600, 20_000).health).toBe("accepted");
  });

  it("never turns an unhealthy source into white space", () => {
    expect(whiteSpaceFinding(0, false)).toBe("source_unhealthy");
  });

  it("uses bounded country confidence and non-absolute language", () => {
    expect(targetConfidence("Saudi Arabia")).toBe("high");
    expect(targetConfidence("UAE")).toBe("medium");
    expect(targetConfidence("Egypt")).toBe("low");
    expect(
      whiteSpaceStatement({
        country: "Egypt",
        status: "no_match_in_snapshot",
        snapshotDate: Date.UTC(2026, 8, 4),
      }),
    ).toBe("No match found in the Egypt snapshot dated 2026-09-04.");
    expect(
      whiteSpaceStatement({
        country: "Saudi Arabia",
        status: "no_match_in_targeted_check",
        snapshotDate: Date.UTC(2026, 8, 4),
      }),
    ).toContain("This is not proof of market absence");
  });

  it("lets a documented targeted check satisfy G3 without claiming absence", () => {
    const gates = evaluateEvidenceGates({
      referenceApproved: true,
      eligibleCategory: true,
      whiteSpaceStatus: "no_match_in_targeted_check",
      companyReasonCode: "OUT_LICENSING",
      rightsCleared: true,
      referencePriceAvailable: true,
      priceChainPasses: true,
      economicsCalculated: true,
      commercialApproved: true,
      demandQualified: true,
    });
    expect(gates.g3WhiteSpace).toBe("PASS");
  });

  it("keeps missing price and unapproved economics out of pass state", () => {
    const gates = evaluateEvidenceGates({
      referenceApproved: true,
      eligibleCategory: true,
      whiteSpaceStatus: "no_match_in_snapshot",
      companyReasonCode: "OUT_LICENSING",
      rightsCleared: true,
      referencePriceAvailable: false,
      economicsCalculated: true,
      commercialApproved: false,
      demandQualified: true,
    });
    expect(gates.g5PriceChain).toBe("UNVALIDATED");
    expect(gates.g6LifetimeEconomics).toBe("PROVISIONAL");
  });

  it("fails aflibercept Egypt G5 when no cited reference price exists", () => {
    const key = normalizedPresentationKey({
      inn: "aflibercept",
      dosageForm: "injection",
      strength: "40mg/ml",
    });
    expect(key).toBe("aflibercept|injection|40mg/ml");
    const gates = evaluateEvidenceGates({
      referenceApproved: true,
      eligibleCategory: true,
      whiteSpaceStatus: "no_match_in_snapshot",
      companyReasonCode: "OUT_LICENSING",
      rightsCleared: true,
      referencePriceAvailable: false,
      economicsCalculated: false,
      commercialApproved: false,
      demandQualified: true,
    });
    expect(gates.g5PriceChain).toBe("UNVALIDATED");
  });

  it("does not treat UNCLASSIFIED as IGNORING or as a passing reason", () => {
    const gates = evaluateEvidenceGates({
      referenceApproved: true,
      eligibleCategory: true,
      whiteSpaceStatus: "no_match_in_snapshot",
      companyReasonCode: "UNCLASSIFIED",
      rightsCleared: true,
      referencePriceAvailable: true,
      priceChainPasses: true,
      economicsCalculated: true,
      commercialApproved: true,
      demandQualified: true,
    });
    expect(gates.g4CompanyAndRights).toBe("UNVALIDATED");
  });

  it("excludes pipeline assets, wholesalers, and top-20 owners", () => {
    const base = {
      authorizationStatus: "approved",
      productLifecycle: "marketed",
      isTop20Pharma: false,
      isWholesaler: false,
    };
    expect(isReferenceMarketCandidate(base)).toBe(true);
    expect(
      isReferenceMarketCandidate({ ...base, productLifecycle: "pipeline" }),
    ).toBe(false);
    expect(isReferenceMarketCandidate({ ...base, isWholesaler: true })).toBe(
      false,
    );
    expect(isReferenceMarketCandidate({ ...base, isTop20Pharma: true })).toBe(
      false,
    );
  });

  it("deduplicates on exact presentation and owner", () => {
    expect(
      canonicalPursuitKey("aflibercept|injection|40mg/ml", "owner-1"),
    ).toBe(canonicalPursuitKey("aflibercept|injection|40mg/ml", "owner-1"));
  });

  it("reopens PARKED only when its evidence changes", () => {
    expect(shouldReopenParked("old", "new")).toBe(true);
    expect(shouldReopenParked("same", "same")).toBe(false);
  });

  it("cannot generate outreach before v1.1 Contact Ready approval", () => {
    expect(canGenerateOutreach("qualified", "v1.1")).toBe(false);
    expect(canGenerateOutreach("contact_ready", "v1.0")).toBe(false);
    expect(canGenerateOutreach("contact_ready", "v1.1")).toBe(true);
  });
});
