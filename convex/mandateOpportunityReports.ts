import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  buildMandateReportDraft,
  MandateCountry,
  MandateEvidenceInput,
  MandateReportDraft,
  SourceTier,
} from "./mandateOpportunityEngine";

const mandateScoreBreakdownValidator = v.object({
  unmetNeed: v.number(),
  marketEvidence: v.number(),
  competitiveGap: v.number(),
  commercialAttractiveness: v.number(),
  regulatoryFeasibility: v.number(),
  partnerability: v.number(),
});

const mandateCountryValidator = v.union(
  v.literal("Saudi Arabia"),
  v.literal("UAE"),
  v.literal("Egypt")
);

const opportunityTypeValidator = v.union(
  v.literal("NEW_MARKET_GAP"),
  v.literal("UNMET_CLINICAL_NEED"),
  v.literal("CURRENT_SHORTAGE"),
  v.literal("ANTICIPATED_SHORTAGE"),
  v.literal("SECOND_SOURCE"),
  v.literal("TENDER_DEMAND"),
  v.literal("REGULATORY_INCENTIVE"),
  v.literal("PIPELINE_OPPORTUNITY")
);

const discoveryDirectionValidator = v.union(
  v.literal("EU_TO_MIDDLE_EAST"),
  v.literal("MENA_TO_EU")
);

const sourceTierValidator = v.union(
  v.literal("Tier A"),
  v.literal("Tier B"),
  v.literal("Tier C"),
  v.literal("Tier D"),
  v.literal("Tier E")
);

const evidenceConfidenceValidator = v.union(
  v.literal("confirmed"),
  v.literal("likely"),
  v.literal("inferred")
);

const reportDraftValidator = v.object({
  product: v.object({
    inn: v.string(),
    brand: v.string(),
    indication: v.string(),
    strengthForm: v.string(),
    route: v.string(),
    mah: v.string(),
    manufacturer: v.string(),
    euRegulatoryStatus: v.string(),
  }),
  thesis: v.string(),
  opportunityTypes: v.array(opportunityTypeValidator),
  countryAssessments: v.array(
    v.object({
      country: mandateCountryValidator,
      registration: v.string(),
      availability: v.string(),
      shortage: v.string(),
      anticipatedShortage: v.string(),
      incentiveList: v.string(),
      alternatives: v.string(),
      competition: v.string(),
      demandEvidence: v.string(),
      procurementEvidence: v.string(),
      regulatoryPath: v.string(),
      commercialPotential: v.string(),
      existingRepresentation: v.optional(v.string()),
      unknowns: v.array(v.string()),
      absenceStatus: v.union(
        v.literal("VERIFIED_ABSENT"),
        v.literal("UNKNOWN"),
        v.literal("NOT_APPLICABLE")
      ),
    })
  ),
  manufacturerFit: v.object({
    company: v.string(),
    menaPresence: v.string(),
    existingPartners: v.string(),
    internationalLicensingEvidence: v.string(),
    relevantContact: v.string(),
    whyTheyMightWorkWithKemedica: v.string(),
  }),
  economics: v.object({
    estimatedAddressablePatients: v.string(),
    potentialUnits: v.string(),
    priceEvidence: v.string(),
    potentialRevenueRange: v.string(),
    expectedMarginRange: v.string(),
    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.literal("UNVALIDATED")
    ),
    missingInformation: v.array(v.string()),
  }),
  risks: v.array(v.string()),
  score: mandateScoreBreakdownValidator,
  totalScore: v.number(),
  decision: v.union(
    v.literal("PURSUE"),
    v.literal("VALIDATE"),
    v.literal("HOLD"),
    v.literal("REJECT")
  ),
  rejectionReason: v.optional(v.string()),
  nextAction: v.string(),
  validationNeeds: v.array(v.string()),
  discoveryDirections: v.array(discoveryDirectionValidator),
  evidence: v.array(
    v.object({
      claim: v.string(),
      title: v.string(),
      url: v.string(),
      sourceType: v.string(),
      sourceTier: sourceTierValidator,
      publicationDate: v.optional(v.string()),
      retrievalDate: v.string(),
      excerpt: v.string(),
      confidence: evidenceConfidenceValidator,
      country: v.optional(mandateCountryValidator),
    })
  ),
});

