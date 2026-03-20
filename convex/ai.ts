"use node";

import { action, ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  createResearchClient,
  createStructuredResponse,
  createStructuredWebSearchResponse,
  createTextResponse,
} from "./openaiResearch";
import {
  blobToDataUrl,
} from "./fileProcessing";
import { KEMEDICA_CONTEXT } from "../src/lib/brand";
import { MENA_COUNTRIES } from "./constants";

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
  entityMap: {
    manufacturer: string;
    marketAuthorizationHolder: string;
    relationshipSummary: string;
    knownMenaPartners: Array<{
      entity: string;
      role: string;
      geography: string;
      implication: string;
    }>;
    recommendedApproachEntity: string;
    recommendedApproachEntityRole: string;
    recommendedApproachReason: string;
  };
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
  bdFitAssessment: {
    bdFitScore: number;
    companyMotivation: string;
    kemedicaLeverage: string;
    dealStructureSuggestion: string;
    suggestedContacts: Array<{
      name: string | null;
      title: string;
      rationale: string;
    }>;
    tenderIntelligence: string;
    firstMoverWindow: string;
  };
  citations: Citation[];
}

interface ImageResearchExtraction {
  title: string;
  summary: string;
  searchTerms: string[];
  companyNames: string[];
  productNames: string[];
}

interface ProcessedResearchInputUpload {
  id: Id<"researchInputs">;
  title: string;
  sourceType: "pdf" | "image";
  content: string;
  seedTerms: string[];
  extraction?: ImageResearchExtraction;
}

const REPORT_BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    entityMap: {
      type: "object",
      additionalProperties: false,
      properties: {
        manufacturer: { type: "string" },
        marketAuthorizationHolder: { type: "string" },
        relationshipSummary: { type: "string" },
        knownMenaPartners: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              entity: { type: "string" },
              role: { type: "string" },
              geography: { type: "string" },
              implication: { type: "string" },
            },
            required: ["entity", "role", "geography", "implication"],
          },
        },
        recommendedApproachEntity: { type: "string" },
        recommendedApproachEntityRole: { type: "string" },
        recommendedApproachReason: { type: "string" },
      },
      required: [
        "manufacturer",
        "marketAuthorizationHolder",
        "relationshipSummary",
        "knownMenaPartners",
        "recommendedApproachEntity",
        "recommendedApproachEntityRole",
        "recommendedApproachReason",
      ],
    },
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
    bdFitAssessment: {
      type: "object",
      additionalProperties: false,
      properties: {
        bdFitScore: { type: "number" },
        companyMotivation: { type: "string" },
        kemedicaLeverage: { type: "string" },
        dealStructureSuggestion: { type: "string" },
        suggestedContacts: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              title: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["name", "title", "rationale"],
          },
        },
        tenderIntelligence: { type: "string" },
        firstMoverWindow: { type: "string" },
      },
      required: [
        "bdFitScore",
        "companyMotivation",
        "kemedicaLeverage",
        "dealStructureSuggestion",
        "suggestedContacts",
        "tenderIntelligence",
        "firstMoverWindow",
      ],
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
    "entityMap",
    "drugProfile",
    "regionalOverview",
    "countryFindings",
    "competitiveLandscape",
    "regulatoryPathway",
    "businessDevelopmentStrategy",
    "risks",
    "bdFitAssessment",
    "citations",
  ],
} as const;

const IMAGE_RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    searchTerms: {
      type: "array",
      items: { type: "string" },
      maxItems: 12,
    },
    companyNames: {
      type: "array",
      items: { type: "string" },
      maxItems: 12,
    },
    productNames: {
      type: "array",
      items: { type: "string" },
      maxItems: 12,
    },
  },
  required: ["title", "summary", "searchTerms", "companyNames", "productNames"],
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

function toOpportunityScore(level: CountryFinding["marketOpportunity"]): number {
  switch (level) {
    case "High":
      return 8;
    case "Medium":
      return 5;
    case "Low":
      return 2;
  }
}

