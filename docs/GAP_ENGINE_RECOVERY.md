# KEMEDICA: from collected records to pursuable gaps

Audit date: 10 September 2026. Status: initial audit below is retained as a baseline. A new medicine discovery path has now been implemented and locally verified; production release and research results are recorded separately.

## The product decision

KEMEDICA should deliver a ranked product–company–country thesis: why a need may be underserved, which supplier might address it, the supporting and conflicting evidence, and the next action that would establish whether to pursue it. A completed forecast is a later investment decision, not the first useful output of research.

Separate three outcomes:

1. **Gap to investigate:** a dated positive signal or a credible comparison hypothesis, with explicit uncertainty and a next research action. This can exist before a supplier is identified.
2. **Shortlisted pursuit:** a reference-approved product and identified owner connected to a specific country need, with a plausible entry route and initial commercial rationale. Conflicting evidence remains visible.
3. **Approved opportunity:** reviewed registration identity, rights, feasibility, commercial assumptions and appropriate contact evidence. Existing G1–G7 and human approvals remain here.

## What is actually happening

Verified through the live browser and read-only queries against the production backend, `proficient-elephant-823.eu-west-1.convex.cloud`:

| Evidence | Implication |
|---|---|
| Canonical statistics report 33 needs-evidence records, zero contact-ready and 99 critical country assessments. The visible queue returns 16 cards for 10 distinct product names. | The headline statistics include quarantined records; repeated presentations overwhelm the working view. These are not 33 independent commercial ideas. |
| The only accepted reference import in the returned import inventory is a 53-row FDA starter workbook. | The candidate universe is extremely narrow. |
| The EMA import contains 2,732 rows, 2,122 unresolved rows, 362 ambiguous rows and zero applied rows. | A larger potential catalogue is stranded at import review. The recorded parseErrorCount is also 2,122; this does not establish that every row is malformed. Inspect source fields and entity matching separately. |
| Nine of the 10 visible products have no product-research run; Xenical has one completed run with zero findings. | The canonical queue is not receiving systematic research. |
| Latest weekly scan: 544 signalsFound, zero leadsPublished, partial status. Three tender/procurement sources returned no parseable signals. | Collection counts do not measure useful opportunities, unique new signals or completed research. |
| The signal-inbox query returned 20 rows: 16 blocked on product identity and 18 on ownership. | The current workflow hands unresolved extraction and matching work to the operator. |
| Stored UAE assessments still refer to 4 September, while current comparison uses the newly accepted 10 September import. | Importing a snapshot does not refresh every existing assessment. Upload/check date also must not stand in for the source's content date. |
| Current exact-key comparisons return no match for all 10 sampled products. | This is not proof of a market gap. Matching needs validation against known positives; the current code compares a single INN/form/strength string without a separate exact-owner decision. |

The first command-line attempt selected the local anonymous backend despite `--prod`. Its one-record result was discarded. All production figures above were re-read from the explicit production URL and cross-checked against the browser.

### Confirmed implementation defects

- **Daily dispatch postpones its own work.** `runDueSourceDispatcher` calls `seedSourceRegistry` before querying due sources. Seeding overwrites every default source's `nextFetchAt` with a future date and resets health to active. The local fix makes bootstrap insert-only and makes newly created automated sources immediately due. Explicit configuration updates belong in the existing update operation. Previously failed sources need an explicit reviewed recovery; this fix does not erase their failures.
- **SFDA pagination and detail extraction are absent.** The scanner fetches one URL for each shortage list; the parser reads its table and discards detail links. The official anticipated-shortage page currently exposes 31 pages. The stored anticipated records match its first page. Source: https://www.sfda.gov.sa/en/anticipatedShortage
- **Fetching is not ingesting.** The general dispatcher stores raw pages and checks a structural signature, then rebuilds existing opportunities. It does not turn each reference-source response into normalized product records and targeted research work.
- **Approval paths are disconnected.** Product research writes `researchFindings`; approval updates drug/entity/contact or approved-research records, with some legacy signal requalification. It does not directly update the canonical country assessment and score. The canonical dashboard therefore cannot be assumed to reflect approved research.
- **Read limits can hide work.** Canonical listing reads a bounded pool before filtering. Source import search scans rows until a text match; a production search against the large UAE file returned a server error. The exact server cause was not available, so a read-limit diagnosis remains unconfirmed.

The legacy engine's latest run reports 200 candidates and 85 passed gates. Those are different gates and records from canonical contact readiness. They must not be advertised as 85 usable pursuits.

