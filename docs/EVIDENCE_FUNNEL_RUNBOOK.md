# KEMEDICA evidence-to-outreach funnel

## Operating rule

`decisionOpportunities` is the commercial pursuit. `opportunityMarketAssessments` is the country decision for UAE, Saudi Arabia, or Egypt. Historical `candidateOpportunities` and `actionableLeads` remain evidence inputs and should not be used to declare a lead contact-ready.

Policy v1.2 records `registered`, `checked_not_registered`, or unresolved registration after a dated official-registry check. Exact candidate identity is separate from equivalent competitor presentations. The approved wording for a clean rights review is “No conflicting presence found as of YYYY-MM-DD”; it is not proof that no agreement exists.

## One-time environment setup

Use an explicitly selected development or production deployment. Local validation uses the local Convex backend; it does not change the hosted application.

1. Connect the intended Convex development deployment with `npx convex dev`.
2. Confirm `NEXT_PUBLIC_CONVEX_URL` is present in the web environment.
3. Run `npx convex codegen` and commit the generated component API types.
4. Deploy the backend with `npm run deploy:backend`.
5. Run the two tracked migrations:
   - `npx convex run migrations:candidateOpportunitiesToCanonical`
   - `npx convex run migrations:actionableLeadsToCanonical`
6. Run each command again and confirm it reports completion without creating duplicate canonical records or country assessments.

The link is intentionally open: there is no authentication, login, invitation, or browser identity. The app uses one shared `Open workspace` administrator record for task assignment and activity attribution. This is convenience, not an access-control boundary.

## Daily workflow

1. Scheduled source collection retains raw payloads and parser metadata. Structure failures preserve the last successful snapshot, mark the source unhealthy, and create a review item.
2. Analysts review country evidence in Screen. Demand requires one approved strong source or two approved independent medium sources.
3. Promotion enforces the 70/100 weighted threshold, reviewed registration identity, rights clearance, reviewed feasibility, evidence-backed or conservative sizing, a current named contact, and no critical review item.
4. Promotion prepares a cited brief and referral email. It does not send anything.
5. Assignment creates human tasks for days 0, 3, 7, 14, and 30.
6. BD completes tasks only after the external action occurred. Email and call tasks then create an activity and move the pursuit to `contacted`.
7. Evidence expiry demotes only uncontacted pursuits to `needs_evidence`. It never rewinds an existing commercial relationship.

## Source cadence

- Daily: EMA medicine data, Drugs@FDA, EDE directory, SFDA registrations and shortages, NUPCO tenders, and Egypt procurement.
- Weekly: EMA Article 57, EMA SME, MHRA, Abu Dhabi special authorisations, DHA prices, and company/right checks.
- Monthly: Orange Book and Purple Book.
- On refresh/manual: authorized Egypt EDA / Pharma Data Hub exports and targeted public EDA checks.

The source registry is a health and snapshot layer. A registry fetch does not by itself promote evidence; parser output must be linked to an assessment and approved by an analyst.

## Pilot controls

- Contact-ready volume is unlimited: every opportunity that passes evidence review qualifies.
- Assign no more than 3–4 new opportunities per week during the pilot.
- Audit at least 30 shadow candidates before retiring the historical views, with deliberate coverage of aliases, subsidiaries, acquisitions, false absences, product collisions, and partner conflicts.
- Review source health, rejection reasons, discovery-to-ready time, contact verification, responses, meetings, diligence, mandates, false gaps, ageing, and pipeline value weekly.

## v1.2 commercial workflow

Run the source-access log before research. Landing-page availability is not evidence of a product approval or price. EDA's supplied directory link redirects to a formulary; use the separate EDA registration search for country verification. Restricted sources use authorized exports or documented manual review.

The candidate universe uses active FDA, EMA, MHRA, BfArM or EU national approvals and normalized INN, strength and dosage form. Big international pharma, existing registrations and regional relationships are deprioritized, not excluded. Current MAH and distributor are distinct roles; KEMEDICA can be proposed as MAH if country feasibility supports it. Nominee review applies only to routes needing nominees.

Company fit is an independent additive score: NONE +40, DISTRIBUTOR_ONLY +20, UNKNOWN +5, EXCLUSIVE_AGENT -30, OWN_AFFILIATE -40; emerging-region out-licensing +35; partnering page/BD contact +20; conference exhibitor +15; staff below 250 +30, 250–5000 +15, above 5000 -20. Unsupported inputs receive no bonus. Dated evidence expires after one year; NONE requires all GCC countries and Egypt to be checked.

Rank by existing weighted opportunity score, company fit, then approved five-year base cash outcome. Registered presentations cap the white-space component at 40/100 but can qualify with a strong commercial case. The working list is not capped at 20; the demand-validated top 20 is a separate subset. Planning expectations are low hundreds after category/registration screening and 30–60 commercial pursuits; never pad counts.

For UAE, Saudi Arabia and Egypt, record a source-backed country study, comparable Germany/GCC/tender unit-price anchors and five-year downside/base/upside scenarios. Keep list, registered, reimbursement and tender price types visible. Non-USD anchors need sourced FX dated within 90 days; price observations must be within one year. Directional references do not enter the numeric corridor. Egypt monthly/YTD/MAT sales periods are independent observations and must never be added together.

Simulator money is USD, years run from the selected assessment start year, and launch delay reduces active selling months. Accessible patients are reduced by reimbursement reach and physician adoption. Public/private mix blends private price with the explicit public discount. Costs include KEMEDICA variable/annual/upfront costs and the change in working capital. Annual operating costs start in year one; working capital is not artificially released at year five. Risk-adjusted cash discounts operating outcome by success probability and retains upfront cost. Fees are forecast assumptions, not signed terms. Editing a saved forecast invalidates its commercial approval.

Migration: call `opportunityPolicyMigration:migratePage` with `dryRun:true` for each bounded page, inspect counts, then apply the same page with its `expectedFingerprint`. Large-pharma-only quarantine is removed; duplicate quarantine and outreach history remain. Old assessments require renewed identity and commercial review. Repeat execution is a no-op.
