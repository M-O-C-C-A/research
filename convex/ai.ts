"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import {
  createResearchClient,
  createStructuredWebSearchResponse,
  createTextResponse,
} from "./openaiResearch";

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
] as const;

interface Citation {
  title: string;
  url: string;
}

interface CountryFinding {
  country: string;
  registrationStatus: string;
  marketOpportunity: "High" | "Medium" | "Low";
  rationale: string;
  patientPopulationEstimate: string;
  keyRegulatoryBody: string;
  registrationTimeline: string;
  competitorPresence: string;
  marketEntryPriority: "Priority 1" | "Priority 2" | "Priority 3";
  sourceUrls: string[];
}

interface ReportBrief {
  executiveSummary: string;
  drugProfile: {
    clinicalProfile: string;
    keyClinicalData: string;
    safetyAndTolerability: string;
    competitiveDifferentiation: string;
    commercialStatus: string;
  };
  regionalOverview: {
    diseaseBurden: string;
    healthcareInfrastructure: string;
    payerLandscape: string;
    regulatoryTrends: string;
  };
  countryFindings: CountryFinding[];
  competitiveLandscape: {
    registeredComparators: string;
    genericsAndBiosimilars: string;
    pricingAndTenderDynamics: string;
    marketGapAnalysis: string;
  };
  regulatoryPathway: {
    saudiArabia: string;
    uae: string;
    gccCentralizedProcedure: string;
    otherKeyMarkets: string;
    emaAcceleration: string;
    requiredDossier: string;
  };
  businessDevelopmentStrategy: {
    topMarkets: string[];
    commercialModel: string;
    keyStakeholders: string;
    pricePositioning: string;
    timeToFirstSale: string;
    outreachPackage: string;
  };
  risks: Array<{
    risk: string;
    likelihood: string;
    impact: string;
    mitigation: string;
  }>;
  citations: Citation[];
}

const REPORT_BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    drugProfile: {
      type: "object",
      additionalProperties: false,
      properties: {
        clinicalProfile: { type: "string" },
        keyClinicalData: { type: "string" },
        safetyAndTolerability: { type: "string" },
        competitiveDifferentiation: { type: "string" },
        commercialStatus: { type: "string" },
      },
      required: [
        "clinicalProfile",
        "keyClinicalData",
        "safetyAndTolerability",
        "competitiveDifferentiation",
        "commercialStatus",
      ],
    },
    regionalOverview: {
      type: "object",
      additionalProperties: false,
      properties: {
        diseaseBurden: { type: "string" },
        healthcareInfrastructure: { type: "string" },
        payerLandscape: { type: "string" },
        regulatoryTrends: { type: "string" },
      },
      required: [
        "diseaseBurden",
        "healthcareInfrastructure",
        "payerLandscape",
        "regulatoryTrends",
      ],
    },
    countryFindings: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          country: { type: "string" },
          registrationStatus: { type: "string" },
          marketOpportunity: {
            type: "string",
            enum: ["High", "Medium", "Low"],
          },
          rationale: { type: "string" },
          patientPopulationEstimate: { type: "string" },
          keyRegulatoryBody: { type: "string" },
          registrationTimeline: { type: "string" },
          competitorPresence: { type: "string" },
          marketEntryPriority: {
            type: "string",
            enum: ["Priority 1", "Priority 2", "Priority 3"],
          },
          sourceUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
        },
        required: [
          "country",
          "registrationStatus",
          "marketOpportunity",
          "rationale",
          "patientPopulationEstimate",
          "keyRegulatoryBody",
          "registrationTimeline",
          "competitorPresence",
          "marketEntryPriority",
          "sourceUrls",
        ],
      },
    },
    competitiveLandscape: {
      type: "object",
      additionalProperties: false,
      properties: {
        registeredComparators: { type: "string" },
        genericsAndBiosimilars: { type: "string" },
        pricingAndTenderDynamics: { type: "string" },
        marketGapAnalysis: { type: "string" },
      },
      required: [
        "registeredComparators",
        "genericsAndBiosimilars",
        "pricingAndTenderDynamics",
        "marketGapAnalysis",
      ],
    },
    regulatoryPathway: {
      type: "object",
      additionalProperties: false,
      properties: {
        saudiArabia: { type: "string" },
        uae: { type: "string" },
        gccCentralizedProcedure: { type: "string" },
        otherKeyMarkets: { type: "string" },
        emaAcceleration: { type: "string" },
        requiredDossier: { type: "string" },
      },
      required: [
        "saudiArabia",
        "uae",
        "gccCentralizedProcedure",
        "otherKeyMarkets",
        "emaAcceleration",
        "requiredDossier",
      ],
    },
    businessDevelopmentStrategy: {
      type: "object",
      additionalProperties: false,
      properties: {
        topMarkets: {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
        },
        commercialModel: { type: "string" },
        keyStakeholders: { type: "string" },
        pricePositioning: { type: "string" },
        timeToFirstSale: { type: "string" },
        outreachPackage: { type: "string" },
      },
      required: [
        "topMarkets",
        "commercialModel",
        "keyStakeholders",
        "pricePositioning",
        "timeToFirstSale",
        "outreachPackage",
      ],
    },
    risks: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          risk: { type: "string" },
          likelihood: { type: "string" },
          impact: { type: "string" },
          mitigation: { type: "string" },
        },
        required: ["risk", "likelihood", "impact", "mitigation"],
      },
    },
    citations: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "url"],
      },
    },
  },
  required: [
    "executiveSummary",
    "drugProfile",
    "regionalOverview",
    "countryFindings",
    "competitiveLandscape",
    "regulatoryPathway",
    "businessDevelopmentStrategy",
    "risks",
    "citations",
  ],
} as const;

