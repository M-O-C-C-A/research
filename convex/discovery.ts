"use node";

import { action, ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  blobToDataUrl,
  extractSeedTerms,
} from "./fileProcessing";
import {
  createResearchClient,
  createStructuredResponse,
  createStructuredWebSearchResponse,
  RESEARCH_MODEL,
} from "./openaiResearch";
import { KEMEDICA_CONTEXT } from "../src/lib/brand";

interface CompanyCandidate {
  name: string;
  country: string;
  website?: string | null;
  sourceUrls?: string[];
}

interface ExtractedCompany extends CompanyCandidate {
  description?: string | null;
  therapeuticAreas: string[];
  menaPresence?: "none" | "limited" | "established" | null;
  companySize?: "sme" | "mid" | "large" | null;
  revenueEstimate?: string | null;
  employeeCount?: string | null;
  bdSuitabilityRationale?: string | null;
}

interface ExtractedDrug {
  name: string;
  genericName: string;
  therapeuticArea: string;
  indication: string;
  mechanism?: string | null;
  approvalStatus: "approved" | "pending" | "withdrawn";
  approvalDate?: string | null;
  category?: string | null;
  sourceUrls?: string[];
  patentExpiryYear?: number | null;
  emaApprovalDate?: string | null;
  menaRegistrations?: string[];
}

interface CompanyDiscoveryImageExtraction {
  title: string;
  summary: string;
  searchTerms: string[];
  companyNames: string[];
}

const VALID_THERAPEUTIC_AREAS = [
  "Oncology", "Cardiology", "Neurology", "Immunology", "Infectious Disease",
  "Diabetes & Endocrinology", "Respiratory", "Rare Diseases", "Hematology",
  "Gastroenterology", "Nephrology", "Ophthalmology", "Dermatology",
  "Musculoskeletal", "Psychiatry",
];

const VALID_CATEGORIES = [
  "Small Molecule", "Biologic", "Biosimilar", "Monoclonal Antibody",
  "Gene Therapy", "Cell Therapy", "Vaccine", "Diagnostic", "Medical Device",
];

const COMPANY_CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    companies: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          country: { type: "string" },
          website: { type: ["string", "null"] },
          sourceUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
          },
        },
        required: ["name", "country", "website", "sourceUrls"],
      },
    },
  },
  required: ["companies"],
} as const;

const COMPANY_ENRICHMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    companies: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          country: { type: "string" },
          website: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          therapeuticAreas: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
          sourceUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
          menaPresence: {
            type: "string",
            enum: ["none", "limited", "established"],
          },
          companySize: {
            type: "string",
            enum: ["sme", "mid", "large"],
          },
          revenueEstimate: { type: ["string", "null"] },
          employeeCount: { type: ["string", "null"] },
          bdSuitabilityRationale: { type: ["string", "null"] },
        },
        required: [
          "name",
          "country",
          "website",
          "description",
          "therapeuticAreas",
          "sourceUrls",
          "menaPresence",
          "companySize",
        ],
      },
    },
  },
  required: ["companies"],
} as const;

const DRUG_BATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    drugs: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          genericName: { type: "string" },
          therapeuticArea: { type: "string" },
          indication: { type: "string" },
          mechanism: { type: ["string", "null"] },
          approvalStatus: {
            type: "string",
            enum: ["approved", "pending", "withdrawn"],
          },
          approvalDate: { type: ["string", "null"] },
          category: { type: ["string", "null"] },
          sourceUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
          patentExpiryYear: { type: ["number", "null"] },
          emaApprovalDate: { type: ["string", "null"] },
          menaRegistrations: {
            type: "array",
            items: { type: "string" },
            maxItems: 15,
          },
        },
        required: [
          "name",
          "genericName",
          "therapeuticArea",
          "indication",
          "mechanism",
          "approvalStatus",
          "approvalDate",
          "category",
          "sourceUrls",
          "patentExpiryYear",
          "emaApprovalDate",
          "menaRegistrations",
        ],
      },
    },
  },
  required: ["drugs"],
} as const;

const COMPANY_DISCOVERY_IMAGE_SCHEMA = {
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
  },
  required: ["title", "summary", "searchTerms", "companyNames"],
} as const;

function computeInitialBdScore(company: ExtractedCompany): number {
  const sizePts =
    company.companySize === "sme" ? 3 : company.companySize === "mid" ? 2 : 0;
  const menaPts =
    company.menaPresence === "none"
      ? 4
      : company.menaPresence === "limited"
        ? 2
        : 0;
  const taPts = Math.min(company.therapeuticAreas.length, 3);
  return Math.min(10, sizePts + menaPts + taPts);
}

