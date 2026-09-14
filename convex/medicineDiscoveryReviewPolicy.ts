import type { Doc } from "./_generated/dataModel";
import { discoveryTerm, normalizedSourceUrl } from "./medicineDiscoveryPolicy";

export const RESEARCH_POLICY_VERSION = 2;
export const RESEARCH_CHECKS = [
  {
    key: "brand",
    label: "Brand and alternate names",
    task: "Search the exact brand and alternate brand names for UAE, Saudi Arabia, Egypt and MENA registration, launches and distribution agreements.",
  },
  {
    key: "ingredient",
    label: "Ingredient and development aliases",
    task: "Search the ingredient and development aliases separately for UAE, Saudi Arabia, Egypt and MENA access, licensing and distribution agreements.",
  },
  {
    key: "owner",
    label: "Owner, parent company and acquisitions",
    task: "Identify the parent company and ownership aliases. Search owner-level MENA agreements even if the product is not named; retain these as possible relationships with unresolved product scope.",
  },
  {
    key: "manufacturer",
    label: "Manufacturer announcements",
    task: "Check the manufacturer's official news, investor announcements and portfolio for Middle East, North Africa, GCC and country partnerships. Return relevant original announcement URLs.",
  },
  {
    key: "distributors",
    label: "Regional distributor announcements",
    task: "Search regional distributor news and portfolios for the medicine and its owner. Include NewBridge, Taiba and Swixx where relevant, and search for other partners. Do not assume those examples are exhaustive.",
  },
  {
    key: "need",
    label: "Country clinical need",
    task: "Find primary clinical or health authority evidence of the indication's treatment/access limitations in UAE, Saudi Arabia or Egypt. Disease burden is not proven product demand.",
  },
  {
    key: "contact",
    label: "Company identity and contact route",
    task: "Find an official manufacturer partnering/contact route. Verify the company identity, not just a similar company name. Never infer willingness or available rights.",
  },
  {
    key: "challenge",
    label: "Independent disqualification search",
    task: "Independently try to disqualify this opportunity. Search for existing registration, launches, owner-level or product-level regional representation, acquisitions, withdrawal and suspension. Seek sources missing from the earlier research. Preserve ambiguous agreements; never conclude rights are free from no search result.",
  },
] as const;

export type ReviewMedicine = Pick<
  Doc<"medicineDiscoveries">,
  | "brand"
  | "inn"
  | "owner"
  | "markets"
  | "claims"
  | "researchStatus"
  | "researchedAt"
  | "researchChecks"
  | "reviewSignals"
  | "researchPolicyVersion"
  | "commercialReview"
>;
export function reviewBasis(m: ReviewMedicine) {
  // Store the exact evidence basis; stale reviews cannot approve refreshed evidence.
  return JSON.stringify([
    m.brand,
    m.inn,
    m.owner,
    m.markets,
    m.claims,
    m.researchedAt,
    m.researchChecks,
    m.reviewSignals,
    m.researchPolicyVersion,
  ]);
}
export function commercialSignals(m: ReviewMedicine, country: string) {
  return [...m.claims, ...(m.reviewSignals ?? [])].filter(
    (c) =>
      ["partner", "possible_partner", "local_presence"].includes(c.kind) &&
      [country, "Regional"].includes(c.country),
  );
}
export function researchReviewBlockers(
  m: ReviewMedicine,
  country: string,
  now = Date.now(),
) {
  const reasons: string[] = [];
  if (m.researchPolicyVersion !== RESEARCH_POLICY_VERSION)
    reasons.push("Refresh research to run the required commercial checks.");
  if (m.researchStatus !== "completed")
    reasons.push("Research must finish successfully before commercial review.");
  if (!m.researchedAt || now - m.researchedAt > 14 * 86400_000)
    reasons.push("Research is missing or older than 14 days.");
  const missing = RESEARCH_CHECKS.filter(
    (c) =>
      !m.researchChecks?.some(
        (r) => r.key === c.key && r.status === "completed",
      ),
  );
  if (missing.length)
    reasons.push(
      `Checks still unresolved: ${missing.map((c) => c.label).join(", ")}.`,
    );
  if (!m.markets.some((x) => x.country === country))
    reasons.push("Country comparison is missing.");
  if (
    !m.claims.some(
      (c) =>
        c.kind === "demand" &&
        c.country === country &&
        c.verification === "page_excerpt_verified",
    )
  )
    reasons.push("Country-specific clinical need evidence is missing.");
  if (
    !m.claims.some(
      (c) => c.kind === "contact" && c.verification === "page_excerpt_verified",
    )
  )
    reasons.push("A source-backed company contact route is missing.");
  return reasons;
}
export function shortlistBlockers(
  m: ReviewMedicine,
  country: string,
  now = Date.now(),
) {
  const reasons = researchReviewBlockers(m, country, now);
  if (
    !m.commercialReview ||
    m.commercialReview.country !== country ||
    m.commercialReview.basis !== reviewBasis(m)
  )
    reasons.push(
      "Record a commercial review for this country and the current evidence before shortlisting.",
    );
  return reasons;
}
export function validEvidenceUrl(url: string) {
  return !!normalizedSourceUrl(url) && url.length <= 2000;
}

// Owner-level agreements must survive even when they cannot prove product rights.
export function ownerAgreementSignals(
  m: { owner: string },
  pages: Map<string, string>,
) {
  const owner = discoveryTerm(m.owner)
    .split(" ")
    .filter(
      (w) =>
        ![
          "pharmaceuticals",
          "pharma",
          "limited",
          "ltd",
          "inc",
          "gmbh",
          "eu",
          "ag",
        ].includes(w),
    )[0];
  if (!owner || owner.length < 4) return [];
  return [...pages]
    .flatMap(([url, page]) => {
      const plain = page
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ");
      const sentence = plain
        .split(/(?<=[.!?])\s+/)
        .find(
          (s) =>
            new RegExp(`\\b${owner}\\b`, "i").test(s) &&
            /distribution agreement|licensing agreement|distributor|exclusive partner/i.test(
              s,
            ) &&
            /\bMENA\b|Middle East|North Africa|\bGCC\b|\bGulf\b|Saudi|United Arab Emirates|\bUAE\b|Egypt/i.test(
              s,
            ),
        );
      if (!sentence) return [];
      const scopes: Array<"Regional" | "UAE" | "Saudi Arabia" | "Egypt"> =
        /\bMENA\b|Middle East|North Africa|\bGCC\b|\bGulf\b/i.test(sentence)
          ? ["Regional"]
          : [];
      if (!scopes.length) {
        if (/United Arab Emirates|\bUAE\b/i.test(sentence)) scopes.push("UAE");
        if (/Saudi/i.test(sentence)) scopes.push("Saudi Arabia");
        if (/Egypt/i.test(sentence)) scopes.push("Egypt");
      }
      return scopes.map((country) => ({
        country,
        kind: "possible_partner" as const,
        claim:
          "An owner-level commercial agreement may affect this medicine. Exact product, territory and rights scope require review.",
        excerpt: sentence.split(/\s+/).slice(0, 25).join(" "),
        url,
        title: "Possible relevant commercial agreement",
        observedAt: Date.now(),
        verification: "page_excerpt_verified" as const,
      }));
    })
    .slice(0, 12);
}