## The engine to build

### 1. Generate hypotheses from three starting points

**Reference-product comparison:** import active human medicines from official structured data, resolve the owner and presentation, then compare each candidate with country evidence. Enrich missing presentations from product-specific regulatory documents. EMA's download includes approvals and other statuses, so a downloaded row is not automatically an active approved product: https://www.ema.europa.eu/en/medicines/download-medicine-data

**Country demand:** ingest complete shortage lists and tender detail records. A signal opens a research hypothesis, then searches for reference-approved suppliers. It does not become an approved lead merely because demand exists. Track current shortage, anticipated shortage and tender separately. Preserve dates, deadlines, source record IDs and scope.

**Partner portfolio:** use the imported company directory to identify owners with relevant approved assets and evidence of partnering interest. Enrich each company once, reuse the evidence across products, and assess rights by product and territory. A company with an existing distributor can still yield another asset or country opportunity.

Egypt sales provide a fourth evidence input to these lanes: molecule demand and competitor context. Preserve MAT, YTD and monthly periods independently and keep unconfirmed currency/units out of financial comparisons. Sales do not establish registration or freely available rights.

### 2. Compare with enough precision to reject false gaps

Maintain raw values alongside normalized INN, salt/base basis, form, route, release mechanism, strength, concentration, pack, brand and owner. Link records with source IDs and dated ownership aliases.

Return separate outcomes: exact candidate listed; equivalent competitors listed; related presentation needing review; no match within a documented complete scope; or insufficient source coverage. A possible collision creates a targeted check rather than a gap claim. Count competitors separately from exact-owner registration.

Group related strengths under one product/owner card, while keeping country/presentation evidence independent. Do not delete presentation records or merge commercial history merely to simplify display.

### 3. Run targeted research automatically

Every unresolved question becomes a bounded job: reference approval; exact local presentation; competitors; owner; territory partner; demand; public BD route; initial price/access evidence. Research one question and country at a time, instead of asking one broad prompt to establish all facts.

Use the existing Convex backend and scheduler. Persist job input, dependency fingerprint, status, attempts, provider usage, sources, extracted claims, conflicts and next action. Cache company evidence and unchanged source payloads. Use bounded concurrency, retry transient failures, stop after a configured budget, and expose partial results immediately.

A successful response with zero admissible findings is **no evidence found**, with its rejection reasons; it is not a completed opportunity. Failed, blocked and not-attempted jobs must remain distinguishable. Unavailable registry access leaves that country unresolved without preventing work on another country.

### 4. Publish the research result before final diligence

Each hypothesis card must answer:

- Product or molecule, proposed supplier if identified, and target country.
- Gap type: potential presentation/access gap, supply need, procurement need, or partnering opportunity.
- Why investigate now, supported by dated sources.
- What the local market already has and any adverse evidence.
- What KEMEDICA might do: representation, licensing coordination, registration support or supply/procurement assessment. Routes remain provisional until checked.
- What is unknown and the single next action most likely to change the decision.

Use **research priority** independently of commercial approval score. Initially rank transparently by positive signal strength/freshness, product eligibility, supplier fit, and the number/importance of unresolved blockers. Unknowns receive no positive evidence points. Avoid an opaque probability or invented revenue. Calibrate numerical weights against reviewed examples before treating them as predictive.

The operator choices are Investigate, Shortlist, Park and Reject with reason. A full forecast and named-person contact should not be required to see a useful research hypothesis. Final commercial approval remains explicit.

### 5. Close the learning and refresh loops

Source changes re-evaluate only affected hypotheses and assessments. Approved facts retain provenance; changed dependencies mark the conclusion as needing renewed review. Never silently carry an old absence conclusion into a new snapshot.

Show a run's full conversion counts: retrieved pages, parsed rows, unique records, eligible products, hypotheses created, hypotheses researched, shortlisted pursuits and approved opportunities. Report the top rejection/blocker reasons and cost per researched hypothesis. No fixed quota should manufacture opportunities.

## A concrete example from today's evidence

**ALPROSTADIL · Saudi Arabia · supply hypothesis**

- Observed: the official SFDA anticipated-shortage list names alprostadil; this is also stored in the app.
- Current app result: blocked because a unique product and verified owner are missing.
- Useful engine result: “Investigate the affected presentation and potential approved suppliers.” Fetch the detail record, identify brand/strength/owner, check whether the signal remains current, and search for plausible alternative suppliers and a feasible route.
- Still unknown: exact affected presentation, alternative supplier, available capacity, rights, route, timing and economics. The detail-page fetch timed out during this audit. This is a research task, not a recommendation to transact or a verified commercial opportunity.

