import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./authz";
import {
  EVIDENCE_ENGINE_VERSION,
  canonicalPursuitKey as buildCanonicalPursuitKey,
  evaluateEvidenceGates,
  isReferenceMarketCandidate,
  targetConfidence,
  whiteSpaceFinding,
  whiteSpaceStatement,
  type TargetCountry,
} from "./evidenceEngineV11Policy";

const targetCountry = v.union(
  v.literal("Saudi Arabia"),
  v.literal("UAE"),
  v.literal("Egypt"),
);
const TARGETS: Array<{
  country: TargetCountry;
  sourceType: string;
  registry: string;
  freshnessMs: number;
}> = [
  {
    country: "Saudi Arabia",
    sourceType: "sfda_registered_drugs",
    registry: "sfda_registered_drugs",
    freshnessMs: 8 * 86_400_000,
  },
  {
    country: "UAE",
    sourceType: "uae_official_directory",
    registry: "uae_ede_directory",
    freshnessMs: 31 * 86_400_000,
  },
  {
    country: "Egypt",
    sourceType: "egypt_eda_authorized_export",
    registry: "egypt_eda_authorized_export",
    freshnessMs: 31 * 86_400_000,
  },
];
const REFERENCE_SOURCE_TYPES = new Set([
  "drugs_fda",
  "ema_medicine_downloads",
  "mhra_products",
]);

async function latestAcceptedImport(
  ctx: QueryCtx | MutationCtx,
  sourceType: string,
) {
  return (
    await ctx.db
      .query("registrationImports")
      .withIndex("by_source_type_and_created_at", (q) =>
        q.eq("sourceType", sourceType),
      )
      .order("desc")
      .take(20)
  ).find((item) => item.coverageHealth === "accepted" && item.sourceFetchId);
}

async function matchCount(
  ctx: QueryCtx | MutationCtx,
  importId: Id<"registrationImports">,
  key: string,
) {
  return (
    await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import_and_normalized_presentation_key", (q) =>
        q.eq("importId", importId).eq("normalizedPresentationKey", key),
      )
      .take(3)
  ).length;
}