function computePatentUrgencyScore(patentExpiryYear: number | null): number {
  if (patentExpiryYear == null) return 5;
  const yearsRemaining = patentExpiryYear - new Date().getFullYear();
  if (yearsRemaining <= 0) return 10;
  if (yearsRemaining <= 2) return 9;
  if (yearsRemaining <= 4) return 7;
  if (yearsRemaining <= 6) return 5;
  return 3;
}

function sanitizeTherapeuticArea(area: string): string {
  const match = VALID_THERAPEUTIC_AREAS.find(
    (value) => value.toLowerCase() === area.toLowerCase()
  );
  return match ?? "Oncology";
}

function sanitizeTherapeuticAreas(areas?: string[]): string[] {
  return [...new Set(
    (areas ?? [])
      .map((area) => VALID_THERAPEUTIC_AREAS.find(
        (value) => value.toLowerCase() === area.toLowerCase()
      ))
      .filter(Boolean) as string[]
  )];
}

function sanitizeCategory(cat?: string): string | undefined {
  if (!cat) return undefined;
  const match = VALID_CATEGORIES.find(
    (value) => value.toLowerCase() === cat.toLowerCase()
  );
  return match;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function dedupeUrls(urls?: string[]): string[] {
  return [...new Set((urls ?? []).filter(Boolean))].slice(0, 4);
}

function normalizeCompanyCandidate(candidate: CompanyCandidate): CompanyCandidate | null {
  if (!candidate.name?.trim() || !candidate.country?.trim()) return null;

  return {
    name: candidate.name.trim(),
    country: candidate.country.trim(),
    website: candidate.website?.trim() || undefined,
    sourceUrls: dedupeUrls(candidate.sourceUrls),
  };
}

function normalizeExtractedCompany(company: ExtractedCompany): ExtractedCompany | null {
  const candidate = normalizeCompanyCandidate(company);
  if (!candidate) return null;

  return {
    ...candidate,
    description: company.description?.trim() || undefined,
    therapeuticAreas: sanitizeTherapeuticAreas(company.therapeuticAreas),
  };
}

function normalizeExtractedDrug(drug: ExtractedDrug): ExtractedDrug | null {
  if (!drug.name?.trim() || !drug.genericName?.trim()) return null;

  return {
    name: drug.name.trim(),
    genericName: drug.genericName.trim(),
    therapeuticArea: sanitizeTherapeuticArea(drug.therapeuticArea ?? "Oncology"),
    indication: drug.indication?.trim() || "Unspecified indication",
    mechanism: drug.mechanism?.trim() || undefined,
    approvalStatus:
      drug.approvalStatus === "pending" || drug.approvalStatus === "withdrawn"
        ? drug.approvalStatus
        : "approved",
    approvalDate: drug.approvalDate?.trim() || undefined,
    category: sanitizeCategory(drug.category ?? undefined),
    sourceUrls: dedupeUrls(drug.sourceUrls),
  };
}

async function recordTelemetry(
  ctx: ActionCtx,
  jobId: Id<"discoveryJobs">,
  telemetry: {
    requestId?: string | null;
    retryCountDelta?: number;
    warningDelta?: number;
  }
) {
  await ctx.runMutation(api.discoveryJobs.recordTelemetry, {
    id: jobId,
    provider: "openai",
    model: RESEARCH_MODEL,
    requestId: telemetry.requestId ?? undefined,
    retryCountDelta: telemetry.retryCountDelta,
    warningDelta: telemetry.warningDelta,
  });
}

async function extractCompanyDiscoveryImageInput(
  imageDataUrl: string
): Promise<CompanyDiscoveryImageExtraction> {
  const client = createResearchClient(process.env.OPENAI_API_KEY!);

  const extraction = await createStructuredResponse<CompanyDiscoveryImageExtraction>(
    client,
    {
      instructions:
        `You extract company discovery leads from uploaded business documents and screenshots. Focus on company names, distributor names, product names, market-entry clues, and search terms relevant to KEMEDICA's MENA pharma expansion model. ${KEMEDICA_CONTEXT}`,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract company-discovery search leads from this image. Summarize what matters for deeper internet research and identify likely company names and search terms.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
      formatName: "company_discovery_image_input",
      schema: COMPANY_DISCOVERY_IMAGE_SCHEMA,
      maxOutputTokens: 1200,
    }
  );

  return extraction.data;
}

async function extractCompanyDiscoveryPdfInput(
  extractedText: string,
  title: string
): Promise<CompanyDiscoveryImageExtraction> {
  const client = createResearchClient(process.env.OPENAI_API_KEY!);

  const extraction = await createStructuredResponse<CompanyDiscoveryImageExtraction>(
    client,
    {
      instructions:
        `You extract company discovery leads from uploaded business PDFs. Focus on company names, distributor names, product names, market-entry clues, and search terms relevant to KEMEDICA's MENA pharma expansion model. The provided PDF text is truncated to the most useful early pages, so prioritize extracting concrete names and phrases that can seed deeper internet research. ${KEMEDICA_CONTEXT}`,
      input: `PDF title: ${title}

Extracted preview text:
${extractedText}`,
      formatName: "company_discovery_pdf_input",
      schema: COMPANY_DISCOVERY_IMAGE_SCHEMA,
      maxOutputTokens: 900,
    }
  );

  return extraction.data;
}

export const processCompanyDiscoveryUpload = action({
  args: {
    title: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("image")),
    storageId: v.id("_storage"),
    extractedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("Uploaded discovery file could not be found");
    }

    try {
      if (args.sourceType === "pdf") {
        const extractedText = args.extractedText?.trim();
        if (!extractedText) {
          return {
            title: args.title,
            sourceType: "pdf" as const,
            content:
              "Uploaded PDF received, but no text could be extracted from the preview. Add a note or try a text-based PDF for better search seeding.",
            seedTerms: extractSeedTerms(args.title),
          };
        }

        const result = await extractCompanyDiscoveryPdfInput(
          extractedText.slice(0, 8000),
          args.title
        );
        return {
          title: result.title || args.title,
          sourceType: "pdf" as const,
          content: result.summary,
          seedTerms:
            result.searchTerms.length > 0
              ? [...new Set([...result.searchTerms, ...result.companyNames])].slice(0, 20)
              : extractSeedTerms(result.summary),
        };
      }

      const result = await extractCompanyDiscoveryImageInput(
        await blobToDataUrl(blob)
      );

      return {
        title: result.title || args.title,
        sourceType: "image" as const,
        content: result.summary,
        seedTerms: [...new Set([...result.searchTerms, ...result.companyNames])].slice(
          0,
          20
        ),
      };
    } finally {
      await ctx.storage.delete(args.storageId);
    }
  },
});