This is the missing intermediate output: useful work can be surfaced without pretending that commercial qualification is complete.

## Implementation order and acceptance evidence

1. **Restore trustworthy collection.** Release the tested bootstrap fix; record dispatch attempts and due/fetched/parsed counts; implement SFDA pagination and detail traversal with coverage checks and bounded rate limits. Keep structural failures blocked for review. Acceptance: repeated bootstrap preserves due dates and failure state; a complete multi-page fixture produces all expected distinct records.
2. **Repair the reference catalogue and identity matching.** Diagnose the EMA unresolved rows, import approved products independently from owner-resolution completeness, enrich missing presentations, and validate comparison against a reviewed sample containing known positives, true negatives, aliases and different formulations. Acceptance: every sampled outcome has row-level provenance and errors are measured. Do not bulk-approve the existing import.
3. **Deliver one complete research-to-hypothesis path.** Start with UAE presentation comparison and Saudi shortage hypotheses; automatically research a small bounded batch, publish source-backed cards, and route unresolved facts to a specific next task. Acceptance: each attempted hypothesis ends in a useful card, a supported rejection, or a named source blocker—never a silent zero.
4. **Connect canonical evidence and refresh.** Link approved findings to country assessments and recalculate affected scores. Group presentations in the UI; make counts exclude quarantine consistently. Acceptance: approving one real finding visibly changes the relevant assessment; a new source snapshot invalidates the dependent conclusion without modifying outreach history.
5. **Add Egypt demand and selective commercial work.** Use the sales evidence for initial demand ranking, then build forecasts only for shortlisted pursuits. Acceptance: period and currency safeguards hold; one reviewed end-to-end pursuit produces a cited brief with the evidence boundary intact.

Run the first batch as a measured product experiment. Success is the number of independently reviewed, distinct, defensible hypotheses and decisions produced—not a green deployment or a target number of leads. If no candidate survives, the engine must show the evidence-based reasons and which coverage limitation prevented a decision.

## Audit artifacts and current change

Read-only production evidence is saved under `outputs/engine-audit-2026-09-10/`: live-evidence.json, comparison-evidence.json, matcher-evidence.json and signal-inbox.json. No production findings were approved or opportunity records changed during this audit.

Local code change: `convex/continuousOpportunityEngine.ts`. Regression coverage: `convex/sourceDispatcher.vitest.ts`. Both regression tests failed before the fix; all 38 policy/integration tests and TypeScript checking passed after it. The local Convex push succeeded, and a local smoke invocation confirmed all existing source records remained unchanged after bootstrap (21 defaults ensured). Production collection, extraction, matching, research and opportunity yield still require the subsequent work above; this patch alone is not a working gap engine.

## Implemented new-medicine discovery path

- Complete official EMA JSON feed and FDA annual novel-drug lists for the current and previous three calendar years; original authorisation dates, not variation dates. EU non-authorised medicines, generics and biosimilars are excluded. FDA annual entries establish historical approval, not current supply.
- Idempotent candidate ingestion with EU/US source references, owners where reported, preserved shortlist/park state and explicit country evidence.
- Paginated reading of the accepted UAE registry snapshot, row-count validation, related-molecule/brand matching, and a 45-day fetch freshness guard. Source content date remains unconfirmed. Saudi Arabia and Egypt remain unchecked until positive country evidence is found.
- Weekly approval collection and six daily research candidates. Research searches existing launches/territory partners first, followed by local need and public company routes. Provider-cited findings are labelled pending analyst review; no-match never establishes absence or free rights. Errors and empty research are distinct.
- New primary discovery screen with search, country views, sources, local matched records, targeted research, shortlist and park. Commercial assessments remain accessible below.
- Local first collection: 345 distinct product keys from 202 eligible EMA entries and 189 FDA entries. Keys preserve distinct brand/ingredient identities; this is not a count of unique molecules or verified opportunities.
- Validation: 46 policy/integration tests, 43 legacy tests, TypeScript and new-file ESLint pass. Browser verified Voranigo's two UAE records. Local research correctly reports missing local API configuration; production research must be independently verified.

Remaining wider audit work includes SFDA shortage pagination, canonical approval linkage, richer presentation identity and commercial scoring. This release prioritizes the user's new EU/US medicine discovery objective.