export const sourceCoverage = query({
  args: {},
  returns: v.array(
    v.object({
      country: targetCountry,
      status: v.union(
        v.literal("accepted"),
        v.literal("needs_review"),
        v.literal("missing"),
        v.literal("stale"),
      ),
      confidence: v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      rowCount: v.optional(v.number()),
      fetchedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      sourceRegistry: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireMember(ctx);
    const now = Date.now();
    return await Promise.all(
      TARGETS.map(async (target) => {
        const imported = await latestAcceptedImport(ctx, target.sourceType);
        const fetch = imported?.sourceFetchId
          ? await ctx.db.get(imported.sourceFetchId)
          : null;
        const expiresAt = fetch
          ? fetch.fetchedAt + target.freshnessMs
          : undefined;
        return {
          country: target.country,
          status: !fetch
            ? ("missing" as const)
            : fetch.coverageHealth !== "accepted"
              ? ("needs_review" as const)
              : expiresAt! <= now
                ? ("stale" as const)
                : ("accepted" as const),
          confidence: targetConfidence(target.country),
          rowCount: fetch?.rowCount,
          fetchedAt: fetch?.fetchedAt,
          expiresAt,
          sourceRegistry: target.registry,
        };
      }),
    );
  },
});

export const inspectWhiteSpace = query({
  args: { normalizedPresentationKey: v.string() },
  returns: v.array(
    v.object({
      country: targetCountry,
      status: v.union(
        v.literal("matches_found"),
        v.literal("no_match_in_snapshot"),
        v.literal("not_checked"),
        v.literal("source_unhealthy"),
      ),
      confidence: v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
      matchCount: v.number(),
      statement: v.string(),
      sourceFetchId: v.optional(v.id("sourceFetches")),
      snapshotDate: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const now = Date.now();
    return await Promise.all(
      TARGETS.map(async (target) => {
        const imported = await latestAcceptedImport(ctx, target.sourceType);
        const fetch = imported?.sourceFetchId
          ? await ctx.db.get(imported.sourceFetchId)
          : null;
        const expiresAt = fetch
          ? fetch.fetchedAt + target.freshnessMs
          : undefined;
        const sourceHealthy = Boolean(
          fetch &&
          fetch.coverageHealth === "accepted" &&
          fetch.structureStatus === "passed" &&
          expiresAt! > now,
        );
        const matches =
          imported && sourceHealthy
            ? await matchCount(
                ctx,
                imported._id,
                args.normalizedPresentationKey,
              )
            : 0;
        const status = imported
          ? whiteSpaceFinding(matches, sourceHealthy)
          : ("not_checked" as const);
        return {
          country: target.country,
          status,
          confidence: targetConfidence(target.country),
          matchCount: matches,
          statement: whiteSpaceStatement({
            country: target.country,
            status,
            snapshotDate: fetch?.fetchedAt,
          }),
          sourceFetchId: fetch?._id,
          snapshotDate: fetch?.fetchedAt,
          expiresAt,
        };
      }),
    );
  },
});

/**
 * PARKED is a reviewed, temporary outcome. A newer accepted target snapshot
 * invalidates the old evidence boundary and moves the case back to Review;
 * it never promotes the case to Contact Ready.
 */
export const reopenChangedParkedInternal = internalMutation({
  args: {},
  returns: v.object({ reopened: v.number() }),
  handler: async (ctx) => {
    const parked = await ctx.db
      .query("opportunityMarketAssessments")
      .withIndex("by_company_reason_and_stage", (q) =>
        q.eq("companyReasonCode", "PARKED").eq("stage", "watching"),
      )
      .take(100);
    let reopened = 0;

    for (const assessment of parked) {
      if (assessment.evidenceEngineVersion !== EVIDENCE_ENGINE_VERSION)
        continue;
      const target = TARGETS.find(
        (candidate) => candidate.country === assessment.country,
      );
      if (!target) continue;
      const latest = await latestAcceptedImport(ctx, target.sourceType);
      if (!latest?.sourceFetchId) continue;
      if (latest.sourceFetchId === assessment.sourceSnapshotId) continue;

      const now = Date.now();
      const blockers = Array.from(
        new Set([
          ...assessment.blockers,
          "New registry evidence since PARKED review; re-verification required.",
        ]),
      );
      await ctx.db.patch(assessment._id, {
        stage: "needs_evidence",
        criticalReviewOpen: true,
        blockers,
        updatedAt: now,
      });
      const opportunity = await ctx.db.get(assessment.decisionOpportunityId);
      if (opportunity && opportunity.funnelStage === "watching") {
        await ctx.db.patch(opportunity._id, {
          funnelStage: "needs_evidence",
          updatedAt: now,
        });
      }
      reopened += 1;
    }
    return { reopened };
  },
});

export const quarantineLegacyBatch = mutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    quarantined: v.number(),
    remainingInSample: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const limit = Math.max(1, Math.min(args.limit ?? 100, 200));
    const sample = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_priority_score")
      .order("desc")
      .take(limit * 3);
    const legacy = sample
      .filter(
        (item) =>
          item.evidenceEngineVersion !== EVIDENCE_ENGINE_VERSION &&
          !item.legacyQuarantinedAt,
      )
      .slice(0, limit);
    const now = Date.now();
    for (const opportunity of legacy) {
      await ctx.db.patch(opportunity._id, {
        legacyQuarantinedAt: now,
        legacyQuarantineReason:
          "Pre-v1.1 pursuit; excluded until exact presentation and current registry snapshots are reviewed.",
        updatedAt: now,
      });
    }
    return {
      quarantined: legacy.length,
      remainingInSample: legacy.length === limit,
    };
  },
});

function defaultAssessment(input: {
  opportunityId: Id<"decisionOpportunities">;
  country: TargetCountry;
  normalizedPresentationKey: string;
  matchCount: number;
  sourceFetch: Doc<"sourceFetches">;
  freshnessMs: number;
}) {
  const now = Date.now();
  const status = whiteSpaceFinding(
    input.matchCount,
    input.sourceFetch.coverageHealth === "accepted" &&
      input.sourceFetch.structureStatus === "passed",
  );
  const gates = evaluateEvidenceGates({
    referenceApproved: true,
    eligibleCategory: true,
    whiteSpaceStatus: status,
    companyReasonCode: "UNCLASSIFIED",
    rightsCleared: false,
    referencePriceAvailable: false,
    economicsCalculated: false,
    commercialApproved: false,
    demandQualified: false,
  });
  return {
    decisionOpportunityId: input.opportunityId,
    country: input.country,
    stage: "needs_evidence" as const,
    productIdentityConfirmed: true,
    ownerConfirmed: true,
    registrationStatus:
      input.matchCount > 0
        ? ("registered" as const)
        : ("not_found_unverified" as const),
    registrationEvidence: whiteSpaceStatement({
      country: input.country,
      status,
      snapshotDate: input.sourceFetch.fetchedAt,
    }),
    rightsStatus: "needs_review" as const,
    presenceStatement: whiteSpaceStatement({
      country: input.country,
      status,
      snapshotDate: input.sourceFetch.fetchedAt,
    }),
    agentPartnerEvidence: "No country-rights conclusion recorded.",
    demandStrength: "none" as const,
    strongSignalCount: 0,
    mediumSignalCount: 0,
    demandSummary: "Demand evidence has not been reviewed.",
    competitionSummary:
      input.matchCount > 0
        ? `${input.matchCount} exact presentation match(es) found.`
        : "No exact presentation match in the accepted snapshot.",
    economicsStatus: "unvalidated" as const,
    economicsSummary:
      "UNVALIDATED — no source-backed price chain or approved commercial assumptions.",
    feasibilityReviewed: false,
    feasibilitySummary: "Route-to-market feasibility has not been reviewed.",
    blockers: [
      "Company intent, country rights, price chain, economics, demand, applicant, nominee covenant, and contact require review.",
    ],
    scoreBreakdown: {
      gapValidity: status === "no_match_in_snapshot" ? 70 : 0,
      commercialValue: 0,
      urgencyDemand: 0,
      regulatoryFeasibility: 0,
      partnerRightsReachability: 0,
      evidenceConfidence:
        input.country === "Saudi Arabia"
          ? 80
          : input.country === "UAE"
            ? 60
            : 40,
    },
    weightedScore: status === "no_match_in_snapshot" ? 26 : 0,
    criticalReviewOpen: true,
    evidenceObservedAt: input.sourceFetch.fetchedAt,
    staleAfter: input.sourceFetch.fetchedAt + input.freshnessMs,
    evidenceEngineVersion: EVIDENCE_ENGINE_VERSION,
    normalizedPresentationKey: input.normalizedPresentationKey,
    whiteSpaceStatus: status,
    absenceConfidence: targetConfidence(input.country),
    sourceSnapshotId: input.sourceFetch._id,
    sourceSnapshotDate: input.sourceFetch.fetchedAt,
    sourceExpiresAt: input.sourceFetch.fetchedAt + input.freshnessMs,
    companyReasonCode: "UNCLASSIFIED" as const,
    gateSnapshot: {
      ...gates,
      evaluatedAt: now,
      engineVersion: EVIDENCE_ENGINE_VERSION,
    },
    commercialApprovalStatus: "not_requested" as const,
    nomineeCovenantStatus: "not_requested" as const,
    createdAt: now,
    updatedAt: now,
  };
}

export const materializeReferenceCandidates = mutation({
  args: {
    importId: v.id("registrationImports"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    skipped: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const importDoc = await ctx.db.get(args.importId);
    if (
      !importDoc ||
      !importDoc.sourceType ||
      !REFERENCE_SOURCE_TYPES.has(importDoc.sourceType)
    )
      throw new Error("Choose an FDA, EMA, or MHRA reference-market snapshot");
    if (importDoc.coverageHealth !== "accepted" || !importDoc.sourceFetchId)
      throw new Error(
        "Approve the reference snapshot coverage before materializing candidates",
      );
    const sourceFetch = await ctx.db.get(importDoc.sourceFetchId);
    if (!sourceFetch) throw new Error("Reference snapshot manifest is missing");
    const page = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import", (q) => q.eq("importId", args.importId))
      .paginate(args.paginationOpts);
    let created = 0;
    let skipped = 0;
    for (const row of page.page) {
      if (
        !row.matchedDrugId ||
        !row.matchedCompanyId ||
        !row.normalizedPresentationKey ||
        row.productKind === "device"
      ) {
        skipped += 1;
        continue;
      }
      const [drug, company, classification] = await Promise.all([
        ctx.db.get(row.matchedDrugId),
        ctx.db.get(row.matchedCompanyId),
        ctx.db
          .query("companyClassificationFacts")
          .withIndex("by_company", (q) =>
            q.eq("companyId", row.matchedCompanyId),
          )
          .order("desc")
          .take(1),
      ]);
      if (
        !drug ||
        !company ||
        !isReferenceMarketCandidate({
          authorizationStatus:
            row.registrationStatus === "registered" ? "approved" : "unknown",
          productLifecycle: row.sourceStatus?.toLowerCase().includes("pipeline")
            ? "pipeline"
            : "marketed",
          isTop20Pharma: classification[0]?.isTop20Pharma ?? false,
          isWholesaler: /wholesale|trading|distributor/i.test(company.name),
        })
      ) {
        skipped += 1;
        continue;
      }
      const canonicalPursuitKey = buildCanonicalPursuitKey(
        row.normalizedPresentationKey,
        company._id,
      );
      const existing = await ctx.db
        .query("decisionOpportunities")
        .withIndex("by_canonical_pursuit_key", (q) =>
          q.eq("canonicalPursuitKey", canonicalPursuitKey),
        )
        .unique();
      if (existing) {
        skipped += 1;
        continue;
      }
      const now = Date.now();
      const opportunityId = await ctx.db.insert("decisionOpportunities", {
        drugId: drug._id,
        companyId: company._id,
        title: `${row.productName} evidence review`,
        status: "needs_validation",
        therapeuticArea:
          row.therapeuticGroup ?? drug.therapeuticArea ?? "Unclassified",
        productName: row.productName,
        genericName: row.genericName ?? drug.genericName,
        manufacturerName: row.manufacturerName,
        marketAuthorizationHolderName: row.mahName,
        approachEntityName: company.name,
        approachEntityRole: "unknown",
        focusMarkets: TARGETS.map((target) => target.country),
        gapType: "regulatory_gap",
        productIdentityStatus: "confirmed",
        gapSummary: "Target-market registry comparison pending.",
        commercialRationale:
          "Research candidate only; no commercial conclusion has been approved.",
        marketAttractiveness: "UNVALIDATED",
        demandProxy: "Demand signals are validators only.",
        competitivePressure: "UNVALIDATED",
        regulatoryFeasibility: "unknown",
        timelineRange: "UNVALIDATED",
        keyConstraint: "Complete G1–G7 evidence review.",
        entryStrategy: "watch",
        entryStrategyRationale:
          "KEMEDICA is coordinator/advisor unless a local applicant is explicitly recorded.",
        whyThisMarket: "Pending current target-registry comparison.",
        whyNow: "Pending demand evidence.",
        whyThisPartner: "Pending cited company-intent evidence.",
        targetRole: "International business development or licensing",
        companyWebsite: company.website,
        contactConfidence: "none",
        outreachSubject: "",
        outreachDraft: "",
        confidenceLevel: "low",
        confidenceSummary:
          "Reference-market approval recorded; all target-country and commercial claims remain under review.",
        assumptions: [],
        sourceCount: 1,
        priorityScore: 0,
        scoreBreakdown: {
          gapValidity: 0,
          commercialValue: 0,
          urgency: 0,
          feasibility: 0,
          partnerReachability: 0,
          evidenceConfidence: 20,
        },
        scoreExplanation: "Unranked until country evidence is evaluated.",
        whyThisMarketExplanation: "No conclusion yet.",
        whyNowExplanation: "No conclusion yet.",
        howToEnterExplanation: "No route selected.",
        whyThisPartnerExplanation: "No company-intent reason approved.",
        createdAt: now,
        updatedAt: now,
        lastPromotedAt: now,
        funnelStage: "needs_evidence",
        evidenceEngineVersion: EVIDENCE_ENGINE_VERSION,
        canonicalPursuitKey,
        normalizedPresentationKey: row.normalizedPresentationKey,
      });
      const existingFact = row.sourceRecordId
        ? await ctx.db
            .query("authorizedProductFacts")
            .withIndex("by_source_registry_and_source_record_id", (q) =>
              q
                .eq("sourceRegistry", sourceFetch.sourceRegistry)
                .eq("sourceRecordId", row.sourceRecordId),
            )
            .unique()
        : null;
      if (!existingFact)
        await ctx.db.insert("authorizedProductFacts", {
          drugId: drug._id,
          brandName: row.productName,
          inn: row.genericName ?? drug.genericName,
          indication: row.therapeuticGroup ?? "Not supplied",
          dosageForm: row.form ?? "Not supplied",
          strength: row.strength ?? "Not supplied",
          route: "Not supplied",
          mah: row.mahName ?? company.name,
          manufacturer: row.manufacturerName ?? company.name,
          authorizationMarket:
            importDoc.sourceType === "drugs_fda"
              ? "FDA"
              : importDoc.sourceType === "mhra_products"
                ? "MHRA"
                : "EMA",
          authorizationStatus: "approved",
          authorizationDate: row.approvalDate,
          sourceRecordId: row.sourceRecordId,
          sourceUrl: sourceFetch.sourceUrl,
          fetchedAt: sourceFetch.fetchedAt,
          sourceRegistry: sourceFetch.sourceRegistry,
          sourceFetchId: sourceFetch._id,
          normalizedInn: row.normalizedInn,
          normalizedDosageForm: row.normalizedDosageForm,
          normalizedStrength: row.normalizedStrength,
          normalizedPresentationKey: row.normalizedPresentationKey,
          parserVersion: sourceFetch.parserVersion,
          createdAt: now,
          updatedAt: now,
        });
      for (const target of TARGETS) {
        const targetImport = await latestAcceptedImport(ctx, target.sourceType);
        if (!targetImport?.sourceFetchId) continue;
        const targetFetch = await ctx.db.get(targetImport.sourceFetchId);
        if (!targetFetch) continue;
        const matches = await matchCount(
          ctx,
          targetImport._id,
          row.normalizedPresentationKey,
        );
        await ctx.db.insert(
          "opportunityMarketAssessments",
          defaultAssessment({
            opportunityId,
            country: target.country,
            normalizedPresentationKey: row.normalizedPresentationKey,
            matchCount: matches,
            sourceFetch: targetFetch,
            freshnessMs: target.freshnessMs,
          }),
        );
      }
      created += 1;
    }
    return {
      processed: page.page.length,
      created,
      skipped,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const materializeAcceptedReferenceSnapshot = action({
  args: { importId: v.id("registrationImports") },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    let processed = 0;
    let created = 0;
    let skipped = 0;
    for (;;) {
      const result: {
        processed: number;
        created: number;
        skipped: number;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runMutation(
        api.evidenceEngineV11.materializeReferenceCandidates,
        {
          importId: args.importId,
          paginationOpts: { numItems: 100, cursor },
        },
      );
      processed += result.processed;
      created += result.created;
      skipped += result.skipped;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return { processed, created, skipped };
  },
});