export const findCompanies = action({
  args: {
    researchContext: v.optional(v.string()),
    seedTerms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<Id<"discoveryJobs">> => {
    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "companies",
    });

    const log = async (
      message: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => {
      await ctx.runMutation(api.discoveryJobs.appendLog, {
        id: jobId,
        message,
        level,
      });
    };

    try {
      const openaiKey = process.env.OPENAI_API_KEY!;
      const client = createResearchClient(openaiKey);
      let warningCount = 0;
      const seedTerms = [...new Set((args.seedTerms ?? []).map((term) => term.trim()).filter(Boolean))].slice(0, 20);
      const researchContext = args.researchContext?.trim();

      await log("Starting European pharma company discovery...");
      if (researchContext || seedTerms.length > 0) {
        await log("Using uploaded discovery context and search seeds...");
      }

      const candidateResponse = await createStructuredWebSearchResponse<{
        companies: CompanyCandidate[];
      }>(client, {
        instructions:
          `You are a pharmaceutical industry analyst. Discover European pharma and biotech companies using web search. Return only real companies headquartered in Europe. Exclude distributors, CROs, generics-only companies, and device-only companies. ${KEMEDICA_CONTEXT}`,
        input: `Find up to 15 distinct European pharmaceutical or biotech companies with real marketed medicines or meaningful commercial presence. For each company, return only the official company name, HQ country, official website if known, and 1-3 source URLs.

Additional search seeds from uploaded files/notes:
${seedTerms.length > 0 ? seedTerms.join(", ") : "None provided"}

Supporting discovery context:
${researchContext ?? "None provided"}`,
        formatName: "company_candidates",
        schema: COMPANY_CANDIDATE_SCHEMA,
        maxOutputTokens: 1400,
        searchContextSize: "medium",
        maxToolCalls: 4,
        onRetry: async (attempt, delayMs) => {
          await log(
            `OpenAI rate limit while discovering companies. Retry ${attempt} in ${Math.round(delayMs / 1000)}s...`,
            "warning"
          );
        },
      });

      await recordTelemetry(ctx, jobId, {
        requestId: candidateResponse.requestId,
        retryCountDelta: candidateResponse.retryCount,
      });

      const candidates = [...new Map(
        (candidateResponse.data.companies ?? [])
          .map(normalizeCompanyCandidate)
          .filter(Boolean)
          .map((company) => [company!.name.toLowerCase(), company!])
      ).values()];

      await log(
        `Discovered ${candidates.length} company candidates. Enriching in ${Math.max(1, Math.ceil(candidates.length / 5))} batches...`
      );

      const batches = chunk(candidates, 5);
      const enrichedByName = new Map<string, ExtractedCompany>();

      for (const [index, batch] of batches.entries()) {
        try {
          await log(
            `Enriching company batch ${index + 1}/${batches.length}...`
          );

          const enrichmentResponse = await createStructuredWebSearchResponse<{
            companies: ExtractedCompany[];
          }>(client, {
            instructions: `You are a pharmaceutical industry analyst. Validate and enrich the listed companies using web search. Only return the companies provided in the input. Use 1-2 sentences for description. therapeuticAreas must come only from: ${VALID_THERAPEUTIC_AREAS.join(", ")}. Additionally assess: (1) company revenue/size — classify as sme (<$100M), mid ($100M-$1B), or large (>$1B) based on public filings or news; (2) MENA presence — none = no known MENA distribution, limited = some distributor arrangements but not dominant, established = own affiliate or exclusive partner in MENA; (3) write 1-sentence bdSuitabilityRationale. Prefer SME/mid companies with no or limited MENA presence as best BD targets for KEMEDICA. ${KEMEDICA_CONTEXT}`,
            input: `Enrich this company batch and confirm each company is a European pharma/biotech company. Include BD qualification fields (menaPresence, companySize, revenueEstimate, employeeCount, bdSuitabilityRationale):\n${JSON.stringify(batch, null, 2)}`,
            formatName: "company_enrichment",
            schema: COMPANY_ENRICHMENT_SCHEMA,
            maxOutputTokens: 1800,
            searchContextSize: "medium",
            maxToolCalls: 5,
            onRetry: async (attempt, delayMs) => {
              await log(
                `OpenAI rate limit on company batch ${index + 1}. Retry ${attempt} in ${Math.round(delayMs / 1000)}s...`,
                "warning"
              );
            },
          });

          await recordTelemetry(ctx, jobId, {
            requestId: enrichmentResponse.requestId,
            retryCountDelta: enrichmentResponse.retryCount,
          });

          for (const company of enrichmentResponse.data.companies ?? []) {
            const normalized = normalizeExtractedCompany(company);
            if (!normalized) continue;
            enrichedByName.set(normalized.name.toLowerCase(), normalized);
          }
        } catch (error) {
          warningCount += 1;
          await recordTelemetry(ctx, jobId, { warningDelta: 1 });
          await log(
            `Skipped company batch ${index + 1} after retry failure: ${error instanceof Error ? error.message : "Unknown error"}`,
            "warning"
          );
        }
      }

      const existing = await ctx.runQuery(api.companies.list, {});
      const existingNames = new Set(
        existing.map((company) => company.name.toLowerCase().trim())
      );

      let newCount = 0;
      let dupCount = 0;

      for (const candidate of candidates) {
        const enriched = enrichedByName.get(candidate.name.toLowerCase()) ?? {
          ...candidate,
          description: undefined,
          therapeuticAreas: [],
        };
        const nameLower = enriched.name.toLowerCase().trim();

        if (existingNames.has(nameLower)) {
          dupCount += 1;
          await log(`Skipped (already exists): ${enriched.name}`, "warning");
          continue;
        }

        const bdScore = computeInitialBdScore(enriched);
        const menaPresence =
          enriched.menaPresence === "limited" || enriched.menaPresence === "established"
            ? enriched.menaPresence
            : "none";
        const companySize =
          enriched.companySize === "mid" || enriched.companySize === "large"
            ? enriched.companySize
            : "sme";

        await ctx.runMutation(api.companies.create, {
          name: enriched.name,
          country: enriched.country,
          website: enriched.website ?? undefined,
          description: enriched.description ?? undefined,
          therapeuticAreas: enriched.therapeuticAreas,
          bdStatus: "prospect",
          bdScore,
          bdScoreRationale: enriched.bdSuitabilityRationale ?? undefined,
          companySize,
          menaPresence,
          revenueEstimate: enriched.revenueEstimate ?? undefined,
          employeeCount: enriched.employeeCount ?? undefined,
        });

        existingNames.add(nameLower);
        newCount += 1;
        await log(`Added: ${enriched.name} (${enriched.country})`, "success");
      }

      const summary = `Discovery complete — ${newCount} new companies added, ${dupCount} duplicates skipped${warningCount ? `, ${warningCount} batches warned` : ""}.`;
      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: newCount,
        skippedDuplicates: dupCount,
        summary,
      });

      return jobId;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage: msg,
      });
      return jobId;
    }
  },
});

