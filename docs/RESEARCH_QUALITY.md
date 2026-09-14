# Medicine research quality and release checks

The discovery list contains unqualified research candidates. An actionable shortlist entry is country-specific and requires all eight research checks, source-backed country need and company contact evidence, research no older than 14 days, and a recorded analyst review of the exact evidence version. A research refresh invalidates the review. Previous review records remain in history.

## Evidence boundaries

- Registry comparison: a match/no-match within a named supplied snapshot. Neither result decides exact current registration.
- Representation: product-level or owner-level agreements, with explicit geographic scope. Ambiguous relationships remain warnings. Missing search results never establish absence.
- Commercial qualification: analyst reasoning, supporting evidence links, exact registration position, rights/representation assessment and explicit resolution of each warning. The shared workspace records the analyst's supplied name; it does not authenticate that person's identity.
- Completed research check: every cited source for that check was retrieved. It is not proof of exhaustive coverage. Failed, empty and partially retrieved searches remain unresolved and prevent shortlist promotion.
- An independent final disqualification search seeks additional contradictory sources. This is a separate search pass, not a second provider or a guarantee of independence from model bias.

Original source pages, provider reports, check results and extracted candidate findings are retained in the research audit. Failed commercial findings survive as unverified warnings rather than disappearing. Previously recorded relationships survive subsequent refreshes.

## Regression benchmark

`convex/medicineDiscoveryReview.vitest.ts` checks admission, evidence changes and source interpretation. This deterministic benchmark is not a measurement of live web-search recall.

| Case | Expected result | Evidence |
| --- | --- | --- |
| Rezdiffra / Madrigal / NewBridge | Owner-level MENA agreement; product and country scope unresolved; never infer registration | https://nbpharma.com/news/details/53 |
| Emcitate / Egetis / taiba | Product agreement explicitly names UAE and Saudi Arabia; do not extend to Egypt | https://view.news.eu.nasdaq.com/view?id=b24f37a503a6935d0030964c72cd722f8&lang=en&src=micro |
| Xolremdi / X4 / taiba | Product agreement explicitly includes UAE, Saudi Arabia and Egypt; registration/supply not inferred | https://investors.x4pharma.com/news-releases/news-release-details/x4-pharmaceuticals-and-taiba-rare-announce-exclusive-agreement |
| European agreement plus unrelated MENA company footprint | Do not turn European product rights into a MENA deal | Synthetic scope regression |
| UAE registry no-match plus regional partner | Relationship warning survives; no absence/free-rights claim | Synthetic admission regression |
| Country-listed medicine | Exact registration position and differentiated commercial route need analyst review | Synthetic admission regression |
| Plausible country need/contact evidence | Eligible for review only after all checks; never automatically shortlisted | Synthetic admission regression |
| Missing source, failed challenge or stale evidence | No shortlist promotion | Synthetic failure regressions |

For a live acceptance run, research the three real cases above serially, without feeding their expected source URLs to the research engine. Measure (1) whether each known relationship is found or flagged, (2) whether product/country scope is correct, (3) unsupported registration or available-rights claims, (4) failed/unresolved checks, and (5) runtime/provider errors. A manually inserted correction does not count as successful discovery.

Automatic research expansion is paused in `convex/crons.ts` and collection no longer queues new research. Manual research and the serialized existing queue remain available. Resume automatic expansion only after a documented live benchmark review, including provider failures; do not count successful software tests as proof of research recall.

## Existing-record correction

`medicineDiscoveryCorrections:correctPage` offers an admin-only, paginated preview/apply operation with an exact current fingerprint. It adds the reviewed NewBridge warning and the explicit Xolremdi country scope, and returns nonqualifying legacy shortlists to research candidates. It preserves correction history and is idempotent. Never use a local anonymous deployment as evidence of production state.
