import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { companyFitInput, studyInput } from "./commercialAssessmentValidators";
import {
  calculateCompanyFit,
  calculateForecast,
  POLICY_VERSION,
} from "./opportunityAssessmentPolicy";
import { requireMember } from "./authz";
import { buildCommercialOutput } from "./commercialOutputPolicy";
import { normalizeEvidenceText } from "./evidenceEngineV11Policy";

const country = v.union(
  v.literal("UAE"),
  v.literal("Saudi Arabia"),
  v.literal("Egypt"),
);
export const get = query({
  args: { opportunityId: v.id("decisionOpportunities"), country },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const study = await ctx.db
      .query("commercialStudies")
      .withIndex("by_opportunity_and_country", (q) =>
        q.eq("opportunityId", args.opportunityId).eq("country", args.country),
      )
      .unique();
    const fit = await ctx.db
      .query("opportunityCompanyFits")
      .withIndex("by_opportunity", (q) =>
        q.eq("opportunityId", args.opportunityId),
      )
      .unique();
    const opportunity = await ctx.db.get(args.opportunityId);
    const prices = opportunity
      ? await ctx.db
          .query("priceEvidence")
          .withIndex("by_drug", (q) => q.eq("drugId", opportunity.drugId))
          .take(100)
      : [];
    const sales =
      opportunity && args.country === "Egypt"
        ? await ctx.db
            .query("egyptSalesRows")
            .withIndex("by_normalized_molecule", (q) =>
              q.eq(
                "normalizedMolecule",
                normalizeEvidenceText(opportunity.genericName),
              ),
            )
            .take(50)
        : [];
    const imports =
      args.country === "UAE"
        ? (
            await Promise.all(
              [
                "mohap_uae_complete_product_list",
                "uae_official_directory",
                "uae_supplementary_directory",
              ].map((type) =>
                ctx.db
                  .query("registrationImports")
                  .withIndex("by_source_type_and_created_at", (q) =>
                    q.eq("sourceType", type),
                  )
                  .order("desc")
                  .take(1),
              ),
            )
          ).flat()
        : [];
    const registryRows = opportunity?.normalizedPresentationKey
      ? await Promise.all(
          imports.map(async (imported) => ({
            fileName: imported.fileName,
            coverage: imported.coverageHealth,
            rows: await ctx.db
              .query("registrationImportRows")
              .withIndex("by_import_and_normalized_presentation_key", (q) =>
                q
                  .eq("importId", imported._id)
                  .eq(
                    "normalizedPresentationKey",
                    opportunity.normalizedPresentationKey!,
                  ),
              )
              .take(50),
          })),
        )
      : [];
    return {
      study,
      fit,
      prices,
      sales,
      registryRows,
      fitResult: fit ? calculateCompanyFit(fit.input) : null,
      output: study ? buildCommercialOutput(study.input) : null,
    };
  },
});
export const saveFit = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    input: companyFitInput,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");
    if (
      args.input.staffCount !== undefined &&
      (!Number.isInteger(args.input.staffCount) || args.input.staffCount < 0)
    )
      throw new Error("Staff count must be a non-negative integer");
    const result = calculateCompanyFit(args.input);
    const existing = await ctx.db
      .query("opportunityCompanyFits")
      .withIndex("by_opportunity", (q) =>
        q.eq("opportunityId", args.opportunityId),
      )
      .unique();
    const record = { ...args, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, record);
    else await ctx.db.insert("opportunityCompanyFits", record);
    await ctx.db.patch(args.opportunityId, {
      companyFitScore: result.score,
      deprioritizationReasons: [
        ...(result.companySize === "LARGE"
          ? ["Large international pharma"]
          : []),
        ...(["DISTRIBUTOR_ONLY", "EXCLUSIVE_AGENT", "OWN_AFFILIATE"].includes(
          result.channelStatus,
        )
          ? [`Established regional relationship: ${result.channelStatus}`]
          : []),
      ],
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const saveStudy = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    country,
    input: studyInput,
  },
  returns: v.id("commercialStudies"),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin", "analyst"]);
    if (!(await ctx.db.get(args.opportunityId)))
      throw new Error("Opportunity not found");
    if (
      !Number.isInteger(args.input.startYear) ||
      args.input.startYear < 2000 ||
      args.input.startYear > 2100
    )
      throw new Error("Choose a valid forecast start year");
    if (!args.input.unitBasis.trim() || !args.input.assumptionEvidence.trim())
      throw new Error(
        "Record the unit basis and sources or reviewed assumptions for every material driver",
      );
    if (
      args.input.scenarios.length !== 3 ||
      new Set(args.input.scenarios.map((s) => s.name)).size !== 3
    )
      throw new Error("Provide downside, base, and upside scenarios");
    args.input.scenarios.forEach(calculateForecast);
    const output = buildCommercialOutput(args.input);
    const existing = await ctx.db
      .query("commercialStudies")
      .withIndex("by_opportunity_and_country", (q) =>
        q.eq("opportunityId", args.opportunityId).eq("country", args.country),
      )
      .unique();
    const record = {
      ...args,
      version: POLICY_VERSION,
      reviewedAt: undefined,
      updatedAt: Date.now(),
    };
    const id = existing
      ? existing._id
      : await ctx.db.insert("commercialStudies", record);
    if (existing) await ctx.db.patch(id, record);
    const assessment = await ctx.db
      .query("opportunityMarketAssessments")
      .withIndex("by_opportunity_and_country", (q) =>
        q
          .eq("decisionOpportunityId", args.opportunityId)
          .eq("country", args.country),
      )
      .unique();
    if (assessment)
      await ctx.db.patch(assessment._id, {
        commercialApprovalStatus: "provisional",
        commercialApprovedAt: undefined,
        commercialApprovedByMemberId: undefined,
        economicsStatus: "conservative_range",
        economicsSummary: output.summary,
        gateSnapshot: assessment.gateSnapshot
          ? {
              ...assessment.gateSnapshot,
              g6LifetimeEconomics: "PROVISIONAL",
              evaluatedAt: Date.now(),
            }
          : undefined,
        updatedAt: Date.now(),
      });
    // An edit invalidates approval; it cannot improve the approved ranking yet.
    await ctx.db.patch(args.opportunityId, {
      forecastBaseCashUsd: undefined,
      updatedAt: Date.now(),
    });
    return id;
  },
});
