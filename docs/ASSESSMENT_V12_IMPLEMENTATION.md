# Assessment v1.2 implementation and validation

Implemented in the local checkout on 2026-09-09. Production has not been deployed or migrated.

- Registration screening records exact candidate registration separately from equivalent competitors, with current MAH and local partner fields. Registered products and established regional companies remain eligible but are deprioritized. Incomplete or conflicting registry records cannot support a clean absence conclusion.
- Company fit uses the requested additive points, including negative scores, seven-market relationship coverage, and dated staff/partnering evidence. Company fit remains separate from the existing weighted opportunity score.
- The country workspace provides source-access logs, comparable Germany/GCC/tender price anchors, volume/access/adoption/reimbursement inputs, five-year downside/base/upside margin and cash forecasts, and a channel, pricing-band and sequencing recommendation.
- KEMEDICA can be selected as proposed MAH. Country feasibility still determines the route. Nominee review is conditional. Fee assumptions belong to the commercial forecast.
- Editing a forecast invalidates its approval. Migration is paginated, previewed, fingerprint checked, and idempotent; duplicate quarantines and commercial history are retained.
- Excel and PDF exports include commercial studies. The workbook also exposes standardized reference products and missing source fields.

## Local workbook import

| Input | Imported records | Use |
| --- | ---: | --- |
| Starter pack | 300 companies | Discovery roster; not product-approval evidence |
| UAE complete list | 16,973 rows | Primary uploaded registry snapshot |
| UAE registered directory | 14,445 rows | Supplementary registry snapshot |
| Egypt combined sales | 25,252 valid rows | Sales context; monthly/YTD/MAT retained separately |

The complete UAE list contains 14,408 fully normalized presentations and 87 parse issues. Raw rows and unresolved records remain available for review. The supplementary directory has 14,445 complete presentations and no parse issues. Snapshot acceptance does not approve individual identity matches. Egypt currency and sales-unit definitions remain unconfirmed until sourced; values are not silently treated as comparable USD prices.

The source log was run before importing and records access to all 17 configured endpoints. A reachable landing page is not a verified product or price. Restricted or unavailable sources require authorized data or recorded manual checks. The supplied EDA directory URL redirected to a formulary during the check.

## Verification

- 36 policy/integration tests and 43 legacy tests passed.
- TypeScript and the production build passed.
- ESLint: no errors; one pre-existing unused-variable warning in `convex/tavilyResearch.test.mts`.
- Browser checks covered responsive layout, live recalculation, save/reload persistence, and absence of an application error overlay.
- Synthetic QA: changing unit price from USD 10 to 12 changed base five-year cash from USD 39,800 to 51,560. These are test assumptions, not a real opportunity valuation.
- Excel and PDF endpoints returned readable exports containing the saved forecast.

The local preview and imports are not a completed commercial study for every production opportunity. Real forecasts require the recorded source-backed assumptions and country review. Deployment, production import, and production migration have not occurred.