function toRegulatoryStatus(status: string): string | undefined {
  const normalized = status.toLowerCase();
  if (normalized.includes("reimburs")) return "reimbursed";
  if (
    normalized.includes("pending") ||
    normalized.includes("under review") ||
    normalized.includes("submitted")
  ) {
    return "pending_registration";
  }
  if (
    normalized.includes("registered") ||
    normalized.includes("approved") ||
    normalized.includes("listed")
  ) {
    return "registered";
  }
  if (
    normalized.includes("not registered") ||
    normalized.includes("unregistered") ||
    normalized.includes("not listed")
  ) {
    return "not_registered";
  }
  return undefined;
}

function toCompetitorPresence(value: string): string | undefined {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("none") ||
    normalized.includes("no competitor") ||
    normalized.includes("no comparable")
  ) {
    return "none";
  }
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium") || normalized.includes("moderate")) {
    return "medium";
  }
  if (
    normalized.includes("low") ||
    normalized.includes("limited") ||
    normalized.includes("single competitor")
  ) {
    return "low";
  }
  return undefined;
}

function buildOpportunityNotes(finding: CountryFinding): string {
  return [
    `Opportunity: ${finding.marketOpportunity}`,
    `Priority: ${finding.marketEntryPriority}`,
    `Rationale: ${finding.rationale}`,
    `Timeline: ${finding.registrationTimeline}`,
    `Regulator: ${finding.keyRegulatoryBody}`,
  ].join("\n");
}

