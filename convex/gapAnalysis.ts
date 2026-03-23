"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  createResearchClient,
  createStructuredWebSearchResponse,
} from "./openaiResearch";
import { KEMEDICA_CONTEXT } from "../src/lib/brand";
import { MENA_COUNTRIES, THERAPEUTIC_AREAS } from "./constants";
import { appendFlowLog, runCompanyDrugLinkAndRebuild } from "./gapFlow";

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
    "gapSummary",
    "gapScore",
    "suggestedDrugClasses",
    "regulatoryFeasibility",
  ],
} as const;

interface SupplyGapResult {
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

// ─── Actions ─────────────────────────────────────────────────────────────────

export const analyzeTherapeuticAreaGaps = action({
  args: {
    therapeuticArea: v.string(),
    targetCountries: v.optional(v.array(v.string())),
    indication: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"discoveryJobs">> => {
    const countries = args.targetCountries ?? [...MENA_COUNTRIES];

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
              instructions: `You are a pharmaceutical market access analyst. Identify gaps between European drug supply and MENA market needs. ${KEMEDICA_CONTEXT}`,
              input: `For the indication "${indication.name}" (${args.therapeuticArea}) in ${countries.join(", ")}:

1. Which drugs are currently registered and marketed in these MENA countries for this indication? (check SFDA, UAE MOH/MOHAP, MOHP Egypt, Jordan FDA, and other official MENA registries)
2. Which EMA-approved drugs for the same indication are NOT registered in any of these MENA countries? (search EMA public database and compare)
3. Any active public tenders or procurement events in the past 24 months for drugs in this category in these countries? (NUPCO Saudi Arabia, UAE government tenders, etc.)

Return a gapScore 0-10 where 10 = large unmet demand + many EU drugs available but none registered + active tenders.
suggestedDrugClasses should list EU drug classes that could fill the gap.`,
              formatName: "gap_supply",
              schema: GAP_SUPPLY_SCHEMA,
              maxOutputTokens: 2500,
              searchContextSize: "medium",
              maxToolCalls: 6,
            }
          );

          const gap = supplyResponse.data;
          const score = Math.min(10, Math.max(0, gap.gapScore));

          if (score >= 5) {
            const competitorList = gap.registeredDrugs
              .slice(0, 5)
              .map((d: { brandName: string; originator: string }) => `${d.brandName} (${d.originator})`)
              .join("; ");

            const unregisteredList = gap.unregisteredEuDrugs
              .slice(0, 5)
              .map((d: { brandName: string; inn: string; originator: string }) => `${d.brandName}/${d.inn} (${d.originator})`)
              .join("; ");

            const tenderText =
              gap.tenderSignals.length > 0
                ? gap.tenderSignals
                    .map(
                      (t) =>
                        `${t.country} (${t.year ?? "recent"}): ${t.description}`
                    )
                    .join("\n")
                : undefined;

            const sources = gap.tenderSignals
              .filter((t) => t.sourceUrl)
              .map((t) => ({ title: `${t.country} tender signal`, url: t.sourceUrl! }))
              .concat(
                indication.whoSourceUrl
                  ? [{ title: "WHO/GBD disease burden", url: indication.whoSourceUrl }]
                  : []
              );

            await ctx.runMutation(api.gapOpportunities.create, {
              therapeuticArea: args.therapeuticArea,
              indication: indication.name,
              targetCountries: countries,
              gapScore: score,
              demandEvidence: `${indication.burden}\n\nGovernment priority: ${indication.govPriority}`,
              supplyGap: `EU drugs not in MENA: ${unregisteredList || "None identified yet"}`,
              competitorLandscape: competitorList || "No competitors identified",
              suggestedDrugClasses: gap.suggestedDrugClasses,
              tenderSignals: tenderText,
              whoDiseaseBurden: indication.burden,
              regulatoryFeasibility: gap.regulatoryFeasibility,
              sources: sources.slice(0, 10),
            });

            gapsCreated++;
            await log(
              `Gap opportunity created: ${indication.name} (score: ${score}/10)`,
              "success"
            );
          } else {
            await log(
              `Low gap score for ${indication.name} (${score}/10), skipping`
            );
          }
        } catch (err) {
          await log(
            `Failed to analyze supply gap for ${indication.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
            "warning"
          );
        }
      }

      const summary = `Gap analysis complete — ${gapsCreated} gap opportunities created for ${args.therapeuticArea} in ${countries.length} MENA countries.`;
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
      targetCountries: args.country ? [args.country] : [...MENA_COUNTRIES],
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
      const scope = args.country ?? "the MENA region (Saudi Arabia, UAE, Qatar, Kuwait, Egypt, Jordan, Lebanon, Iraq, Morocco, Tunisia, Libya, Algeria, Bahrain, Oman, Syria)";
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
          demandEvidence: `${areaSignals.length} procurement signal(s) found in: ${countries.join(", ")}`,
          supplyGap: `Active demand for: ${areaSignals.map((s) => s.drugOrClass).join(", ")}`,
          competitorLandscape: "Not yet analyzed - run therapeutic area gap analysis for full picture",
          suggestedDrugClasses: [...new Set(areaSignals.map((s) => s.drugOrClass))].slice(0, 5),
          tenderSignals: tenderText,
          sources,
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

export const runGapAnalysisFlow = action({
  args: {
    mode: v.union(v.literal("single_area"), v.literal("all_areas")),
    therapeuticArea: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Id<"discoveryJobs">> => {
    const targetCountries = args.country ? [args.country] : [...MENA_COUNTRIES];
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
          await ctx.runAction(api.discovery.findCompaniesForGap, {
            gapOpportunityId: gap._id,
          });

          const refreshedGap = await ctx.runQuery(api.gapOpportunities.get, {
            id: gap._id,
          });
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

          const promotionResult = await runCompanyDrugLinkAndRebuild({
            ctx,
            gap: refreshedGap,
            companyIds: linkedCompanyIds,
            log,
          });

          totalProductsLinked += promotionResult.productsLinked;
          totalPromoted += promotionResult.promotedDelta;

          if (promotionResult.productsLinked === 0) {
            nonPromotableGaps += 1;
            await log(
              `${gap.indication}: suppliers were found but no relevant drugs were linked, so the gap is research-complete but not promotable yet.`,
              "warning"
            );
          } else if (promotionResult.promotedDelta === 0) {
            nonPromotableGaps += 1;
            await log(
              `${gap.indication}: products were linked, but identity or confidence remained too weak for new promoted opportunities.`,
              "warning"
            );
          } else {
            await log(
              `${gap.indication}: ${promotionResult.productsLinked} products linked and ${promotionResult.promotedDelta} decision opportunities promoted.`,
              "success"
            );
          }
        }
      }

      const summary = `Gap flow complete — ${totalGapsCreated} gaps created, ${totalSuppliersLinked} suppliers linked, ${totalProductsLinked} products linked, ${totalPromoted} decision opportunities promoted${nonPromotableGaps > 0 ? `, ${nonPromotableGaps} gaps still research-complete but not promotable` : ""}.`;

      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: totalPromoted,
        skippedDuplicates: nonPromotableGaps,
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
