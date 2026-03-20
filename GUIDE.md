# M-O-C-C-A — User Guide

## What This Platform Does

M-O-C-C-A is your pharma market intelligence hub. It lets you:
1. Build a registry of European pharma companies and their drug portfolios
2. Score MENA market opportunities for each drug, country by country
3. Generate AI-powered market intelligence reports backed by live searches of regulatory databases, WHO data, and market research
4. Track all sources so you can click through and read the underlying evidence

The goal is to identify drugs that are approved and commercially active in Europe but have **no or limited presence in MENA** — then help you build the case to approach the manufacturer and position yourself as the route-to-market.

---

## Setup Checklist

Before using the platform, ensure these are configured:

| Item | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel env vars | Your production Convex URL |
| `CONVEX_DEPLOY_KEY` | Vercel env vars | From Convex dashboard → Settings → URL & Deploy Key |
| `OPENAI_API_KEY` | Convex dashboard env vars | Your OpenAI API key (needs GPT-4o access) |

> **Important:** `OPENAI_API_KEY` must be set in the **Convex dashboard** (not Vercel). The AI reports run server-side inside Convex Actions.

---

## Workflow

### Step 1 — Add Companies

Go to **Companies** → **Add Company**

Register the European pharma manufacturer:
- Company name and country of origin
- Website (useful for reference later)
- Brief description
- Therapeutic areas they operate in (select all that apply)

You don't need to add a company first if you've found an interesting drug — you can add a drug standalone and link it to a company later.

---

### Step 2 — Add Drugs

There are two ways:

**From a company page** (recommended when you know the manufacturer):
- Go to Companies → click into the company → Add Drug

**Standalone** (when you've spotted a drug and want to research it quickly):
- Go to **Drugs** → **Add Drug**
- Either select a company from the registry, or type the manufacturer name manually

Fill in:
- **Brand name** — the commercial name (e.g. Keytruda)
- **Generic/INN name** — the international nonproprietary name (e.g. pembrolizumab) — this is critical for regulatory database searches
- **Therapeutic area** — used for filtering and context in reports
- **Indication** — be specific: what exact condition/disease it treats and in what line of therapy
- **Mechanism** — e.g. "PD-1 inhibitor" — helps the AI contextualise competitive alternatives
- **Approval status** — EMA Approved / Pending / Withdrawn
- **Category** — Small molecule, biologic, biosimilar, etc.

> **Tip on indication:** The more specific you are here, the better the AI report. Instead of "cancer", write "metastatic non-small cell lung cancer, 2nd line, after platinum-based chemotherapy".

---

### Step 3 — Score MENA Opportunities

Open a drug → **MENA Opportunities tab**

You'll see a grid of all 15 MENA countries. For each one, click the **+** or **✏** button to fill in:

- **Opportunity Score (1–10)** — your overall assessment of the market opportunity
  - 7–10 = High (shown in green): significant unmet need, low competition, accessible market
  - 4–6 = Medium (amber): opportunity exists but with hurdles
  - 1–3 = Low (red): competition is entrenched, regulatory barriers, or small market size
- **Regulatory Status** — Is the drug already registered in this country?
- **Competitor Presence** — None / Low / Medium / High
- **Market Size Estimate** — rough estimate, e.g. "$30M annually"
- **Notes** — key contacts, distributor names, tender cycles, anything useful

This grid feeds directly into the AI report as context, so filling it in before generating a report gives you a much richer output.

---

### Step 4 — Generate the AI Market Report

Open a drug → **AI Market Report tab** → **Generate Report**

The AI will:
1. Search live data from EMA, SFDA (Saudi Arabia), UAE MOH, QCBS (Qatar), JFDA (Jordan), WHO, and other credible sources
2. Cross-reference clinical trial data and published market research
3. Generate a structured report covering:
   - Executive summary and market gap assessment
   - Country-by-country opportunity analysis for all 15 MENA countries
   - Registration status of this drug (or its INN) in each country
   - Competitive landscape — what's already sold there
   - Regulatory pathway for each key market (SFDA, MOH UAE, etc.)
   - Business development strategy — which markets to prioritise, partnership model, deal structure
   - Risk assessment table

**Generation takes 30–60 seconds.** The status updates in real time — you'll see "Generating..." and the page will automatically show the report when it's ready. You don't need to refresh.

**Sources** appear below the report as clickable links. These are the actual URLs the AI pulled data from — click any source to open the underlying page and verify the information.

> **Regenerating:** Hit "Regenerate" any time to refresh the report with updated data — for example after filling in more opportunity scores, after a regulatory update, or when the market landscape changes.

---

## Reading the Report

The report is structured to drive action, not just inform. Here's how to use each section:

| Section | How to use it |
|---|---|
| **Executive Summary** | Quick-read to decide if this drug is worth pursuing |
| **Drug Profile** | Talking points for your first call with the manufacturer |
| **MENA Regional Overview** | Understand disease burden — use this to size the prize |
| **Country-by-Country Analysis** | Pick your top 3 priority markets from this section |
| **Competitive Landscape** | Know what you're up against before you pitch a distributor |
| **Regulatory Pathway** | Use the registration timelines to set expectations with the manufacturer |
| **Business Development Strategy** | This is your playbook — follow the priority ranking and partnership model suggestions |
| **Risk Assessment** | Cover these risks in your pitch deck to show you've done your homework |

---

## Ongoing Process

M-O-C-C-A is designed for continuous use, not a one-time export. As you work:

- **Update opportunity scores** as you learn more about each market from conversations with distributors and local contacts
- **Add notes** in the country grid — phone numbers, meeting outcomes, tender deadlines
- **Regenerate reports** quarterly or when a significant market event happens (e.g. a competitor loses registration, a new MOH tender opens)
- **Add new drugs** as you discover them — from EMA approval announcements, pharma conferences, or tips from contacts

---

## Tips for Better Reports

- **Always fill in the INN (generic name)** accurately — the AI uses this to search regulatory databases for registration status. A wrong INN means the search returns nothing.
- **Specify the indication precisely** — "Type 2 diabetes" gives worse results than "Type 2 diabetes, GLP-1 receptor agonist, adults with inadequate control on metformin".
- **Pre-fill the MENA opportunity grid** before generating — the AI incorporates your existing scores and notes, which anchors the report to your real intelligence.
- **Use the Sources** — if the AI says a drug is "not registered in Saudi Arabia", click the SFDA source link to verify directly.
- **Regenerate after market events** — regulatory approvals, tender awards, and competitor launches all change the picture. A quarterly refresh keeps your intelligence current.

---

## Deploying Updates

The platform auto-deploys on every push to the `main` branch via Vercel. The build script (`npx convex deploy --cmd 'next build'`) also pushes any Convex function or schema changes to production automatically.

If you're running locally:
```bash
npx convex dev   # starts Convex dev server + hot reloads
npm run dev      # starts Next.js dev server
```
