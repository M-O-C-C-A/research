const DAY = 24 * 60 * 60 * 1000;

export type LeadGateInput = {
  isOfficial: boolean;
  observedAt: number;
  now: number;
  signalType: string;
  productMatchCount: number;
  ownershipConfirmed: boolean;
  conflictingMarketAccess: boolean;
  hasNamedContact: boolean;
  hasPublicRoute: boolean;
  contactVerifiedAt?: number;
};

export function isOutreachQualifyingSignal(signalType: string) {
  return ["shortage", "anticipated_shortage", "tender", "procurement"].includes(signalType);
}

export function evaluateLeadGate(input: LeadGateInput) {
  const blockers: string[] = [];
  if (!input.isOfficial) blockers.push("Market evidence is not from an official source.");
  if (input.observedAt < input.now - 14 * DAY) blockers.push("Market evidence is older than 14 days.");
  if (!isOutreachQualifyingSignal(input.signalType)) {
    blockers.push("The signal type is not outreach-qualifying.");
  }
  if (input.productMatchCount !== 1) blockers.push("The source does not resolve to exactly one current product.");
  if (!input.ownershipConfirmed) blockers.push("Manufacturer or MAH ownership is not confirmed.");
  if (input.conflictingMarketAccess) blockers.push("A confirmed market partner conflicts with this thesis.");
  if (!input.hasNamedContact) blockers.push("No named decision-maker is available.");
  if (!input.hasPublicRoute) blockers.push("No public work email or direct LinkedIn route is available.");
  if (!input.contactVerifiedAt || input.contactVerifiedAt < input.now - 90 * DAY) {
    blockers.push("The contact has not been verified in the last 90 days.");
  }

  return { eligible: blockers.length === 0, blockers };
}
