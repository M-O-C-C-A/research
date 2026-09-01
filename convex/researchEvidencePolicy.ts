export type ResearchFindingCandidate = {
  kind: "product_profile" | "company_profile" | "ownership" | "registration" | "market_signal" | "partner" | "contact";
  country?: "Saudi Arabia" | "UAE" | "Egypt" | null;
  hasProviderSource: boolean;
  hasClaim: boolean;
  hasExcerpt: boolean;
  hasKnownCompany: boolean;
  knownCompanyCount: number;
  hasNamedContact: boolean;
  hasContactTitle: boolean;
  hasPublicContactRoute: boolean;
};

/**
 * Keeps research output reviewable and fail-closed before it is stored as a finding.
 * UAE registration status is only accepted from the authorized import flow, never web search.
 */
export function canStoreResearchFinding(candidate: ResearchFindingCandidate) {
  if (!candidate.hasProviderSource || !candidate.hasClaim || !candidate.hasExcerpt) return false;
  if (candidate.kind === "ownership" && !candidate.hasKnownCompany) return false;
  if (candidate.kind === "contact") {
    if (!candidate.hasKnownCompany && candidate.knownCompanyCount !== 1) return false;
    if (!candidate.hasNamedContact || !candidate.hasContactTitle || !candidate.hasPublicContactRoute) return false;
  }
  if (candidate.kind === "registration" && candidate.country === "UAE") return false;
  return true;
}