function buildResearchInputContext(
  inputs: Array<{
    title: string;
    sourceType: string;
    content: string;
    seedTerms?: string[];
  }>
): string {
  if (inputs.length === 0) return "No uploaded supporting documents.";

  return inputs
    .map((input, index) => {
      const seeds = (input.seedTerms ?? []).filter(Boolean).join(", ");
      return [
        `Document ${index + 1}: ${input.title} (${input.sourceType})`,
        seeds ? `Seed terms: ${seeds}` : null,
        `Extracted context: ${input.content.slice(0, 5000)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

async function extractImageResearchInput(
  imageDataUrl: string,
  title: string
): Promise<ImageResearchExtraction> {
  const client = createResearchClient(process.env.OPENAI_API_KEY!);

  const extraction = await createStructuredResponse<ImageResearchExtraction>(
    client,
    {
      instructions:
        `You extract research leads from uploaded business documents and screenshots. Focus on company names, product names, market-entry clues, regulatory clues, and search seed terms relevant to KEMEDICA's MENA pharma expansion model. ${KEMEDICA_CONTEXT}`,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract the key research leads from this image. Summarize what matters for deeper internet research and identify company names, products, and useful search terms.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
      formatName: "image_research_extraction",
      schema: IMAGE_RESEARCH_SCHEMA,
      maxOutputTokens: 1400,
    }
  );

  return {
    ...extraction.data,
    title: extraction.data.title || title,
  };
}

async function extractPdfResearchInput(
  extractedText: string,
  title: string
): Promise<ImageResearchExtraction> {
  const client = createResearchClient(process.env.OPENAI_API_KEY!);
  const extraction = await createStructuredResponse<ImageResearchExtraction>(
    client,
    {
      instructions:
        `You extract research leads from uploaded business PDFs. Focus on company names, product names, market-entry clues, regulatory clues, and search seed terms relevant to KEMEDICA's MENA pharma expansion model. Return a concise summary that can be reused as search context. The PDF text is truncated to a small preview, so prioritize concrete facts and names over broad paraphrase. ${KEMEDICA_CONTEXT}`,
      input: `PDF title: ${title}

Extracted preview text:
${extractedText}`,
      formatName: "pdf_research_extraction",
      schema: IMAGE_RESEARCH_SCHEMA,
      maxOutputTokens: 900,
    }
  );

  return {
    ...extraction.data,
    title: extraction.data.title || title,
  };
}

async function getStoredFile(
  ctx: ActionCtx,
  storageId: Id<"_storage">
) {
  const blob = await ctx.storage.get(storageId);
  if (!blob) {
    throw new Error("Uploaded file could not be found in Convex storage");
  }
  return blob;
}

export const processResearchInputUpload = action({
  args: {
    drugId: v.id("drugs"),
    title: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("image")),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    extractedText: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<ProcessedResearchInputUpload> => {
    const blob = await getStoredFile(ctx, args.storageId);

    if (args.sourceType === "pdf") {
      const extractedText = args.extractedText?.trim();
      if (!extractedText) {
        throw new Error(
          "This PDF could not be reduced to usable preview text. Try a text-based PDF or paste the key pages as a note."
        );
      }

      const result = await extractPdfResearchInput(
        extractedText.slice(0, 8000),
        args.title.trim() || args.fileName || "Uploaded PDF"
      );
      const seedTerms = [...new Set([
        ...result.searchTerms,
        ...result.companyNames,
        ...result.productNames,
      ])].slice(0, 20);
      const content = result.summary;

      const id: Id<"researchInputs"> = await ctx.runMutation(
        api.researchInputs.add,
        {
          drugId: args.drugId,
          title: result.title,
          sourceType: "pdf",
          content,
          seedTerms,
          storageId: args.storageId,
          fileName: args.fileName,
          contentType: args.contentType,
        }
      );

      return {
        id,
        title: result.title,
        sourceType: "pdf" as const,
        content,
        seedTerms,
        extraction: result,
      };
    }

    const dataUrl = await blobToDataUrl(blob);
    const result = await extractImageResearchInput(dataUrl, args.title);
    const seedTerms = [...new Set([
      ...result.searchTerms,
      ...result.companyNames,
      ...result.productNames,
    ])].slice(0, 20);

    const id: Id<"researchInputs"> = await ctx.runMutation(
      api.researchInputs.add,
      {
        drugId: args.drugId,
        title: result.title,
        sourceType: "image",
        content: result.summary,
        seedTerms,
        storageId: args.storageId,
        fileName: args.fileName,
        contentType: args.contentType,
      }
    );

    return {
      id,
      title: result.title,
      sourceType: "image" as const,
      content: result.summary,
      seedTerms,
      extraction: result,
    };
  },
});

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
      const researchInputs = await ctx.runQuery(api.researchInputs.listByDrug, {
        drugId,
      });
      const entityLinks = await ctx.runQuery(api.drugEntityLinks.listByDrug, {
        drugId,
      });
      const companyMatches = company
        ? await ctx.runQuery(api.gapCompanyMatches.listByCompany, {
            companyId: company._id,
            limit: 5,
          })
        : [];

      const opportunitySummary = buildOpportunitySummary(opportunities);
      const researchInputContext = buildResearchInputContext(researchInputs);
      const companyFitContext = company
        ? [
            `Distributor fit score: ${company.distributorFitScore ?? company.bdScore ?? "unknown"}`,
            `Target segment: ${company.targetSegment ?? company.companySize ?? "unknown"}`,
            `MENA channel status: ${company.menaChannelStatus ?? company.menaPresence ?? "unknown"}`,
            `Export readiness: ${company.exportReadiness ?? "unknown"}`,
            `Partnerability signals: ${(company.partnerabilitySignals ?? []).join(", ") || "none recorded"}`,
            `Disqualifiers: ${(company.disqualifierReasons ?? []).join(", ") || "none recorded"}`,
            `Priority tier: ${company.priorityTier ?? "unknown"}`,
            `Entity roles: ${(company.entityRoles ?? []).join(", ") || "unknown"}`,
            `Commercial control: ${company.commercialControlLevel ?? "unknown"}`,
            `MENA partner strength: ${company.menaPartnershipStrength ?? "unknown"}`,
            `Approach recommendation: ${company.approachTargetRecommendation ?? "unknown"}${company.approachTargetReason ? ` — ${company.approachTargetReason}` : ""}`,
            `Known MENA partners: ${
              (company.existingMenaPartners ?? [])
                .map((partner) => `${partner.name} (${partner.role}; ${partner.geographies.join("/")})`)
                .join(", ") || "none recorded"
            }`,
          ].join("\n")
        : "No manufacturer-level distributor-fit profile attached.";
      const entityMapContext =
        entityLinks.length > 0
          ? entityLinks
              .map((entry) => {
                const name = entry.company?.name ?? entry.entityName ?? "Unknown entity";
                return `${entry.relationshipType}: ${name}${entry.isPrimary ? " (primary)" : ""}${entry.notes ? ` — ${entry.notes}` : ""}`;
              })
              .join("\n")
          : `manufacturer: ${drug.primaryManufacturerName ?? drug.manufacturerName ?? "unknown"}\nmarket_authorization_holder: ${drug.primaryMarketAuthorizationHolderName ?? "unknown"}`;
      const matchContext =
        companyMatches.length > 0
          ? companyMatches
              .map(
                (match, index) =>
                  `Match ${index + 1}: ${match.gap?.indication} | fit ${match.distributorFitScore}/10 | countries ${match.targetCountries.join(", ")} | rationale: ${match.rationale} | outreach angle: ${match.recommendedFirstOutreachAngle ?? "not set"}`
              )
              .join("\n")
          : "No persisted gap-to-manufacturer matches available.";
      const client = createResearchClient(process.env.OPENAI_API_KEY!);

      const briefResponse = await createStructuredWebSearchResponse<ReportBrief>(
        client,
        {
          instructions:
            `You are a senior pharmaceutical market-entry analyst focused on helping KEMEDICA win distributor / in-market partner mandates from overlooked European manufacturers entering MENA. Use web search and return a compact but evidence-backed JSON brief. If a fact is uncertain, say so explicitly. Cover all 15 requested MENA countries exactly once in countryFindings, but orient the brief toward pursuit strategy rather than generic market description. ${KEMEDICA_CONTEXT}`,
          input: `Research this drug as a deal pursuit brief for MENA commercialization.

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

Manufacturer distributor-fit context
${companyFitContext}

Drug entity map context
${entityMapContext}

Gap-to-manufacturer match context
${matchContext}

Supporting uploaded document context
${researchInputContext}

Research requirements
- Countries: ${MENA_COUNTRIES.join(", ")}
- Prioritize official regulator sites, WHO, PubMed, and credible market sources.
- For each country finding, include 1-4 source URLs.
- Use the uploaded document context as search seed material when relevant, especially for company names, partner names, products, and expansion clues.
- Keep each section concise but specific enough to support a written pursuit brief for KEMEDICA.
- Include an explicit entity map that distinguishes manufacturer vs MAH/commercial owner and explains whether they are the same or different.
- Prioritize why this exact manufacturer is or is not a realistic distributor target for this exact drug and gap.
- For businessDevelopmentStrategy and bdFitAssessment: assume the preferred deal model is distributor / in-market partner, recommend 2-3 launch countries first, explain likely outreach angles and objections, and surface evidence-backed disqualifiers where relevant.`,
          formatName: "mena_report_brief",
          schema: REPORT_BRIEF_SCHEMA,
          maxOutputTokens: 4200,
          searchContextSize: "high",
          maxToolCalls: 8,
        }
      );

      const brief = briefResponse.data;
      const sources = dedupeSources(brief);

      for (const finding of brief.countryFindings) {
        await ctx.runMutation(api.opportunities.upsert, {
          drugId,
          country: finding.country,
          opportunityScore: toOpportunityScore(finding.marketOpportunity),
          regulatoryStatus: toRegulatoryStatus(finding.registrationStatus),
          competitorPresence: toCompetitorPresence(finding.competitorPresence),
          marketSizeEstimate: finding.patientPopulationEstimate || undefined,
          notes: buildOpportunityNotes(finding),
        });
      }

      const markdownResponse = await createTextResponse(client, {
        instructions:
          "You are a senior pharmaceutical market-entry analyst. Convert the supplied JSON brief into a professional markdown deal pursuit brief for KEMEDICA. Use only the supplied brief, do not perform any additional research, and clearly note uncertainty where present.",
        input: `Write a markdown report with these sections and no extra top-level sections:

# Deal Pursuit Brief: ${drug.name} (${drug.genericName})
## 1. Executive Summary
## 2. Entity Map
## 3. Manufacturer Suitability
## 4. Channel Whitespace
## 5. Portfolio-to-Gap Fit
## 6. Target-Country Launch Sequence
## 7. Outreach Hypothesis
## 8. Competitive Landscape
## 9. Regulatory Pathway
## 10. Evidence-Backed Disqualifiers

Requirements:
- In section 2, clearly state the manufacturer, the MAH/commercial owner, whether they are the same or different, known MENA partner entities, and the recommended approach target.
- In section 6, include all 15 MENA countries, but clearly identify the top 2-3 launch priorities.
- Use concise paragraphs, bullets, and tables where useful.
- In section 7, include why the recommended entity is likely to engage, what KEMEDICA uniquely offers, recommended deal structure, likely objections, and a table of suggested contacts (title + rationale).
- In section 10, list concrete disqualifiers and whether each is fatal, manageable, or watch-list.
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
