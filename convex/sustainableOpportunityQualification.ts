const DAY = 24 * 60 * 60 * 1000;
const TEN_YEARS = 365 * 10 * DAY;

export const SUSTAINABLE_TARGET_COUNTRIES = ["Saudi Arabia", "UAE", "Egypt"] as const;

export type SustainableTargetCountry = (typeof SUSTAINABLE_TARGET_COUNTRIES)[number];
export type SustainableRegistrationStatus =
  | "registered"
  | "not_registered"
  | "not_found_unverified"
  | "verified_absent"
  | "under_registration"
  | "pending"
  | "withdrawn"
  | "suspended"
  | "unknown"
  | "not_found"
  | "unverified";

export type SustainableGateInput = {
  isOfficial: boolean;
  approvedAt?: number;
  now: number;
  productMatchCount: number;
  ownershipConfirmed: boolean;
  isTop20Owner: boolean;
  hasConfirmedMenaPresence: boolean;
  targetStatuses: Record<SustainableTargetCountry, SustainableRegistrationStatus | undefined>;
};

function statusBlocksWhitespace(status: SustainableRegistrationStatus | undefined) {
  return status === "registered" || status === "under_registration" || status === "pending";
}

function statusIsVerifiedAbsent(status: SustainableRegistrationStatus | undefined) {
  return status === "verified_absent" || status === "not_registered";
}

function statusNeedsReview(status: SustainableRegistrationStatus | undefined) {
  return !status || status === "unknown" || status === "not_found_unverified" || status === "not_found" || status === "unverified";
}

export function evaluateSustainableGate(input: SustainableGateInput) {
  const blockers: string[] = [];
  const qualifyingCountries: SustainableTargetCountry[] = [];
  const reviewCountries: SustainableTargetCountry[] = [];
  if (!input.isOfficial) blockers.push("Home approval evidence is not from an official source.");
  if (!input.approvedAt || input.approvedAt < input.now - TEN_YEARS) {
    blockers.push("Home approval is not within the last 10 years.");
  }
  if (input.productMatchCount !== 1) blockers.push("The home approval does not resolve to exactly one current product.");
  if (!input.ownershipConfirmed) blockers.push("Manufacturer or MAH ownership is not confirmed.");
  if (input.isTop20Owner) blockers.push("Owner matches the maintained top-20 pharma exclusion list.");
  if (input.hasConfirmedMenaPresence) blockers.push("Company already has confirmed MENA presence or partnerships.");

  for (const country of SUSTAINABLE_TARGET_COUNTRIES) {
    const status = input.targetStatuses[country];
    if (statusBlocksWhitespace(status)) {
      blockers.push(`${country} is already registered or under registration.`);
    } else if (statusIsVerifiedAbsent(status)) {
      qualifyingCountries.push(country);
    } else if (statusNeedsReview(status)) {
      reviewCountries.push(country);
    }
  }

  if (qualifyingCountries.length === 0) {
    blockers.push("No target country has official verified-absent registration evidence.");
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    qualifyingCountries,
    reviewCountries,
  };
}
