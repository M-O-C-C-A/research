"use node";

import { action, ActionCtx, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  createResearchClient,
  createStructuredWebSearchResponse,
  ResearchSource,
} from "./openaiResearch";
import { KEMEDICA_CONTEXT } from "../src/lib/brand";
import { GCC_PLUS_COUNTRIES, THERAPEUTIC_AREAS } from "./constants";
import { appendFlowLog } from "./gapFlow";
import { runFindCompaniesForGapJob } from "./discovery";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const GAP_BURDEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    indications: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          burden: { type: "string" },
          whoSourceUrl: { type: ["string", "null"] },
          govPriority: { type: "string" },
          existingTreatments: {
            type: "array",
            items: { type: "string" },
            maxItems: 6,
          },
        },
        required: ["name", "burden", "whoSourceUrl", "govPriority", "existingTreatments"],
      },
    },
  },
  required: ["indications"],
} as const;

interface IndicationBurden {
  name: string;
  burden: string;
  whoSourceUrl: string | null;
  govPriority: string;
  existingTreatments: string[];
}

const GAP_SUPPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    registeredDrugs: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          brandName: { type: "string" },
          inn: { type: "string" },
          originator: { type: "string" },
          countries: {
            type: "array",
            items: { type: "string" },
            maxItems: 15,
          },
        },
        required: ["brandName", "inn", "originator", "countries"],
      },
    },
    unregisteredEuDrugs: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          brandName: { type: "string" },
          inn: { type: "string" },
          originator: { type: "string" },
          emaApprovalYear: { type: ["number", "null"] },
          indication: { type: "string" },
          whyNotInMena: { type: ["string", "null"] },
        },
        required: ["brandName", "inn", "originator", "emaApprovalYear", "indication", "whyNotInMena"],
      },
    },
    tenderSignals: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          country: { type: "string" },
          description: { type: "string" },
          sourceUrl: { type: ["string", "null"] },
          year: { type: ["number", "null"] },
        },
        required: ["country", "description", "sourceUrl", "year"],
      },
    },
    gapType: {
      type: "string",
      enum: [
        "regulatory_gap",
        "formulary_gap",
        "shortage_gap",
        "tender_pull",
        "channel_whitespace",
      ],
    },
    validationStatus: {
      type: "string",
      enum: ["confirmed", "likely", "insufficient_evidence"],
    },
    evidenceSummary: { type: "string" },
    currentAvailability: {
      type: "string",
      enum: ["broad", "limited", "unclear"],
    },
    evidenceItems: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          claim: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          sourceKind: {
            type: "string",
            enum: [
              "official_registry",
              "ema",
              "government_publication",
              "tender_portal",
              "who_or_gbd",
              "market_report",
            ],
          },
          country: { type: ["string", "null"] },
          productOrClass: { type: ["string", "null"] },
          confidence: {
            type: "string",
            enum: ["confirmed", "likely", "inferred"],
          },
        },
        required: ["claim", "title", "url", "sourceKind", "country", "productOrClass", "confidence"],
      },
    },
    gapSummary: { type: "string" },
    gapScore: { type: "number" },
    suggestedDrugClasses: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    regulatoryFeasibility: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
  required: [
    "registeredDrugs",
    "unregisteredEuDrugs",
    "tenderSignals",
    "gapType",
    "validationStatus",
    "evidenceSummary",
    "currentAvailability",
    "evidenceItems",
    "gapSummary",
    "gapScore",
    "suggestedDrugClasses",
    "regulatoryFeasibility",
  ],
} as const;

interface SupplyGapResult {
  gapType:
    | "regulatory_gap"
    | "formulary_gap"
    | "shortage_gap"
    | "tender_pull"
    | "channel_whitespace";
  validationStatus: "confirmed" | "likely" | "insufficient_evidence";
  evidenceSummary: string;
  currentAvailability: "broad" | "limited" | "unclear";
  evidenceItems: Array<{
    claim: string;
    title: string;
    url: string;
    sourceKind:
      | "official_registry"
      | "ema"
      | "government_publication"
      | "tender_portal"
      | "who_or_gbd"
      | "market_report";
    country: string | null;
    productOrClass: string | null;
    confidence: "confirmed" | "likely" | "inferred";
  }>;
  registeredDrugs: Array<{
    brandName: string;
    inn: string;
    originator: string;
    countries: string[];
  }>;
  unregisteredEuDrugs: Array<{
    brandName: string;
    inn: string;
    originator: string;
    emaApprovalYear: number | null;
    indication: string;
    whyNotInMena: string | null;
  }>;
  tenderSignals: Array<{
    country: string;
    description: string;
    sourceUrl: string | null;
    year: number | null;
  }>;
  gapSummary: string;
  gapScore: number;
  suggestedDrugClasses: string[];
  regulatoryFeasibility: "high" | "medium" | "low";
}

const DEMAND_SIGNALS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    signals: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          country: { type: "string" },
          signalType: {
            type: "string",
            enum: ["tender", "formulary_gap", "shortage", "health_priority", "procurement_list"],
          },
          drugOrClass: { type: "string" },
          therapeuticArea: { type: "string" },
          description: { type: "string" },
          urgency: { type: "string", enum: ["high", "medium", "low"] },
          sourceUrl: { type: ["string", "null"] },
          year: { type: ["number", "null"] },
        },
        required: [
          "country",
          "signalType",
          "drugOrClass",
          "therapeuticArea",
          "description",
          "urgency",
          "sourceUrl",
          "year",
        ],
      },
    },
    summary: { type: "string" },
  },
  required: ["signals", "summary"],
} as const;

interface DemandSignalsResult {
  signals: Array<{
    country: string;
    signalType: string;
    drugOrClass: string;
    therapeuticArea: string;
    description: string;
    urgency: string;
    sourceUrl: string | null;
    year: number | null;
  }>;
  summary: string;
}

type GapType = SupplyGapResult["gapType"];
type GapValidationStatus = SupplyGapResult["validationStatus"];
type GapEvidenceItem = SupplyGapResult["evidenceItems"][number];
type ProductGapKind =
  | "fda_absent_mena"
  | "ema_absent_mena"
  | "fda_ema_absent_mena"
  | "different_brand_present"
  | "generic_present"
  | "off_patent"
  | "near_patent_expiry"
  | "biosimilar_opportunity"
  | "reference_biologic_opportunity"
  | "unclear_presence";

type MarketPresenceState =
  | "absent"
  | "present"
  | "different_brand_present"
  | "generic_present"
  | "unclear";