function compact(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function sourceTypeFromEvidenceType(value?: string) {
  switch (value) {
    case "regulatory":
      return "official_registry";
    case "market":
      return "market_signal";
    case "gap":
      return "market_gap";
    case "company":
      return "company";
    case "contact":
      return "company_contact";
    default:
      return value ?? "public_web";
  }
}

function evidenceSourceTier(args: { evidenceType?: string; sourceCategory?: string; sourceType?: string }): SourceTier {
  if (
    args.evidenceType === "regulatory" ||
    args.evidenceType === "market" ||
    args.evidenceType === "gap" ||
    args.sourceCategory === "official" ||
    ["official_registry", "shortage_list", "tender_portal", "public_procurement"].includes(
      args.sourceType ?? ""
    )
  ) {
    return "Tier A";
  }
  if (args.evidenceType === "company" || args.evidenceType === "contact") return "Tier B";
  return "Tier C";
}

function mapOpportunityEvidence(
  evidence: Array<Doc<"opportunityEvidence">>
): MandateEvidenceInput[] {
  return evidence.map((item) => ({
    claim: item.claim,
    title: item.title,
    url: item.url,
    evidenceType: item.evidenceType,
    sourceType: sourceTypeFromEvidenceType(item.evidenceType),
    sourceTier: evidenceSourceTier({ evidenceType: item.evidenceType }),
    excerpt: item.claim,
    confidence: item.confidence,
  }));
}

function mapMarketEvidence(
  rows: Array<Doc<"opportunities">>
): MandateEvidenceInput[] {
  return rows.flatMap((row) =>
    (row.evidenceItems ?? []).map((item) => ({
      claim: item.claim,
      title: item.title,
      url: item.url,
      sourceType: item.sourceType,
      sourceTier: evidenceSourceTier({
        sourceCategory: item.sourceCategory,
        sourceType: item.sourceType,
      }),
      country: row.country,
      excerpt: item.notes ?? item.claim,
      confidence: item.confidence,
    }))
  );
}

function buildInput(args: {
  opportunity: Doc<"decisionOpportunities"> & {
    drug: Doc<"drugs"> | null;
    company: Doc<"companies"> | null;
    gap: Doc<"gapOpportunities"> | null;
    evidence: Array<Doc<"opportunityEvidence">>;
  };
  marketRows: Array<Doc<"opportunities">>;
}) {
  const { opportunity, marketRows } = args;
  const drug = opportunity.drug;
  const company = opportunity.company;
  const productProfile = drug?.productProfile;
  const evidence = [
    ...mapOpportunityEvidence(opportunity.evidence),
    ...mapMarketEvidence(marketRows),
  ];

  return {
    productName: opportunity.productName,
    genericName: opportunity.genericName,
    indication: drug?.indication ?? opportunity.gap?.indication,
    strength: productProfile?.strength,
    dosageForm: productProfile?.dosageForm,
    route: productProfile?.route,
    therapeuticArea: opportunity.therapeuticArea,
    manufacturerName:
      compact(opportunity.manufacturerName) ??
      compact(drug?.primaryManufacturerName) ??
      compact(drug?.manufacturerName),
    marketAuthorizationHolderName:
      compact(opportunity.marketAuthorizationHolderName) ??
      compact(drug?.primaryMarketAuthorizationHolderName),
    approvalStatus: drug?.approvalStatus,
    euRegulatoryStatus:
      drug?.approvalStatus === "approved"
        ? "EMA/FDA approved or imported product identity approved in the product registry"
        : drug?.approvalStatus === "pending"
          ? "Under approval or pending in the product registry"
          : drug?.approvalStatus,
    productIdentityStatus: opportunity.productIdentityStatus,
    focusMarkets: opportunity.focusMarkets,
    gapType: opportunity.gapType,
    gapSummary: opportunity.gapSummary,
    demandProxy: opportunity.demandProxy,
    commercialRationale: opportunity.commercialRationale,
    marketSizeEstimate: opportunity.marketSizeEstimate,
    competitivePressure: opportunity.competitivePressure,
    regulatoryFeasibility: opportunity.regulatoryFeasibility,
    contactName: opportunity.contactName,
    contactTitle: opportunity.contactTitle,
    contactEmail: opportunity.contactEmail,
    contactLinkedinUrl: opportunity.contactLinkedinUrl,
    contactConfidence: opportunity.contactConfidence,
    companyName: company?.name ?? opportunity.approachEntityName,
    companySize: company?.companySize,
    menaPresence: company?.menaPresence,
    partnerabilitySignals: company?.partnerabilitySignals,
    existingMenaPartners: company?.existingMenaPartners,
    opportunityRows: marketRows.map((row) => ({
      country: row.country,
      availabilityStatus: row.availabilityStatus,
      regulatoryStatus: row.regulatoryStatus,
      competitorPresence: row.competitorPresence,
      competitionIntensity: row.competitionIntensity,
      tenderOpportunity: row.tenderOpportunity,
      tenderSignalStrength: row.tenderSignalStrength,
      annualOpportunityRange: row.annualOpportunityRange,
      commercialOpportunityScore: row.commercialOpportunityScore,
      marketSizeEstimate: row.marketSizeEstimate,
      addressablePopulation: row.addressablePopulation,
      evidenceItems: (row.evidenceItems ?? []).map((item) => ({
        claim: item.claim,
        title: item.title,
        url: item.url,
        sourceType: item.sourceType,
        sourceTier: evidenceSourceTier({
          sourceCategory: item.sourceCategory,
          sourceType: item.sourceType,
        }),
        country: row.country,
        excerpt: item.notes ?? item.claim,
        confidence: item.confidence,
      })),
    })),
    evidence,
  };
}

export const getByDecisionOpportunity = query({
  args: { decisionOpportunityId: v.id("decisionOpportunities") },
  handler: async (ctx, { decisionOpportunityId }) => {
    const report = await ctx.db
      .query("mandateOpportunityReports")
      .withIndex("by_decision_opportunity", (q) =>
        q.eq("decisionOpportunityId", decisionOpportunityId)
      )
      .unique();
    if (!report) return null;

    const [countries, evidence] = await Promise.all([
      ctx.db
        .query("mandateCountryAssessments")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .collect(),
      ctx.db
        .query("mandateEvidenceClaims")
        .withIndex("by_report", (q) => q.eq("reportId", report._id))
        .collect(),
    ]);

    const countryOrder = new Map<MandateCountry, number>([
      ["Saudi Arabia", 0],
      ["Egypt", 1],
      ["UAE", 2],
    ]);

    return {
      report,
      countries: countries.sort(
        (left, right) => (countryOrder.get(left.country) ?? 99) - (countryOrder.get(right.country) ?? 99)
      ),
      evidence: evidence.sort((left, right) => left.sourceTier.localeCompare(right.sourceTier)),
    };
  },
});

export const replaceFromDraft = mutation({
  args: {
    decisionOpportunityId: v.id("decisionOpportunities"),
    draft: reportDraftValidator,
  },
  handler: async (ctx, { decisionOpportunityId, draft }) => {
    const opportunity = await ctx.db.get(decisionOpportunityId);
    if (!opportunity) {
      throw new Error("Decision opportunity not found.");
    }

    const existing = await ctx.db
      .query("mandateOpportunityReports")
      .withIndex("by_decision_opportunity", (q) =>
        q.eq("decisionOpportunityId", decisionOpportunityId)
      )
      .unique();
    const now = Date.now();
    const reportFields = {
      decisionOpportunityId,
      drugId: opportunity.drugId,
      companyId: opportunity.companyId,
      gapOpportunityId: opportunity.gapOpportunityId,
      status: draft.decision === "PURSUE" ? ("ready" as const) : ("needs_validation" as const),
      discoveryDirections: draft.discoveryDirections,
      inn: draft.product.inn,
      brand: draft.product.brand,
      indication: draft.product.indication,
      strengthForm: draft.product.strengthForm,
      route: draft.product.route,
      mah: draft.product.mah,
      manufacturer: draft.product.manufacturer,
      euRegulatoryStatus: draft.product.euRegulatoryStatus,
      thesis: draft.thesis,
      opportunityTypes: draft.opportunityTypes,
      manufacturerFitCompany: draft.manufacturerFit.company,
      manufacturerFitMenaPresence: draft.manufacturerFit.menaPresence,
      manufacturerFitExistingPartners: draft.manufacturerFit.existingPartners,
      manufacturerFitLicensingEvidence: draft.manufacturerFit.internationalLicensingEvidence,
      manufacturerFitRelevantContact: draft.manufacturerFit.relevantContact,
      manufacturerFitRationale: draft.manufacturerFit.whyTheyMightWorkWithKemedica,
      estimatedAddressablePatients: draft.economics.estimatedAddressablePatients,
      potentialUnits: draft.economics.potentialUnits,
      priceEvidence: draft.economics.priceEvidence,
      potentialRevenueRange: draft.economics.potentialRevenueRange,
      expectedMarginRange: draft.economics.expectedMarginRange,
      economicsConfidence: draft.economics.confidence,
      missingEconomicInformation: draft.economics.missingInformation,
      risks: draft.risks,
      scoreBreakdown: draft.score,
      totalScore: draft.totalScore,
      decision: draft.decision,
      rejectionReason: draft.rejectionReason,
      validationNeeds: draft.validationNeeds,
      nextAction: draft.nextAction,
      generatedAt: now,
      updatedAt: now,
    };

    const reportId = existing
      ? existing._id
      : await ctx.db.insert("mandateOpportunityReports", {
          ...reportFields,
          createdAt: now,
        });
    if (existing) {
      await ctx.db.patch(reportId, reportFields);
    }

    const existingCountries = await ctx.db
      .query("mandateCountryAssessments")
      .withIndex("by_report", (q) => q.eq("reportId", reportId))
      .collect();
    for (const row of existingCountries) {
      await ctx.db.delete(row._id);
    }

    const existingEvidence = await ctx.db
      .query("mandateEvidenceClaims")
      .withIndex("by_report", (q) => q.eq("reportId", reportId))
      .collect();
    for (const row of existingEvidence) {
      await ctx.db.delete(row._id);
    }

    for (const row of draft.countryAssessments) {
      await ctx.db.insert("mandateCountryAssessments", {
        reportId,
        decisionOpportunityId,
        ...row,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const row of draft.evidence) {
      await ctx.db.insert("mandateEvidenceClaims", {
        reportId,
        decisionOpportunityId,
        ...row,
        createdAt: now,
        updatedAt: now,
      });
    }

    return reportId;
  },
});

export const generateForDecisionOpportunity = action({
  args: { decisionOpportunityId: v.id("decisionOpportunities") },
  handler: async (ctx, { decisionOpportunityId }): Promise<{ reportId: Id<"mandateOpportunityReports"> }> => {
    const opportunity = await ctx.runQuery(api.decisionOpportunities.get, {
      id: decisionOpportunityId,
    });
    if (!opportunity) {
      throw new Error("Decision opportunity not found.");
    }
    const marketRows = await ctx.runQuery(api.opportunities.listByDrug, {
      drugId: opportunity.drugId,
    });
    const draft: MandateReportDraft = buildMandateReportDraft(
      buildInput({ opportunity, marketRows })
    );
    const reportId: Id<"mandateOpportunityReports"> = await ctx.runMutation(
      api.mandateOpportunityReports.replaceFromDraft,
      {
        decisionOpportunityId,
        draft,
      }
    );
    return { reportId };
  },
});