export const findDrugsForCompany = action({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }): Promise<Id<"discoveryJobs">> => {
    const company = await ctx.runQuery(api.companies.get, { id: companyId });
    if (!company) throw new Error("Company not found");

    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "drugs",
      companyId,
      companyName: company.name,
    });

    const log = async (
      message: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => {
      await ctx.runMutation(api.discoveryJobs.appendLog, {
        id: jobId,
        message,
        level,
      });
    };

    try {
      const openaiKey = process.env.OPENAI_API_KEY!;
      const client = createResearchClient(openaiKey);
      let warningCount = 0;

      await log(`Starting drug discovery for ${company.name}...`);

      const productFamilies = [
        "marketed oncology, hematology, immunology, and rare disease medicines",
        "marketed cardiology, respiratory, endocrinology, neurology, and infectious disease medicines",
        "other marketed specialty, hospital, and pipeline-near-launch medicines with European approvals or filings",
      ];

      const extractedByInn = new Map<string, ExtractedDrug>();

      for (const [index, family] of productFamilies.entries()) {
        if (extractedByInn.size >= 20) break;

        try {
          await log(
            `Researching product family ${index + 1}/${productFamilies.length} for ${company.name}...`
          );

          const response = await createStructuredWebSearchResponse<{
            drugs: ExtractedDrug[];
          }>(client, {
            instructions: `You are a pharmaceutical portfolio analyst. Use web search to identify real medicines associated with ${company.name}. Focus on marketed or approved drugs, but include clearly late-stage pending products when materially relevant. therapeuticArea must come from: ${VALID_THERAPEUTIC_AREAS.join(", ")}. category must come from: ${VALID_CATEGORIES.join(", ")} when known. Also identify: (1) estimated patent expiry year from espacenet.com or published sources (null if unknown); (2) EMA first approval date in YYYY-MM-DD format; (3) which MENA countries the drug is already registered in — check official SFDA, UAE MOH, MOHAP, and other MENA regulators. ${KEMEDICA_CONTEXT}`,
            input: `Find up to 8 ${family} for ${company.name}. Return only products genuinely manufactured, licensed, or marketed by ${company.name} in Europe or globally. Include patentExpiryYear, emaApprovalDate, menaRegistrations, and 1-4 source URLs for each drug.`,
            formatName: "drug_batch",
            schema: DRUG_BATCH_SCHEMA,
            maxOutputTokens: 2200,
            searchContextSize: "medium",
            maxToolCalls: 5,
            onRetry: async (attempt, delayMs) => {
              await log(
                `OpenAI rate limit on ${company.name} product family ${index + 1}. Retry ${attempt} in ${Math.round(delayMs / 1000)}s...`,
                "warning"
              );
            },
          });

          await recordTelemetry(ctx, jobId, {
            requestId: response.requestId,
            retryCountDelta: response.retryCount,
          });

          for (const drug of response.data.drugs ?? []) {
            const normalized = normalizeExtractedDrug(drug);
            if (!normalized) continue;
            const innKey = normalized.genericName.toLowerCase();
            if (!extractedByInn.has(innKey) && extractedByInn.size < 20) {
              extractedByInn.set(innKey, normalized);
            }
          }
        } catch (error) {
          warningCount += 1;
          await recordTelemetry(ctx, jobId, { warningDelta: 1 });
          await log(
            `Skipped product family ${index + 1} after retry failure: ${error instanceof Error ? error.message : "Unknown error"}`,
            "warning"
          );
        }
      }

      await log(
        `AI extracted ${extractedByInn.size} potential drugs. Checking for duplicates...`
      );

      const existing = await ctx.runQuery(api.drugs.listByCompany, {
        companyId,
      });
      const existingInn = new Set(
        existing.map((drug) => drug.genericName.toLowerCase().trim())
      );

      let newCount = 0;
      let dupCount = 0;

      for (const drug of extractedByInn.values()) {
        const innLower = drug.genericName.toLowerCase().trim();
        if (existingInn.has(innLower)) {
          dupCount += 1;
          await log(
            `Skipped (already exists): ${drug.name} (${drug.genericName})`,
            "warning"
          );
          continue;
        }

        const menaCount = (drug.menaRegistrations ?? []).length;
        const patentUrgency = computePatentUrgencyScore(drug.patentExpiryYear ?? null);

        await ctx.runMutation(api.drugs.create, {
          companyId,
          name: drug.name,
          genericName: drug.genericName,
          therapeuticArea: drug.therapeuticArea,
          indication: drug.indication,
          mechanism: drug.mechanism ?? undefined,
          approvalStatus: drug.approvalStatus,
          approvalDate: drug.approvalDate ?? undefined,
          category: drug.category ?? undefined,
          patentExpiryYear: drug.patentExpiryYear ?? undefined,
          emaApprovalDate: drug.emaApprovalDate ?? undefined,
          menaRegistrationCount: menaCount,
          patentUrgencyScore: patentUrgency,
        });

        existingInn.add(innLower);
        newCount += 1;
        await log(
          `Added: ${drug.name} (${drug.genericName}) — ${drug.therapeuticArea}`,
          "success"
        );
      }

      const summary = `Discovery complete — ${newCount} new drugs added for ${company.name}, ${dupCount} duplicates skipped${warningCount ? `, ${warningCount} batches warned` : ""}.`;
      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: newCount,
        skippedDuplicates: dupCount,
        summary,
      });

      return jobId;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage: msg,
      });
      return jobId;
    }
  },
});

