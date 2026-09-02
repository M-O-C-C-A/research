# KEMEDICA evidence-to-outreach funnel

## Operating rule

`decisionOpportunities` is the commercial pursuit. `opportunityMarketAssessments` is the country decision for UAE, Saudi Arabia, or Egypt. Historical `candidateOpportunities` and `actionableLeads` remain evidence inputs and should not be used to declare a lead contact-ready.

A public search returning no match must be recorded as `not_found_unverified`. Only an analyst review against the required official or authorized evidence can set `verified_absent`. The approved wording for a clean rights review is “No conflicting presence found as of YYYY-MM-DD”; it is not proof that no agreement exists.

## One-time environment setup

This checkout currently has no `CONVEX_DEPLOYMENT`, so code generation, deployment, authentication keys, and data migration cannot be completed locally until the deployment is connected.

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
3. Promotion enforces the 70/100 weighted threshold, authorized absence, rights clearance, reviewed feasibility, evidence-backed or conservative sizing, a current named contact, and no critical review item.
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

- Do not exceed 15 newly contact-ready opportunities in a calendar month.
- Assign no more than 3–4 new opportunities per week during the pilot.
- Audit at least 30 shadow candidates before retiring the historical views, with deliberate coverage of aliases, subsidiaries, acquisitions, false absences, product collisions, and partner conflicts.
- Review source health, rejection reasons, discovery-to-ready time, contact verification, responses, meetings, diligence, mandates, false gaps, ageing, and pipeline value weekly.
