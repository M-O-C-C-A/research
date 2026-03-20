"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";

const MENA_COUNTRIES = [
  "Saudi Arabia",
  "UAE",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Jordan",
  "Lebanon",
  "Egypt",
  "Iraq",
  "Syria",
  "Libya",
  "Tunisia",
  "Morocco",
  "Algeria",
];

export const generateReport = action({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) => {
    await ctx.runMutation(api.reports.upsert, {
      drugId,
      status: "generating",
    });

    try {
      const drug = await ctx.runQuery(api.drugs.get, { id: drugId });
      if (!drug) throw new Error("Drug not found");

      const company = await ctx.runQuery(api.companies.get, {
        id: drug.companyId,
      });
      const opportunities = await ctx.runQuery(api.opportunities.listByDrug, {
        drugId,
      });

      const opportunitySummary = MENA_COUNTRIES.map((country) => {
        const opp = opportunities.find((o) => o.country === country);
        if (!opp) return `- ${country}: No existing data`;
        const score = opp.opportunityScore
          ? `Score ${opp.opportunityScore}/10`
          : "Unscored";
        const reg = opp.regulatoryStatus ? ` | Regulatory: ${opp.regulatoryStatus}` : "";
        const comp = opp.competitorPresence
          ? ` | Competitors: ${opp.competitorPresence}`
          : "";
        const notes = opp.notes ? ` | Notes: ${opp.notes}` : "";
        return `- ${country}: ${score}${reg}${comp}${notes}`;
      }).join("\n");

      const prompt = `You are a senior pharmaceutical market intelligence analyst with deep expertise in MENA healthcare markets and European pharma industry.

Generate a comprehensive, professional market intelligence report for the drug described below. This report is for a business development team at a company that acts as an import/export intermediary between European pharmaceutical manufacturers and MENA distributors.

## Drug Profile
- Brand Name: ${drug.name}
- Generic Name / INN: ${drug.genericName}
- Manufacturer: ${company?.name ?? "Unknown"} (${company?.country ?? "Unknown"})
- Therapeutic Area: ${drug.therapeuticArea}
- Indication: ${drug.indication}
- Mechanism of Action: ${drug.mechanism ?? "Not specified"}
- EU Approval Status: ${drug.approvalStatus}${drug.approvalDate ? ` (${drug.approvalDate})` : ""}
- Category: ${drug.category ?? "Not specified"}

## Existing MENA Opportunity Data
${opportunitySummary}

---

Please write a detailed, data-driven markdown report with the following sections:

# Market Intelligence Report: ${drug.name} (${drug.genericName})

## 1. Executive Summary
A concise 3-5 sentence summary of the drug and the overall MENA opportunity.

## 2. Drug Profile
- Clinical profile and mechanism
- Key clinical trial data and efficacy highlights
- Safety profile overview
- Competitive differentiation vs alternatives

## 3. MENA Regional Overview
- Regional disease burden and patient population estimates for this indication
- Healthcare infrastructure maturity relevant to this drug
- Payer landscape (public vs private, insurance penetration)
- Regional regulatory harmonization trends

## 4. Country-by-Country Opportunity Analysis
For each of the 15 MENA countries below, provide:
- Market entry opportunity level (High / Medium / Low)
- Estimated addressable patient population
- Key regulatory body and registration pathway
- Known competitor presence
- Key obstacles and entry strategy notes
- Priority ranking for outreach

Countries: Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman, Jordan, Lebanon, Egypt, Iraq, Syria, Libya, Tunisia, Morocco, Algeria

## 5. Competitive Landscape
- Currently registered competing products in MENA
- Biosimilar / generic threat assessment
- Pricing benchmarks and tender dynamics

## 6. Regulatory Pathway
- Key regulatory bodies: SFDA (Saudi Arabia), MOH UAE, QCBS (Qatar), etc.
- Typical registration timeline and dossier requirements
- EU approval leverage (EMA approval as reference)
- Country-specific nuances

## 7. Business Development Strategy
- Top 3 priority markets to approach first (with rationale)
- Recommended partnership model (exclusive distributor, co-promotion, etc.)
- Key stakeholders and decision-makers to engage
- Suggested pricing strategy
- Typical deal structure for this type of product in MENA

## 8. Risk Assessment
- Regulatory risks
- Market access risks
- Currency and payment risks
- Competition risks

Use professional, concise language. Include specific data points and estimates where possible based on your knowledge. Format with clear headers, bullet points, and tables where appropriate.`;

      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices[0]?.message?.content ?? "";

      await ctx.runMutation(api.reports.upsert, {
        drugId,
        content,
        status: "ready",
      });
    } catch (error) {
      await ctx.runMutation(api.reports.upsert, {
        drugId,
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  },
});