const BD_SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bdScore: { type: "number" },
    menaPresence: {
      type: "string",
      enum: ["none", "limited", "established"],
    },
    companySize: {
      type: "string",
      enum: ["sme", "mid", "large"],
    },
    revenueEstimate: { type: ["string", "null"] },
    employeeCount: { type: ["string", "null"] },
    rationale: { type: "string" },
    topDrugCandidates: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
    keyContacts: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: ["string", "null"] },
          title: { type: "string" },
          email: { type: ["string", "null"] },
          linkedinUrl: { type: ["string", "null"] },
        },
        required: ["name", "title", "email", "linkedinUrl"],
      },
    },
  },
  required: [
    "bdScore",
    "menaPresence",
    "companySize",
    "rationale",
    "topDrugCandidates",
    "keyContacts",
  ],
} as const;

interface BdScoreResult {
  bdScore: number;
  menaPresence: "none" | "limited" | "established";
  companySize: "sme" | "mid" | "large";
  revenueEstimate: string | null;
  employeeCount: string | null;
  rationale: string;
  topDrugCandidates: string[];
  keyContacts: Array<{
    name: string | null;
    title: string;
    email: string | null;
    linkedinUrl: string | null;
  }>;
}

export const scoreCompanyForBD = action({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }): Promise<void> => {
    const company = await ctx.runQuery(api.companies.get, { id: companyId });
    if (!company) throw new Error("Company not found");

    const drugs = await ctx.runQuery(api.drugs.listByCompany, { companyId });
    const drugList = drugs.map((d) => `${d.name} (${d.genericName})`).join(", ");

    const client = createResearchClient(process.env.OPENAI_API_KEY!);

    const response = await createStructuredWebSearchResponse<BdScoreResult>(
      client,
      {
        instructions: `You are a pharmaceutical business development analyst. Research a European pharma company to assess its suitability as a KEMEDICA partner. Score 0-10 where 10 is the ideal target: SME or mid-size European company, no MENA presence, EMA-approved drugs near patent expiry, no competing large pharma MENA relationships. ${KEMEDICA_CONTEXT}`,
        input: `Research ${company.name} (${company.country}, website: ${company.website ?? "unknown"}) for KEMEDICA BD qualification.

Known drug portfolio: ${drugList || "None discovered yet"}

Assess:
1. Revenue and headcount — classify size as sme (<$100M), mid ($100M-$1B), or large (>$1B)
2. Existing MENA distribution partnerships or subsidiaries (search for MENA, Middle East, Gulf, GCC partnerships)
3. Patent cliff signals in portfolio (drugs expiring within 4 years create urgency to find new markets)
4. Public BD/licensing signals (press releases, partnering activity)
5. Key decision-maker contacts (BD Director, VP BD, CEO for SMEs, Head of International) — name, title, email if public

Return a bdScore (0-10), rationale, top 3-5 drug candidates for MENA expansion, and up to 3 key contacts.`,
        formatName: "bd_score",
        schema: BD_SCORE_SCHEMA,
        maxOutputTokens: 1500,
        searchContextSize: "medium",
        maxToolCalls: 5,
      }
    );

    const result = response.data;
    const contact = result.keyContacts?.[0];

    await ctx.runMutation(api.companies.update, {
      id: companyId,
      bdScore: Math.min(10, Math.max(0, result.bdScore)),
      bdScoreRationale: result.rationale,
      menaPresence: result.menaPresence,
      companySize: result.companySize,
      revenueEstimate: result.revenueEstimate ?? undefined,
      employeeCount: result.employeeCount ?? undefined,
      contactName: contact?.name ?? undefined,
      contactTitle: contact?.title ?? undefined,
      contactEmail: contact?.email ?? undefined,
      linkedinUrl: contact?.linkedinUrl ?? undefined,
      bdScoredAt: Date.now(),
    });

    await ctx.runMutation(api.bdActivities.create, {
      companyId,
      type: "note",
      content: `BD score updated by AI: ${result.bdScore}/10 — ${result.rationale.slice(0, 200)}`,
    });
  },
});