function buildOpportunitySummary(
  opportunities: Array<{
    country: string;
    opportunityScore?: number;
    regulatoryStatus?: string;
    competitorPresence?: string;
    notes?: string;
  }>
): string {
  return MENA_COUNTRIES.map((country) => {
    const opp = opportunities.find((entry) => entry.country === country);
    if (!opp) return `- ${country}: No existing data`;
    const score = opp.opportunityScore
      ? `Score ${opp.opportunityScore}/10`
      : "Unscored";
    const reg = opp.regulatoryStatus
      ? ` | Regulatory: ${opp.regulatoryStatus}`
      : "";
    const comp = opp.competitorPresence
      ? ` | Competitors: ${opp.competitorPresence}`
      : "";
    const notes = opp.notes ? ` | Notes: ${opp.notes}` : "";
    return `- ${country}: ${score}${reg}${comp}${notes}`;
  }).join("\n");
}

function dedupeSources(brief: ReportBrief): Citation[] {
  const byUrl = new Map<string, Citation>();

  for (const citation of brief.citations ?? []) {
    if (!citation.url || byUrl.has(citation.url)) continue;
    byUrl.set(citation.url, {
      title: citation.title || citation.url,
      url: citation.url,
    });
  }

  for (const finding of brief.countryFindings ?? []) {
    for (const url of finding.sourceUrls ?? []) {
      if (!url || byUrl.has(url)) continue;
      byUrl.set(url, { title: url, url });
    }
  }

  return [...byUrl.values()].slice(0, 30);
}

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

      const company = drug.companyId
        ? await ctx.runQuery(api.companies.get, { id: drug.companyId })
        : null;

      const manufacturerDisplay = company
        ? `${company.name} (${company.country})`
        : drug.manufacturerName ?? "Unknown manufacturer";

      const opportunities = await ctx.runQuery(api.opportunities.listByDrug, {
        drugId,
      });

      const opportunitySummary = buildOpportunitySummary(opportunities);
      const client = createResearchClient(process.env.OPENAI_API_KEY!);

      const briefResponse = await createStructuredWebSearchResponse<ReportBrief>(
        client,
        {
          instructions:
            "You are a senior pharmaceutical market intelligence analyst focused on European drug commercialization into MENA markets. Use web search and return a compact but evidence-backed JSON brief. If a fact is uncertain, say so explicitly. Cover all 15 requested MENA countries exactly once in countryFindings.",
          input: `Research this drug for MENA commercialization.

Drug profile
- Brand Name: ${drug.name}
- Generic Name / INN: ${drug.genericName}
- Manufacturer: ${manufacturerDisplay}
- Therapeutic Area: ${drug.therapeuticArea}
- Indication: ${drug.indication}
- Mechanism of Action: ${drug.mechanism ?? "Not specified"}
- EU Approval Status: ${drug.approvalStatus}${drug.approvalDate ? ` (${drug.approvalDate})` : ""}
- Category: ${drug.category ?? "Not specified"}

Existing internal opportunity data
${opportunitySummary}

Research requirements
- Countries: ${MENA_COUNTRIES.join(", ")}
- Prioritize official regulator sites, WHO, PubMed, and credible market sources.
- For each country finding, include 1-4 source URLs.
- Keep each section concise but specific enough to support a written market report.`,
          formatName: "mena_report_brief",
          schema: REPORT_BRIEF_SCHEMA,
          maxOutputTokens: 4200,
          searchContextSize: "high",
          maxToolCalls: 8,
        }
      );

      const brief = briefResponse.data;
      const sources = dedupeSources(brief);

      const markdownResponse = await createTextResponse(client, {
        instructions:
          "You are a senior pharmaceutical market intelligence analyst. Convert the supplied JSON brief into a professional markdown report. Use only the supplied brief, do not perform any additional research, and clearly note uncertainty where present.",
        input: `Write a markdown report with these sections and no extra top-level sections:

# Market Intelligence Report: ${drug.name} (${drug.genericName})
## 1. Executive Summary
## 2. Drug Profile
## 3. MENA Regional Overview
## 4. Country-by-Country Opportunity Analysis
## 5. Competitive Landscape
## 6. Regulatory Pathway
## 7. Business Development Strategy
## 8. Risk Assessment

Requirements:
- In section 4, include all 15 MENA countries.
- Use concise paragraphs, bullets, and tables where useful.
- In section 8, render the risks as a markdown table.
- Do not invent sources or facts beyond the JSON brief.

JSON brief:
${JSON.stringify(brief, null, 2)}`,
        maxOutputTokens: 3200,
      });

      await ctx.runMutation(api.reports.upsert, {
        drugId,
        content: markdownResponse.data,
        status: "ready",
        sources: sources.length > 0 ? sources : undefined,
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
