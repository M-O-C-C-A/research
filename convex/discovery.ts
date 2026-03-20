"use node";

import { toFile } from "openai";
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
        },
        required: [
          "name",
          "country",
          "website",
          "description",
          "therapeuticAreas",
          "sourceUrls",
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
  blob: Blob,
  title: string
): Promise<CompanyDiscoveryImageExtraction> {
  const client = createResearchClient(process.env.OPENAI_API_KEY!);
  const openaiFile = await client.files.create({
    file: await toFile(
      Buffer.from(await blob.arrayBuffer()),
      title,
      { type: blob.type || "application/pdf" }
    ),
    purpose: "user_data",
  });

  try {
    await client.files.waitForProcessing(openaiFile.id, {
      pollInterval: 1000,
      maxWait: 30000,
    });

    const extraction = await createStructuredResponse<CompanyDiscoveryImageExtraction>(
      client,
      {
        instructions:
          `You extract company discovery leads from uploaded business PDFs. Focus on company names, distributor names, product names, market-entry clues, and search terms relevant to KEMEDICA's MENA pharma expansion model. ${KEMEDICA_CONTEXT}`,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Read this PDF and extract company-discovery search leads. Summarize what matters for deeper internet research and identify likely company names and search terms.",
              },
              {
                type: "input_file",
                filename: title,
                file_id: openaiFile.id,
              },
            ],
          },
        ],
        formatName: "company_discovery_pdf_input",
        schema: COMPANY_DISCOVERY_IMAGE_SCHEMA,
        maxOutputTokens: 1400,
      }
    );

    return extraction.data;
  } finally {
    await client.files.delete(openaiFile.id).catch(() => null);
  }
}

export const processCompanyDiscoveryUpload = action({
  args: {
    title: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("image")),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("Uploaded discovery file could not be found");
    }

    try {
      if (args.sourceType === "pdf") {
        const result = await extractCompanyDiscoveryPdfInput(blob, args.title);
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
            instructions: `You are a pharmaceutical industry analyst. Validate and enrich the listed companies using web search. Only return the companies provided in the input. Use 1-2 sentences for description. therapeuticAreas must come only from: ${VALID_THERAPEUTIC_AREAS.join(", ")}. ${KEMEDICA_CONTEXT}`,
            input: `Enrich this company batch and confirm each company is a European pharma/biotech company:\n${JSON.stringify(batch, null, 2)}`,
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

        await ctx.runMutation(api.companies.create, {
          name: enriched.name,
          country: enriched.country,
          website: enriched.website ?? undefined,
          description: enriched.description ?? undefined,
          therapeuticAreas: enriched.therapeuticAreas,
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
            instructions: `You are a pharmaceutical portfolio analyst. Use web search to identify real medicines associated with ${company.name}. Focus on marketed or approved drugs, but include clearly late-stage pending products when materially relevant. therapeuticArea must come from: ${VALID_THERAPEUTIC_AREAS.join(", ")}. category must come from: ${VALID_CATEGORIES.join(", ")} when known. ${KEMEDICA_CONTEXT}`,
            input: `Find up to 8 ${family} for ${company.name}. Return only products genuinely manufactured, licensed, or marketed by ${company.name} in Europe or globally. Include 1-4 source URLs for each drug.`,
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