/**
 * findCompaniesForGap — targeted discovery of EU manufacturers for a specific
 * MENA supply gap. Unlike generic findCompanies, this:
 *   - Searches specifically for manufacturers of the gap's drug classes / indication
 *   - Explicitly targets companies with NO current MENA presence
 *   - Auto-links every newly discovered company back to the gap record
 *   - Returns the job ID so the caller can show live progress
 */
export const findCompaniesForGap = action({
  args: { gapOpportunityId: v.id("gapOpportunities") },
  handler: async (ctx, { gapOpportunityId }): Promise<Id<"discoveryJobs">> => {
    const gap = await ctx.runQuery(api.gapOpportunities.get, {
      id: gapOpportunityId,
    });
    if (!gap) throw new Error("Gap opportunity not found");

    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "companies",
      gapOpportunityId,
    });

    const log = async (
      message: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => {
      await ctx.runMutation(api.discoveryJobs.appendLog, { id: jobId, message, level });
    };

    try {
      const client = createResearchClient(process.env.OPENAI_API_KEY!);
      let warningCount = 0;

      const drugClasses = gap.suggestedDrugClasses.join(", ");
      const countries = gap.targetCountries.slice(0, 5).join(", ");

      await log(
        `Searching for EU suppliers of ${gap.indication} (${gap.therapeuticArea}) for ${countries}...`
      );
      await log(`Target drug classes: ${drugClasses}`);

      // ── Step 1: Targeted candidate search ───────────────────────────────────
      const candidateResponse = await createStructuredWebSearchResponse<{
        companies: CompanyCandidate[];
      }>(client, {
        instructions: `You are a pharmaceutical business development analyst working for KEMEDICA, a company that connects European pharma manufacturers with MENA markets. Your task is to find EU-based pharma/biotech companies that are the BEST candidates for KEMEDICA to approach as distribution partners. Ideal targets: SME or mid-size European companies (not Big Pharma) with EMA-approved drugs in the relevant drug classes who have NO or LIMITED presence in MENA/Middle East markets. ${KEMEDICA_CONTEXT}`,
        input: `Find up to 15 European pharmaceutical or biotech companies that manufacture, license, or commercialize drugs in these classes: ${drugClasses}

The indication is: ${gap.indication} (${gap.therapeuticArea})

KEMEDICA wants to approach these companies to become their exclusive MENA distribution partner for the following markets: ${countries}

Priority criteria — search specifically for companies that:
1. Have EMA-approved drugs for this indication or closely related conditions
2. Are small-to-mid size European companies (NOT Pfizer, Novartis, Roche, AstraZeneca, or other Big Pharma with their own MENA affiliate)
3. Have NOT yet entered MENA markets, or have only limited/non-exclusive distributor relationships there
4. May have upcoming patent pressure (motivating them to find new markets)

Return company name, EU HQ country, website if known, and 1-3 source URLs.`,
        formatName: "company_candidates",
        schema: COMPANY_CANDIDATE_SCHEMA,
        maxOutputTokens: 1400,
        searchContextSize: "high",
        maxToolCalls: 6,
        onRetry: async (attempt, delayMs) => {
          await log(
            `Rate limit hit. Retry ${attempt} in ${Math.round(delayMs / 1000)}s...`,
            "warning"
          );
        },
      });

      await recordTelemetry(ctx, jobId, {
        requestId: candidateResponse.requestId,
        retryCountDelta: candidateResponse.retryCount,
      });

      const candidates = [
        ...new Map(
          (candidateResponse.data.companies ?? [])
            .map(normalizeCompanyCandidate)
            .filter(Boolean)
            .map((c) => [c!.name.toLowerCase(), c!])
        ).values(),
      ];

      await log(
        `Found ${candidates.length} candidate suppliers. Enriching with BD qualification data...`
      );

      // ── Step 2: BD-focused enrichment ───────────────────────────────────────
      const batches = chunk(candidates, 5);
      const enrichedByName = new Map<string, ExtractedCompany>();

      for (const [index, batch] of batches.entries()) {
        try {
          await log(`Enriching batch ${index + 1}/${batches.length}...`);

          const enrichmentResponse = await createStructuredWebSearchResponse<{
            companies: ExtractedCompany[];
          }>(client, {
            instructions: `You are a pharmaceutical BD analyst. Validate and enrich these candidate EU pharma companies specifically for KEMEDICA's MENA expansion model. Confirm each company makes drugs relevant to: ${gap.indication} (${gap.therapeuticArea}). therapeuticAreas must come from: ${VALID_THERAPEUTIC_AREAS.join(", ")}. Assess: (1) company size — sme (<$100M), mid ($100M-$1B), or large (>$1B); (2) MENA presence — none = no known MENA distribution, limited = some distributor but not exclusive/dominant, established = own affiliate or exclusive partner; (3) write a 1-sentence bdSuitabilityRationale that explains why this company would or wouldn't be a good KEMEDICA BD target for ${gap.indication} in MENA. ${KEMEDICA_CONTEXT}`,
            input: `Enrich these candidate EU pharma companies. Each should be relevant to: ${drugClasses} for ${gap.indication}:\n${JSON.stringify(batch, null, 2)}`,
            formatName: "company_enrichment",
            schema: COMPANY_ENRICHMENT_SCHEMA,
            maxOutputTokens: 1800,
            searchContextSize: "medium",
            maxToolCalls: 5,
            onRetry: async (attempt, delayMs) => {
              await log(
                `Rate limit on enrichment batch ${index + 1}. Retry ${attempt} in ${Math.round(delayMs / 1000)}s...`,
                "warning"
              );
            },
          });

          await recordTelemetry(ctx, jobId, {
            requestId: enrichmentResponse.requestId,
            retryCountDelta: enrichmentResponse.retryCount,
          });

          for (const company of enrichmentResponse.data.companies ?? []) {
            const normalized = normalizeExtractedCompany(company);
            if (!normalized) continue;
            enrichedByName.set(normalized.name.toLowerCase(), normalized);
          }
        } catch (error) {
          warningCount += 1;
          await recordTelemetry(ctx, jobId, { warningDelta: 1 });
          await log(
            `Skipped enrichment batch ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
            "warning"
          );
        }
      }

      // ── Step 3: Deduplicate, insert, and link to gap ─────────────────────────
      const existing = await ctx.runQuery(api.companies.list, {});
      const existingNames = new Set(
        existing.map((c) => c.name.toLowerCase().trim())
      );
      // Also build an ID map so we can link existing companies to the gap
      const existingByName = new Map(
        existing.map((c) => [c.name.toLowerCase().trim(), c._id])
      );

      let newCount = 0;
      let dupCount = 0;
      const linkedCompanyIds: Id<"companies">[] = [];

      for (const candidate of candidates) {
        const enriched = enrichedByName.get(candidate.name.toLowerCase()) ?? {
          ...candidate,
          description: undefined,
          therapeuticAreas: [],
        };
        const nameLower = enriched.name.toLowerCase().trim();

        if (existingNames.has(nameLower)) {
          dupCount += 1;
          // Still link the existing company to this gap
          const existingId = existingByName.get(nameLower);
          if (existingId) linkedCompanyIds.push(existingId);
          await log(
            `Already in registry: ${enriched.name} — linking to gap`,
            "info"
          );
          continue;
        }

        const bdScore = computeInitialBdScore(enriched);
        const menaPresence =
          enriched.menaPresence === "limited" || enriched.menaPresence === "established"
            ? enriched.menaPresence
            : "none";
        const companySize =
          enriched.companySize === "mid" || enriched.companySize === "large"
            ? enriched.companySize
            : "sme";

        const newCompanyId = await ctx.runMutation(api.companies.create, {
          name: enriched.name,
          country: enriched.country,
          website: enriched.website ?? undefined,
          description: enriched.description ?? undefined,
          therapeuticAreas: enriched.therapeuticAreas,
          bdStatus: "prospect",
          bdScore,
          bdScoreRationale: enriched.bdSuitabilityRationale ?? undefined,
          companySize,
          menaPresence,
          revenueEstimate: enriched.revenueEstimate ?? undefined,
          employeeCount: enriched.employeeCount ?? undefined,
        });

        linkedCompanyIds.push(newCompanyId);
        existingNames.add(nameLower);
        newCount += 1;

        const presenceLabel = menaPresence === "none"
          ? "no MENA presence"
          : menaPresence === "limited"
            ? "limited MENA presence"
            : "MENA established";
        await log(
          `Added: ${enriched.name} (${enriched.country}, ${companySize}, ${presenceLabel}, BD score ${bdScore}/10)`,
          "success"
        );
      }

      // Link all found companies to the gap record
      for (const companyId of linkedCompanyIds) {
        await ctx.runMutation(api.gapOpportunities.linkCompany, {
          id: gapOpportunityId,
          companyId,
        });
      }

      const totalLinked = linkedCompanyIds.length;
      const summary = `Supplier search complete — ${newCount} new companies added and ${totalLinked} total linked to this gap (${dupCount} were already in registry).${warningCount ? ` ${warningCount} batches had warnings.` : ""}`;

      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: newCount,
        skippedDuplicates: dupCount,
        summary,
      });

      return jobId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(api.discoveryJobs.fail, { id: jobId, errorMessage: msg });
      return jobId;
    }
  },
});
