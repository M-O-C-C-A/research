import { v } from "convex/values";
export const discoveryCountry = v.union(
  v.literal("UAE"),
  v.literal("Saudi Arabia"),
  v.literal("Egypt"),
);
export const discoveryReference = v.object({
  authority: v.union(v.literal("EU"), v.literal("US")),
  sourceId: v.string(),
  url: v.string(),
  approvedAt: v.string(),
  owner: v.string(),
});
export const discoveredMedicine = v.object({
  key: v.string(),
  brand: v.string(),
  inn: v.string(),
  owner: v.string(),
  indication: v.string(),
  area: v.string(),
  orphan: v.boolean(),
  advanced: v.boolean(),
  reference: discoveryReference,
});
export const discoveryMatch = v.object({
  name: v.string(),
  inn: v.string(),
  form: v.string(),
  strength: v.string(),
  owner: v.string(),
  record: v.string(),
});
export const discoveryMarket = v.object({
  country: discoveryCountry,
  status: v.union(
    v.literal("molecule_listed"),
    v.literal("no_molecule_match"),
    v.literal("not_checked"),
  ),
  matches: v.array(discoveryMatch),
  snapshotId: v.optional(v.id("registrationImports")),
  snapshotName: v.optional(v.string()),
  snapshotCheckedAt: v.optional(v.number()),
  checkedAt: v.number(),
});
export const discoveryClaim = v.object({
  country: v.union(
    discoveryCountry,
    v.literal("Regional"),
    v.literal("Global"),
  ),
  kind: v.union(
    v.literal("local_presence"),
    v.literal("partner"),
    v.literal("demand"),
    v.literal("contact"),
    v.literal("owner"),
    v.literal("reference_status"),
  ),
  claim: v.string(),
  excerpt: v.string(),
  url: v.string(),
  title: v.string(),
  observedAt: v.number(),
  verification: v.union(
    v.literal("page_excerpt_verified"),
    v.literal("provider_cited"),
  ),
});
export const discoveryResearchStatus = v.union(
  v.literal("not_started"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("no_findings"),
  v.literal("error"),
);