function clampGapScore(value: number) {
  return Math.min(10, Math.max(0, value));
}

function uniqBy<T>(items: T[], keyFn: (item: T) => string) {
  return [...new Map(items.map((item) => [keyFn(item), item])).values()];
}

function buildSourceTitle(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeExternalUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw) && !/\s/.test(raw)) {
    return `https://${raw}`;
  }
  return null;
}

function normalizeGapCountry(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeNameToken(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatProductGapKind(kind?: ProductGapKind) {
  if (!kind) return "product gap";
  return kind.replace(/_/g, " ");
}

function summarizeApprovalCoverage(hasFda: boolean, hasEma: boolean) {
  if (hasFda && hasEma) return "FDA and EMA";
  if (hasFda) return "FDA";
  if (hasEma) return "EMA";
  return "external regulators";
}

function getPrimaryProductGapType(kind: ProductGapKind): GapType {
  switch (kind) {
    case "fda_absent_mena":
    case "ema_absent_mena":
    case "fda_ema_absent_mena":
      return "regulatory_gap";
    case "different_brand_present":
    case "generic_present":
    case "off_patent":
    case "near_patent_expiry":
    case "biosimilar_opportunity":
    case "reference_biologic_opportunity":
    case "unclear_presence":
    default:
      return "channel_whitespace";
  }
}

function scoreProductLedGap(args: {
  hasFda: boolean;
  hasEma: boolean;
  absentCount: number;
  differentBrandCount: number;
  genericCount: number;
  offPatent: boolean;
  nearExpiry: boolean;
  isBiologicOpportunity: boolean;
  hasStrongEvidence: boolean;
}) {
  let score = 0;
  if (args.hasFda) score += 2.4;
  if (args.hasEma) score += 2.4;
  if (args.hasFda && args.hasEma) score += 1;
  score += Math.min(2.5, args.absentCount * 1.2);
  if (args.differentBrandCount > 0) score += 0.8;
  if (args.genericCount > 0) score += 0.4;
  if (args.offPatent) score += 1.2;
  else if (args.nearExpiry) score += 0.8;
  if (args.isBiologicOpportunity) score += 1;
  if (!args.hasStrongEvidence) score -= 1.8;
  if (args.genericCount > 0 && args.absentCount === 0) score -= 1.2;
  return clampGapScore(score);
}

function chooseProductGapKind(args: {
  hasFda: boolean;
  hasEma: boolean;
  absentCount: number;
  differentBrandCount: number;
  genericCount: number;
  offPatent: boolean;
  nearExpiry: boolean;
  productType: string;
  hasReferenceProduct: boolean;
  hasBiosimilars: boolean;
}) {
  if (args.productType === "biosimilar") {
    return "biosimilar_opportunity" as const;
  }
  if (
    args.productType === "biologic" &&
    (args.hasReferenceProduct || args.hasBiosimilars)
  ) {
    return "reference_biologic_opportunity" as const;
  }
  if (args.absentCount > 0 && args.hasFda && args.hasEma) {
    return "fda_ema_absent_mena" as const;
  }
  if (args.absentCount > 0 && args.hasFda) {
    return "fda_absent_mena" as const;
  }
  if (args.absentCount > 0 && args.hasEma) {
    return "ema_absent_mena" as const;
  }
  if (args.differentBrandCount > 0) {
    return "different_brand_present" as const;
  }
  if (args.genericCount > 0) {
    return "generic_present" as const;
  }
  if (args.offPatent) {
    return "off_patent" as const;
  }
  if (args.nearExpiry) {
    return "near_patent_expiry" as const;
  }
  return "unclear_presence" as const;
}

function dedupeSimpleStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function deriveGapNarrative(args: {
  gapType: GapType;
  validationStatus: GapValidationStatus;
  missingList: string;
  tenderSignals: SupplyGapResult["tenderSignals"];
  evidenceSummary: string;
}) {
  if (args.validationStatus === "insufficient_evidence") {
    return `Evidence remains insufficient to prove a supply gap. ${args.evidenceSummary}`.trim();
  }

  switch (args.gapType) {
    case "regulatory_gap":
      return `Verified registration gap: ${args.missingList || "specific missing products/classes were identified in official checks."}`;
    case "formulary_gap":
      return `Likely formulary gap: ${args.evidenceSummary}`;
    case "shortage_gap":
      return `Shortage signal: ${args.evidenceSummary}`;
    case "tender_pull":
      return args.tenderSignals.length > 0
        ? `Tender pull detected: ${args.tenderSignals
            .slice(0, 2)
            .map((signal) => `${signal.country}: ${signal.description}`)
            .join("; ")}`
        : `Tender pull detected: ${args.evidenceSummary}`;
    case "channel_whitespace":
      return `Channel whitespace hypothesis: ${args.evidenceSummary}`;
    default:
      return args.evidenceSummary;
  }
}

function deriveCompetitorNarrative(registeredDrugs: SupplyGapResult["registeredDrugs"]) {
  const competitorList = registeredDrugs
    .slice(0, 5)
    .map((drug) => `${drug.brandName} (${drug.originator})`)
    .join("; ");
  return competitorList || "No competitors identified";
}

function deriveGapCreationDecision(gap: SupplyGapResult) {
  const verifiedRegisteredCount = uniqBy(
    gap.registeredDrugs,
    (drug) => `${drug.brandName}|${drug.originator}`
  ).length;
  const verifiedMissingCount = uniqBy(
    gap.unregisteredEuDrugs,
    (drug) => `${drug.brandName}|${drug.inn}|${drug.originator}`
  ).length;
  const hasTenderPull = gap.tenderSignals.length > 0;
  const hasStructuredGap =
    verifiedMissingCount > 0 ||
    gap.gapType === "formulary_gap" ||
    gap.gapType === "shortage_gap" ||
    gap.gapType === "tender_pull" ||
    gap.gapType === "channel_whitespace";

  if (gap.validationStatus === "insufficient_evidence") {
    return {
      create: false,
      finalScore: 0,
      reason: "Evidence was insufficient to verify a real supply gap.",
      verifiedRegisteredCount,
      verifiedMissingCount,
    };
  }

  if (!hasStructuredGap) {
    return {
      create: false,
      finalScore: 0,
      reason: "Demand evidence existed, but no verified gap signal was found.",
      verifiedRegisteredCount,
      verifiedMissingCount,
    };
  }

  if (
    gap.currentAvailability === "broad" &&
    verifiedMissingCount === 0 &&
    !hasTenderPull &&
    gap.gapType !== "shortage_gap" &&
    gap.gapType !== "formulary_gap"
  ) {
    return {
      create: false,
      finalScore: 0,
      reason: "Existing standard-of-care availability appears broad, so this is not a strict supply gap.",
      verifiedRegisteredCount,
      verifiedMissingCount,
    };
  }

  let finalScore = clampGapScore(gap.gapScore);
  if (gap.currentAvailability === "broad" && verifiedMissingCount === 0) {
    finalScore = clampGapScore(finalScore - 3);
  }
  if (verifiedMissingCount === 0 && hasTenderPull) {
    finalScore = clampGapScore(finalScore - 1);
  }
  if (verifiedMissingCount > 0 && gap.validationStatus === "confirmed") {
    finalScore = clampGapScore(finalScore + 0.5);
  }

  return {
    create: finalScore >= 5,
    finalScore,
    reason:
      finalScore >= 5
        ? "Evidence gate passed."
        : "Gap score fell below threshold after applying strict evidence gating.",
    verifiedRegisteredCount,
    verifiedMissingCount,
  };
}

function buildGapSources(args: {
  evidenceItems: GapEvidenceItem[];
  responseSources: ResearchSource[];
  tenderSignals: SupplyGapResult["tenderSignals"];
  whoSourceUrl: string | null;
}) {
  const directSources = args.evidenceItems.map((item) => ({
    title: item.title,
    url: normalizeExternalUrl(item.url),
  })).filter((item): item is { title: string; url: string } => Boolean(item.url));
  const responseSources = args.responseSources.map((source) => ({
    title: source.title || buildSourceTitle(source.url),
    url: normalizeExternalUrl(source.url),
  })).filter((item): item is { title: string; url: string } => Boolean(item.url));
  const tenderSources = args.tenderSignals
    .filter((signal) => normalizeExternalUrl(signal.sourceUrl))
    .map((signal) => ({
      title: `${signal.country} tender signal`,
      url: normalizeExternalUrl(signal.sourceUrl)!,
    }));
  const whoSources = args.whoSourceUrl
    ? (() => {
        const url = normalizeExternalUrl(args.whoSourceUrl);
        return url ? [{ title: "WHO/GBD disease burden", url }] : [];
      })()
    : [];

  return uniqBy(
    [...directSources, ...responseSources, ...tenderSources, ...whoSources],
    (source) => source.url
  ).slice(0, 12);
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export const analyzeTherapeuticAreaGaps = action({
  args: {
    therapeuticArea: v.string(),
    targetCountries: v.optional(v.array(v.string())),
    indication: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"discoveryJobs">> => {
    const countries = args.targetCountries ?? [...GCC_PLUS_COUNTRIES];

    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "gap_analysis",
      therapeuticArea: args.therapeuticArea,
      targetCountries: countries,
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
      const client = createResearchClient(process.env.OPENAI_API_KEY!);
      const indicationFilter = args.indication
        ? `Focus on: ${args.indication}.`
        : "";

      await log(
        `Starting gap analysis for ${args.therapeuticArea} in ${countries.join(", ")}...`
      );

      // Call 1: Disease burden research
      await log("Researching WHO disease burden and unmet need...");
      const burdenResponse = await createStructuredWebSearchResponse<{
        indications: IndicationBurden[];
      }>(client, {
        instructions: `You are a MENA healthcare market analyst. Research WHO and government disease burden data for pharmaceutical market opportunities. ${KEMEDICA_CONTEXT}`,
        input: `Research WHO disease burden for ${args.therapeuticArea} across ${countries.join(", ")}. ${indicationFilter}

Identify up to 6 specific indications with the highest patient burden in these countries. For each indication provide:
- burden: prevalence estimate, annual incidence, or DALYs from WHO/GBD data
- whoSourceUrl: source URL (WHO EMRO, GBD, national health reports)
- govPriority: whether this is listed as a national health priority in any target country
- existingTreatments: currently used treatments in the region (brand names or drug classes)`,
        formatName: "gap_burden",
        schema: GAP_BURDEN_SCHEMA,
        maxOutputTokens: 2000,
        searchContextSize: "high",
        maxToolCalls: 8,
      });

      const indications = burdenResponse.data.indications ?? [];
      await log(
        `Found ${indications.length} indications with disease burden data. Mapping supply gaps...`
      );

      // Call 2: Supply gap mapping per high-burden indication
      let gapsCreated = 0;

      for (const indication of indications) {
        await log(
          `Analyzing supply gap for: ${indication.name}...`
        );

        try {
          const supplyResponse = await createStructuredWebSearchResponse<SupplyGapResult>(
            client,
            {
              instructions: `You are a pharmaceutical market access analyst. Identify verifiable gaps between European drug supply and MENA market needs. ${KEMEDICA_CONTEXT} Use official registries and authoritative public sources first. If a claim cannot be verified, mark it as insufficient evidence rather than inferring absence.`,
              input: `For the indication "${indication.name}" (${args.therapeuticArea}) in ${countries.join(", ")}:

1. Verify which drugs are currently registered and marketed for this indication using official MENA registries whenever possible.
2. Compare against EMA-approved therapies for the same indication and list only products/classes that appear missing after checking named registries or authoritative sources.
3. Identify any active formulary omission, shortage, tender, or procurement pull in the past 24 months.
4. Decide whether there is a real gap and classify it as one of:
   - regulatory_gap
   - formulary_gap
   - shortage_gap
   - tender_pull
   - channel_whitespace

Rules:
- Prefer SFDA, UAE MoHAP, EDA, JFDA, GCC, EMA, WHO/GBD, and named government tender portals.
- Do not convert disease burden alone into a gap.
- If current standard of care appears broadly available, say so.
- Use validationStatus = "insufficient_evidence" when checks are inconclusive.
- For every evidence item include a concrete title and URL.

Return gapScore 0-10 where 10 = verifiable unmet need with specific missing products/classes or active shortage/tender evidence.
suggestedDrugClasses should list drug classes that are actually implicated by the verified evidence.`,
              formatName: "gap_supply",
              schema: GAP_SUPPLY_SCHEMA,
              maxOutputTokens: 2500,
              searchContextSize: "medium",
              maxToolCalls: 6,
            }
          );

          const gap = supplyResponse.data;
          const decision = deriveGapCreationDecision(gap);
          const score = decision.finalScore;

          if (decision.create) {
            const competitorList = deriveCompetitorNarrative(gap.registeredDrugs);
            const unregisteredList = gap.unregisteredEuDrugs
              .slice(0, 5)
              .map((d: { brandName: string; inn: string; originator: string }) => `${d.brandName}/${d.inn} (${d.originator})`)
              .join("; ");
            const tenderText =
              gap.tenderSignals.length > 0
                ? gap.tenderSignals
                    .map((t) => `${t.country} (${t.year ?? "recent"}): ${t.description}`)
                    .join("\n")
                : undefined;
            const evidenceItems = gap.evidenceItems
              .map((item) => ({
                ...item,
                url: normalizeExternalUrl(item.url),
              }))
              .filter((item) => item.url && item.title && item.claim)
              .map((item) => ({
                claim: item.claim,
                title: item.title,
                url: item.url!,
                sourceKind: item.sourceKind,
                country: item.country ?? undefined,
                productOrClass: item.productOrClass ?? undefined,
                confidence: item.confidence,
              }));
            const sources = buildGapSources({
              evidenceItems: gap.evidenceItems,
              responseSources: supplyResponse.sources,
              tenderSignals: gap.tenderSignals,
              whoSourceUrl: indication.whoSourceUrl,
            });
            await ctx.runMutation(api.gapOpportunities.create, {
              therapeuticArea: args.therapeuticArea,
              indication: indication.name,
              targetCountries: countries,
              gapScore: score,
              analysisLens: "demand_led",
              gapType: gap.gapType,
              validationStatus: gap.validationStatus,
              evidenceSummary: gap.evidenceSummary,
              verifiedRegisteredCount: decision.verifiedRegisteredCount,
              verifiedMissingCount: decision.verifiedMissingCount,
              demandEvidence: `${indication.burden}\n\nGovernment priority: ${indication.govPriority}`,
              supplyGap: deriveGapNarrative({
                gapType: gap.gapType,
                validationStatus: gap.validationStatus,
                missingList: unregisteredList,
                tenderSignals: gap.tenderSignals,
                evidenceSummary: gap.evidenceSummary,
              }),
              competitorLandscape: competitorList,
              suggestedDrugClasses: gap.suggestedDrugClasses,
              tenderSignals: tenderText,
              whoDiseaseBurden: indication.burden,
              regulatoryFeasibility: gap.regulatoryFeasibility,
              sources,
              evidenceItems,
            });

            gapsCreated++;
            await log(
              `Gap opportunity created: ${indication.name} (${gap.gapType}, ${gap.validationStatus}, score: ${score}/10)`,
              "success"
            );
          } else {
            await log(
              `Skipped ${indication.name}: ${decision.reason}`
            );
          }
        } catch (err) {
          await log(
            `Failed to analyze supply gap for ${indication.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
            "warning"
          );
        }
      }

      const summary = `Gap analysis complete — ${gapsCreated} gap opportunities created for ${args.therapeuticArea} across ${countries.length} GCC++ markets.`;
      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: gapsCreated,
        skippedDuplicates: indications.length - gapsCreated,
        summary,
      });

      return jobId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage: msg,
      });
      return jobId;
    }
  },
});

export const discoverMenaDemandSignals = action({
  args: {
    country: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"discoveryJobs">> => {
    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "demand_signals",
      therapeuticArea: args.therapeuticArea,
      targetCountries: args.country ? [args.country] : [...GCC_PLUS_COUNTRIES],
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
      const client = createResearchClient(process.env.OPENAI_API_KEY!);
      const scope =
        args.country ??
        "the GCC++ priority markets (Saudi Arabia, UAE, Kuwait, Qatar, Egypt, Algeria), with wider MENA context when relevant";
      const taFilter = args.therapeuticArea
        ? `Focus on ${args.therapeuticArea} only.`
        : `Cover all therapeutic areas but prioritize specialty and hospital medicines.`;

      await log(`Discovering pharmaceutical demand signals in ${scope}...`);

      const response = await createStructuredWebSearchResponse<DemandSignalsResult>(
        client,
        {
          instructions: `You are a MENA pharmaceutical procurement analyst. Find active demand signals — tenders, formulary gaps, shortages, and government procurement priorities — for specialty and branded medicines. ${KEMEDICA_CONTEXT}`,
          input: `Research active pharmaceutical procurement signals in ${scope}. ${taFilter}

Find evidence of demand from:
1. Active or recent government tenders (NUPCO Saudi Arabia, UAE Ministry of Health tenders, Qatar Supreme Committee of Delivery and Legacy, Egyptian Ministry of Health procurement, Jordan MOH formulary updates)
2. National essential medicines lists updated in the past 2 years showing new additions or gaps
3. WHO EMRO shortage reports or formulary gap analyses
4. National health strategy priorities that indicate upcoming procurement pipeline (Vision 2030 Saudi, UAE Health Strategy 2030, etc.)

Focus on branded/specialty medicines, NOT generics. For each signal identify: the country, signal type, drug or drug class needed, therapeutic area, evidence description, urgency (high/medium/low), and source URL.`,
          formatName: "demand_signals",
          schema: DEMAND_SIGNALS_SCHEMA,
          maxOutputTokens: 3000,
          searchContextSize: "high",
          maxToolCalls: 10,
        }
      );

      const signals = response.data.signals ?? [];
      await log(`Found ${signals.length} demand signals. Processing...`);

      // Fetch existing gap opportunities to check for matches
      let newGaps = 0;
      let updatedGaps = 0;

      // Group signals by therapeuticArea
      const byArea = new Map<string, typeof signals>();
      for (const signal of signals) {
        const ta = normalizeTherapeuticArea(signal.therapeuticArea);
        if (!byArea.has(ta)) byArea.set(ta, []);
        byArea.get(ta)!.push(signal);
      }

      for (const [ta, areaSignals] of byArea.entries()) {
        const tenderText = areaSignals
          .map(
            (s) =>
              `[${s.country}] ${s.signalType.replace("_", " ")} (${s.urgency} urgency): ${s.description}${s.sourceUrl ? ` — ${s.sourceUrl}` : ""}`
          )
          .join("\n");

        const countries = [...new Set(areaSignals.map((s) => s.country))];
        const highUrgency = areaSignals.filter((s) => s.urgency === "high");
        const gapScore = Math.min(
          10,
          3 + highUrgency.length * 2 + Math.min(areaSignals.length, 2)
        );
        const strongestSignal =
          areaSignals.find((s) => s.signalType === "shortage") ??
          areaSignals.find((s) => s.signalType === "formulary_gap") ??
          areaSignals.find((s) => s.signalType === "tender") ??
          areaSignals.find((s) => s.signalType === "procurement_list") ??
          areaSignals[0];
        const gapType: GapType =
          strongestSignal?.signalType === "shortage"
            ? "shortage_gap"
            : strongestSignal?.signalType === "formulary_gap"
              ? "formulary_gap"
              : "tender_pull";
        const evidenceItems = areaSignals
          .filter((s) => s.sourceUrl)
          .slice(0, 10)
          .map((s) => ({
            claim: s.description,
            title: `${s.country} ${s.signalType.replace("_", " ")}`,
            url: normalizeExternalUrl(s.sourceUrl)!,
            sourceKind:
              s.signalType === "tender" || s.signalType === "procurement_list"
                ? ("tender_portal" as const)
                : ("government_publication" as const),
            country: s.country,
            productOrClass: s.drugOrClass,
            confidence:
              s.signalType === "tender" || s.signalType === "shortage"
                ? ("confirmed" as const)
                : ("likely" as const),
          }))
          .filter((item) => Boolean(item.url));
        const validationStatus: GapValidationStatus =
          evidenceItems.length === 0
            ? "insufficient_evidence"
            : areaSignals.some((s) => s.signalType === "tender" || s.signalType === "shortage")
              ? "confirmed"
              : "likely";

        if (validationStatus === "insufficient_evidence") {
          await log(
            `Skipped demand-only signal for ${ta}: no source-backed shortage, formulary, or tender evidence was captured.`,
            "warning"
          );
          continue;
        }

        const sources = areaSignals
          .filter((s) => s.sourceUrl)
          .slice(0, 5)
          .map((s) => ({ title: `${s.country}: ${s.drugOrClass}`, url: s.sourceUrl! }));

        const previous = await ctx.runQuery(api.gapOpportunities.list, {
          therapeuticArea: ta,
          status: "active",
          limit: 100,
        });
        const createdId = await ctx.runMutation(api.gapOpportunities.create, {
          therapeuticArea: ta,
          indication: areaSignals[0]?.drugOrClass ?? ta,
          targetCountries: countries,
          gapScore,
          analysisLens: "demand_led",
          gapType,
          validationStatus,
          evidenceSummary: `${areaSignals.length} source-backed demand signal(s) indicate ${gapType.replace("_", " ")} conditions in ${countries.join(", ")}.`,
          verifiedRegisteredCount: 0,
          verifiedMissingCount: 0,
          demandEvidence: `${areaSignals.length} procurement signal(s) found in: ${countries.join(", ")}`,
          supplyGap:
            gapType === "shortage_gap"
              ? `Shortage-backed demand for: ${areaSignals.map((s) => s.drugOrClass).join(", ")}`
              : gapType === "formulary_gap"
                ? `Formulary gap signals for: ${areaSignals.map((s) => s.drugOrClass).join(", ")}`
                : `Tender pull for: ${areaSignals.map((s) => s.drugOrClass).join(", ")}`,
          competitorLandscape: "Not yet analyzed - run therapeutic area gap analysis for full picture",
          suggestedDrugClasses: [...new Set(areaSignals.map((s) => s.drugOrClass))].slice(0, 5),
          tenderSignals: tenderText,
          sources,
          evidenceItems,
        });
        const existed = previous.some((gap: { _id: Id<"gapOpportunities"> }) => gap._id === createdId);

        if (existed) {
          updatedGaps++;
          await log(`Updated existing gap opportunity from demand signal: ${ta}`, "success");
        } else {
          newGaps++;
          await log(
            `New gap opportunity from demand signal: ${ta} (score: ${gapScore}/10)`,
            "success"
          );
        }
      }

      const summary = `Demand signal discovery complete — ${signals.length} signals found, ${newGaps} new gap opportunities created, ${updatedGaps} existing gaps updated.`;
      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: newGaps,
        skippedDuplicates: updatedGaps,
        summary,
      });

      return jobId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage: msg,
      });
      return jobId;
    }
  },
});

function normalizeTherapeuticArea(area: string): string {
  const match = THERAPEUTIC_AREAS.find(
    (ta) => ta.toLowerCase() === area.toLowerCase()
  );
  return match ?? area;
}

async function runGapAnalysisFlowJob(
  ctx: ActionCtx,
  jobId: Id<"discoveryJobs">,
  args: {
    mode: "single_area" | "all_areas";
    therapeuticArea?: string;
    country?: string;
  }
): Promise<void> {
  const targetCountries = args.country ? [args.country] : [...GCC_PLUS_COUNTRIES];
  const areas =
    args.mode === "all_areas"
      ? [...THERAPEUTIC_AREAS]
      : [args.therapeuticArea].filter((value): value is string => Boolean(value));

  if (areas.length === 0) {
    throw new Error("A therapeutic area is required for single-area analysis.");
  }

  const log = async (
    message: string,
    level: "info" | "success" | "warning" | "error" = "info"
  ) => appendFlowLog(ctx, jobId, message, level);

  try {
    await log(
      `Starting ${args.mode === "all_areas" ? "all-area" : "single-area"} gap analysis flow for ${targetCountries.join(", ")}.`
    );

    let totalGapsCreated = 0;
    let totalSuppliersLinked = 0;
    let totalProductsLinked = 0;
    let totalPromoted = 0;
    let nonPromotableGaps = 0;

    for (const area of areas) {
      const areaStart = Date.now();
      await log(`Analyzing ${area}...`);

      await ctx.runAction(api.gapAnalysis.analyzeTherapeuticAreaGaps, {
        therapeuticArea: area,
        targetCountries,
      });

      const activeGaps = await ctx.runQuery(api.gapOpportunities.list, {
        therapeuticArea: area,
        status: "active",
      });
      const freshGaps = activeGaps
        .filter((gap: { createdAt: number; gapScore: number }) => gap.createdAt >= areaStart && gap.gapScore >= 5)
        .sort(
          (
            left: { gapScore: number },
            right: { gapScore: number }
          ) => right.gapScore - left.gapScore
        );

      totalGapsCreated += freshGaps.length;
      await log(
        `${area}: ${freshGaps.length} new gap opportunities created.`,
        freshGaps.length > 0 ? "success" : "warning"
      );

      for (const gap of freshGaps) {
        await log(`Finding suppliers for ${gap.indication}...`);

        const opportunitiesBefore = await ctx.runQuery(
          api.decisionOpportunities.listByGapOpportunity,
          {
            gapOpportunityId: gap._id,
          }
        );
        const linkedDrugCountBefore = gap.linkedDrugIds?.length ?? 0;

        const supplierJobId = await ctx.runMutation(api.discoveryJobs.create, {
          type: "companies",
          gapOpportunityId: gap._id,
        });
        await runFindCompaniesForGapJob(ctx, gap._id, supplierJobId);

        const refreshedGap = await ctx.runQuery(api.gapOpportunities.get, {
          id: gap._id,
        });
        const opportunitiesAfter = await ctx.runQuery(
          api.decisionOpportunities.listByGapOpportunity,
          {
            gapOpportunityId: gap._id,
          }
        );
        const linkedCompanyIds = refreshedGap?.linkedCompanyIds ?? [];
        totalSuppliersLinked += linkedCompanyIds.length;

        if (!refreshedGap || linkedCompanyIds.length === 0) {
          nonPromotableGaps += 1;
          await log(
            `${gap.indication}: no suppliers found, so no decision opportunities were promoted.`,
            "warning"
          );
          continue;
        }

        const productsLinkedDelta = Math.max(
          0,
          (refreshedGap.linkedDrugIds?.length ?? 0) - linkedDrugCountBefore
        );
        const promotedDelta = Math.max(
          0,
          opportunitiesAfter.length - opportunitiesBefore.length
        );

        totalProductsLinked += productsLinkedDelta;
        totalPromoted += promotedDelta;

        if (productsLinkedDelta === 0) {
          nonPromotableGaps += 1;
          await log(
            `${gap.indication}: suppliers were found but no relevant drugs were linked, so the gap is research-complete but not promotable yet.`,
            "warning"
          );
        } else if (promotedDelta === 0) {
          nonPromotableGaps += 1;
          await log(
            `${gap.indication}: products were linked, but identity or confidence remained too weak for new promoted opportunities.`,
            "warning"
          );
        } else {
          await log(
            `${gap.indication}: ${productsLinkedDelta} products linked and ${promotedDelta} decision opportunities promoted.`,
            "success"
          );
        }

        await log(
          `${gap.indication}: supplier discovery completed with ${linkedCompanyIds.length} linked suppliers.`,
          "success"
        );
      }
    }

    const summary = `Gap flow complete — ${totalGapsCreated} gaps created, ${totalSuppliersLinked} suppliers linked, ${totalProductsLinked} products linked, ${totalPromoted} decision opportunities promoted${nonPromotableGaps > 0 ? `, ${nonPromotableGaps} gaps still research-complete but not promotable` : ""}.`;

    await ctx.runMutation(api.discoveryJobs.complete, {
      id: jobId,
      newItemsFound: totalPromoted,
      skippedDuplicates: nonPromotableGaps,
      summary,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await ctx.runMutation(api.discoveryJobs.fail, {
      id: jobId,
      errorMessage: msg,
    });
  }
}

export const executeGapAnalysisFlow = internalAction({
  args: {
    jobId: v.id("discoveryJobs"),
    mode: v.union(v.literal("single_area"), v.literal("all_areas")),
    therapeuticArea: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await runGapAnalysisFlowJob(ctx, args.jobId, {
      mode: args.mode,
      therapeuticArea: args.therapeuticArea,
      country: args.country,
    });
  },
});

export const runGapAnalysisFlow = action({
  args: {
    mode: v.union(v.literal("single_area"), v.literal("all_areas")),
    therapeuticArea: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"discoveryJobs">> => {
    const targetCountries = args.country ? [args.country] : [...GCC_PLUS_COUNTRIES];
    const areas =
      args.mode === "all_areas"
        ? [...THERAPEUTIC_AREAS]
        : [args.therapeuticArea].filter((value): value is string => Boolean(value));

    if (areas.length === 0) {
      throw new Error("A therapeutic area is required for single-area analysis.");
    }

    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "gap_analysis_flow",
      therapeuticArea:
        args.mode === "all_areas" ? "ALL_THERAPEUTIC_AREAS" : areas[0],
      targetCountries,
    });

    await ctx.scheduler.runAfter(0, internal.gapAnalysis.executeGapAnalysisFlow, {
      jobId,
      mode: args.mode,
      therapeuticArea: args.therapeuticArea,
      country: args.country,
    });

    return jobId;
  },
});

export const analyzeCanonicalProductGaps = action({
  args: {
    canonicalProductIds: v.array(v.id("canonicalProducts")),
    targetCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const targetCountries =
      args.targetCountries && args.targetCountries.length > 0
        ? args.targetCountries
        : [...GCC_PLUS_COUNTRIES];
    const allOpportunities = await ctx.runQuery(api.opportunities.listAllForEngine, {});
    const gapIds: Id<"gapOpportunities">[] = [];
    let autoMatchedCompanies = 0;

    for (const canonicalProductId of args.canonicalProductIds) {
      const product = await ctx.runQuery(api.productIntelligence.getCanonicalProduct, {
        id: canonicalProductId,
      });
      if (!product) {
        continue;
      }

      const linkedDrugIds = new Set(product.linkedDrugs.map((drug) => drug._id));
      const linkedOpportunities = allOpportunities.filter((row) =>
        linkedDrugIds.has(row.drugId)
      );

      const hasFda = product.sources.some((source) =>
        ["drugs_fda", "openfda_label", "orange_book", "purple_book", "ndc"].includes(
          source.sourceSystem
        )
      );
      const hasEma = product.sources.some(
        (source) => source.sourceSystem === "ema_central"
      );
      if (!hasFda && !hasEma) {
        continue;
      }

      const currentYear = new Date().getUTCFullYear();
      const patentYears = product.linkedDrugs
        .map((drug) => drug.patentExpiryYear)
        .filter((value): value is number => typeof value === "number");
      const earliestPatentYear =
        patentYears.length > 0 ? Math.min(...patentYears) : undefined;
      const offPatent =
        earliestPatentYear !== undefined && earliestPatentYear < currentYear;
      const nearExpiry =
        earliestPatentYear !== undefined &&
        earliestPatentYear >= currentYear &&
        earliestPatentYear <= currentYear + 2;

      const countryStates = targetCountries.map((country) => {
        const normalizedCountry = normalizeGapCountry(country);
        const countryOpportunities = linkedOpportunities.filter(
          (opportunity) => normalizeGapCountry(opportunity.country) === normalizedCountry
        );
        const countryRegistrations = product.linkedDrugs.flatMap((drug) =>
          (drug.menaRegistrations ?? []).filter(
            (registration) =>
              normalizeGapCountry(registration.country) === normalizedCountry
          )
        );

        const matchedBrandNames = dedupeSimpleStrings(
          countryOpportunities.map((entry) => entry.matchedBrandName)
        );
        const matchedGenericNames = dedupeSimpleStrings(
          countryOpportunities.map((entry) => entry.matchedGenericName)
        );

        let state: MarketPresenceState = "unclear";
        if (
          countryOpportunities.some((entry) => entry.genericEquivalentDetected) ||
          matchedGenericNames.some(
            (name) => normalizeNameToken(name) === normalizeNameToken(product.inn)
          )
        ) {
          state = "generic_present";
        } else if (
          matchedBrandNames.some(
            (name) =>
              normalizeNameToken(name) &&
              normalizeNameToken(name) !== normalizeNameToken(product.brandName)
          )
        ) {
          state = "different_brand_present";
        } else if (
          countryOpportunities.some((entry) =>
            [
              "formally_registered",
              "tender_formulary_only",
              "shortage_listed",
              "hospital_import_only",
            ].includes(entry.availabilityStatus ?? "")
          ) ||
          countryRegistrations.some((registration) => registration.status === "registered")
        ) {
          state = "present";
        } else if (
          countryOpportunities.some(
            (entry) => entry.availabilityStatus === "not_found"
          ) ||
          countryRegistrations.some((registration) => registration.status === "not_found")
        ) {
          state = "absent";
        }

        const evidenceLinks = [
          ...countryOpportunities.flatMap((entry) =>
            (entry.evidenceItems ?? [])
              .filter((item) => item.url)
              .map((item) => ({
                title: item.title ?? `${country} market evidence`,
                url: normalizeExternalUrl(item.url),
                claim: item.claim,
                sourceKind:
                  item.sourceType === "official_registry"
                    ? ("official_registry" as const)
                    : item.sourceType === "tender_portal" ||
                        item.sourceType === "public_procurement"
                      ? ("tender_portal" as const)
                      : item.sourceType === "market_report"
                        ? ("market_report" as const)
                        : ("government_publication" as const),
                country,
                productOrClass: product.inn,
                confidence: item.confidence,
              }))
          ),
          ...countryRegistrations
            .filter((registration) => registration.url)
            .map((registration) => ({
              title: `${country} registration check`,
              url: normalizeExternalUrl(registration.url),
              claim: `${product.brandName} was marked ${registration.status.replaceAll("_", " ")} in ${country}.`,
              sourceKind: "official_registry" as const,
              country,
              productOrClass: product.inn,
              confidence:
                registration.status === "registered"
                  ? ("confirmed" as const)
                  : ("likely" as const),
            })),
        ].filter(
          (item): item is {
            title: string;
            url: string;
            claim: string;
            sourceKind:
              | "official_registry"
              | "government_publication"
              | "tender_portal"
              | "market_report";
            country: string;
            productOrClass: string;
            confidence: "confirmed" | "likely" | "inferred";
          } => Boolean(item.url)
        );

        return {
          country,
          state,
          matchedBrandNames,
          matchedGenericNames,
          evidenceLinks,
        };
      });

      const absentCountries = countryStates
        .filter((entry) => entry.state === "absent")
        .map((entry) => entry.country);
      const differentBrandCountries = countryStates.filter(
        (entry) => entry.state === "different_brand_present"
      );
      const genericCountries = countryStates.filter(
        (entry) => entry.state === "generic_present"
      );
      const targetMarketEvidence = uniqBy(
        countryStates.flatMap((entry) => entry.evidenceLinks),
        (item) => `${item.url}|${item.claim}|${item.country}`
      );
      const approvalEvidence: Array<{
        claim: string;
        title: string;
        url: string;
        sourceKind: "ema" | "official_registry";
        country: string;
        productOrClass: string;
        confidence: "confirmed" | "likely" | "inferred";
      }> = uniqBy(
        product.sources
          .filter((source) => source.sourceUrl)
          .map((source) => ({
            claim: `${product.brandName} is recorded in ${source.geography} via ${source.sourceSystem.replaceAll("_", " ")}${source.approvalDate ? ` with approval context dated ${source.approvalDate}` : ""}.`,
            title:
              source.brandName && source.brandName !== product.brandName
                ? `${source.brandName} regulatory record`
                : `${product.brandName} regulatory record`,
            url: normalizeExternalUrl(source.sourceUrl),
            sourceKind:
              source.sourceSystem === "ema_central"
                ? ("ema" as const)
                : ("official_registry" as const),
            country: source.geography,
            productOrClass: product.inn,
            confidence: source.confidence,
          }))
          .filter(
            (item): item is {
              claim: string;
              title: string;
              url: string;
              sourceKind: "ema" | "official_registry";
              country: string;
              productOrClass: string;
              confidence: "confirmed" | "likely" | "inferred";
            } => Boolean(item.url)
          ),
        (item) => `${item.url}|${item.country}`
      );

      const isBiologicOpportunity =
        product.productType === "biosimilar" ||
        (product.productType === "biologic" &&
          (Boolean(product.referenceProduct) || product.biosimilars.length > 0));
      const productGapKind = chooseProductGapKind({
        hasFda,
        hasEma,
        absentCount: absentCountries.length,
        differentBrandCount: differentBrandCountries.length,
        genericCount: genericCountries.length,
        offPatent,
        nearExpiry,
        productType: product.productType,
        hasReferenceProduct: Boolean(product.referenceProduct),
        hasBiosimilars: product.biosimilars.length > 0,
      });

      const evidenceStrongEnough =
        approvalEvidence.length > 0 && targetMarketEvidence.length > 0;
      const productSignalDetected =
        absentCountries.length > 0 ||
        differentBrandCountries.length > 0 ||
        genericCountries.length > 0 ||
        offPatent ||
        nearExpiry ||
        isBiologicOpportunity;

      if (!productSignalDetected || !evidenceStrongEnough) {
        continue;
      }

      const gapScore = scoreProductLedGap({
        hasFda,
        hasEma,
        absentCount: absentCountries.length,
        differentBrandCount: differentBrandCountries.length,
        genericCount: genericCountries.length,
        offPatent,
        nearExpiry,
        isBiologicOpportunity,
        hasStrongEvidence: evidenceStrongEnough,
      });

      if (gapScore < 5) {
        continue;
      }

      const approvalCoverage = summarizeApprovalCoverage(hasFda, hasEma);
      const competitorNames = dedupeSimpleStrings([
        ...differentBrandCountries.flatMap((entry) => entry.matchedBrandNames),
        ...genericCountries.flatMap((entry) => entry.matchedGenericNames),
        ...countryStates
          .filter((entry) => entry.state === "present")
          .flatMap((entry) => entry.matchedBrandNames),
      ]);
      const marketSummary = countryStates
        .map((entry) => {
          if (entry.state === "different_brand_present") {
            return `${entry.country}: present under ${entry.matchedBrandNames.join(", ")}`;
          }
          if (entry.state === "generic_present") {
            return `${entry.country}: generic / INN present`;
          }
          return `${entry.country}: ${entry.state.replace(/_/g, " ")}`;
        })
        .join("; ");

      const patentNote = offPatent
        ? `Patent timing looks favourable because linked internal records indicate the product is off-patent (${earliestPatentYear}).`
        : nearExpiry
          ? `Patent timing may open soon because linked internal records indicate expiry around ${earliestPatentYear}.`
          : "";
      const biologicNote =
        productGapKind === "biosimilar_opportunity"
          ? "This is classified as a biosimilar opportunity using canonical reference-product links."
          : productGapKind === "reference_biologic_opportunity"
            ? "This is classified as a biologic whitespace opportunity using canonical biosimilar/reference links."
            : "";

      const gapId = await ctx.runMutation(api.gapOpportunities.create, {
        therapeuticArea: product.therapeuticArea ?? product.atcCode ?? "Unclassified",
        indication: `${product.brandName} (${product.inn})`,
        targetCountries,
        gapScore,
        analysisLens: "product_led",
        canonicalProductId,
        gapType: getPrimaryProductGapType(productGapKind),
        productGapKind,
        validationStatus:
          absentCountries.length > 0 || differentBrandCountries.length > 0
            ? "confirmed"
            : "likely",
        evidenceSummary: `${approvalCoverage} approval evidence exists for ${product.brandName}. Target-market checks indicate ${marketSummary}.`,
        verifiedRegisteredCount: countryStates.filter((entry) => entry.state === "present").length,
        verifiedMissingCount: absentCountries.length,
        demandEvidence: `Product-led gap anchored to ${product.brandName} (${product.inn}). ${approvalCoverage} approval evidence exists, while current MENA checks indicate ${marketSummary}.`,
        supplyGap: absentCountries.length > 0
          ? `${product.brandName} appears absent in ${absentCountries.join(", ")} despite ${approvalCoverage} approval coverage. ${patentNote} ${biologicNote}`.trim()
          : `The product is not fully absent, but current checks show ${formatProductGapKind(productGapKind)} conditions across ${targetCountries.join(", ")}. ${patentNote} ${biologicNote}`.trim(),
        competitorLandscape:
          competitorNames.length > 0
            ? `Detected local equivalents or alternative naming: ${competitorNames.join("; ")}.`
            : "No clearly named local equivalent was captured in the current target-market evidence.",
        suggestedDrugClasses: dedupeSimpleStrings([
          product.inn,
          product.therapeuticArea,
          product.atcCode,
        ]),
        regulatoryFeasibility:
          hasFda && hasEma && product.productType !== "biologic"
            ? "high"
            : isBiologicOpportunity
              ? "medium"
              : "medium",
        sources: uniqBy(
          [...approvalEvidence, ...targetMarketEvidence].map((item) => ({
            title: item.title,
            url: item.url,
          })),
          (item) => item.url
        ).slice(0, 12),
        evidenceItems: [...approvalEvidence, ...targetMarketEvidence].slice(0, 20),
      });

      gapIds.push(gapId);

      for (const drug of product.linkedDrugs) {
        await ctx.runMutation(api.gapOpportunities.linkDrug, {
          id: gapId,
          drugId: drug._id,
        });
      }

      const candidateCompanies = uniqBy(
        [
          ...product.entities
            .filter((entity) => entity.companyId)
            .map((entity) => entity.companyId),
          ...product.linkedDrugs
            .map((drug) => drug.companyId)
            .filter((companyId): companyId is Id<"companies"> => Boolean(companyId)),
        ],
        (companyId) => companyId
      );

      for (const companyId of candidateCompanies) {
        await ctx.runMutation(api.gapOpportunities.linkCompany, {
          id: gapId,
          companyId,
        });
        await ctx.runMutation(api.gapCompanyMatches.upsert, {
          gapOpportunityId: gapId,
          companyId,
          distributorFitScore:
            productGapKind === "fda_ema_absent_mena" || productGapKind === "biosimilar_opportunity"
              ? 8.2
              : 7.2,
          rationale: `${product.brandName} is already linked to this company through the canonical product graph, which makes it a credible first partner to approach for ${targetCountries.join(", ")} whitespace.`,
          overlapSummary: `${product.brandName} / ${product.inn} is anchored to this company through manufacturer, MAH, applicant, or linked internal product data.`,
          overlappingDrugClasses: dedupeSimpleStrings([product.inn, product.atcCode]),
          targetCountries,
          estimatedEaseOfEntry: hasFda && hasEma ? "high" : "medium",
          competitiveWhitespace:
            absentCountries.length > 0
              ? `Current checks suggest absence in ${absentCountries.join(", ")}.`
              : marketSummary,
          recommendedFirstOutreachAngle: `Position KEMEDICA as the MENA market-entry partner for ${product.brandName}, starting with ${targetCountries.slice(0, 2).join(" and ")}.`,
          confidence: hasFda && hasEma ? "high" : "medium",
          evidenceLinks: uniqBy(
            [...approvalEvidence, ...targetMarketEvidence].map((item) => ({
              title: item.title,
              url: item.url,
            })),
            (item) => item.url
          ).slice(0, 6),
          priorityTier: gapScore >= 8 ? "tier_1" : gapScore >= 6 ? "tier_2" : "tier_3",
        });
        autoMatchedCompanies += 1;
      }
    }

    if (gapIds.length > 0) {
      await ctx.runAction(api.decisionOpportunities.rebuildFromResearch, {});
    }

    return {
      gapIds,
      created: gapIds.length,
      autoMatchedCompanies,
      targetCountries,
      summary:
        gapIds.length > 0
          ? `Created or refreshed ${gapIds.length} product-led gap${gapIds.length === 1 ? "" : "s"} across ${targetCountries.join(", ")}.`
          : "No source-backed product-led gap was created from the current product selection.",
    };
  },
});

export const analyzeSingleCanonicalProductGap = action({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    targetCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runAction(api.gapAnalysis.analyzeCanonicalProductGaps, {
      canonicalProductIds: [args.canonicalProductId],
      targetCountries: args.targetCountries,
    });
    return {
      ...result,
      gapId: result.gapIds[0],
    };
  },
});
