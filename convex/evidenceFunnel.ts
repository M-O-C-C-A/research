import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./authz";
import {
  calculateWeightedScore,
  contactReadyBlockers,
  MONTHLY_CONTACT_READY_TARGET,
} from "./funnelPolicy";
import {
  canGenerateOutreach,
  EVIDENCE_ENGINE_VERSION,
  evaluateEvidenceGates,
  whiteSpaceStatement,
} from "./evidenceEngineV11Policy";

const country = v.union(
  v.literal("UAE"),
  v.literal("Saudi Arabia"),
  v.literal("Egypt"),
);
const funnelStage = v.union(
  v.literal("needs_evidence"),
  v.literal("qualified"),
  v.literal("contact_ready"),
  v.literal("assigned"),
  v.literal("contacted"),
  v.literal("engaged"),
  v.literal("diligence"),
  v.literal("negotiating"),
  v.literal("won"),
  v.literal("watching"),
  v.literal("disqualified"),
  v.literal("lost"),
);
const scoreBreakdown = v.object({
  gapValidity: v.number(),
  commercialValue: v.number(),
  urgencyDemand: v.number(),
  regulatoryFeasibility: v.number(),
  partnerRightsReachability: v.number(),
  evidenceConfidence: v.number(),
});
const companyReasonCode = v.union(
  v.literal("UNCLASSIFIED"),
  v.literal("ALREADY_PARTNERED_ELSEWHERE"),
  v.literal("OUT_LICENSING"),
  v.literal("PARKED"),
  v.literal("IGNORING"),
  v.literal("STRUCTURAL_NO"),
);
const nomineeCovenantStatus = v.union(
  v.literal("not_requested"),
  v.literal("requested"),
  v.literal("reviewed"),
  v.literal("accepted"),
  v.literal("rejected"),
);

const TARGET_REGISTRY: Record<"Saudi Arabia" | "UAE" | "Egypt", string> = {
  "Saudi Arabia": "sfda_registered_drugs",
  UAE: "uae_ede_directory",
  Egypt: "egypt_eda_authorized_export",
};
const TARGET_IMPORT_SOURCE: Record<"Saudi Arabia" | "UAE" | "Egypt", string> = {
  "Saudi Arabia": "sfda_registered_drugs",
  UAE: "uae_official_directory",
  Egypt: "egypt_eda_authorized_export",
};
const TARGET_CONFIDENCE = {
  "Saudi Arabia": "high",
  UAE: "medium",
  Egypt: "low",
} as const;
const TARGET_SNAPSHOT_FRESHNESS_MS = {
  "Saudi Arabia": 8 * 24 * 60 * 60 * 1_000,
  UAE: 31 * 24 * 60 * 60 * 1_000,
  Egypt: 31 * 24 * 60 * 60 * 1_000,
} as const;

function monthStart(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function publicRoute(contact?: Doc<"leadContacts">) {
  return Boolean(contact?.email || contact?.linkedinUrl);
}

async function latestContact(
  ctx: Parameters<typeof requireMember>[0],
  companyId?: Id<"companies">,
) {
  if (!companyId) return undefined;
  return (
    await ctx.db
      .query("leadContacts")
      .withIndex("by_company_and_verified_at", (q) =>
        q.eq("companyId", companyId),
      )
      .order("desc")
      .take(1)
  )[0];
}

function buildBrief(
  opportunity: Doc<"decisionOpportunities">,
  assessment: Doc<"opportunityMarketAssessments">,
  signals: Doc<"opportunitySignalLinks">[],
) {
  const references =
    signals.length > 0
      ? signals
          .map(
            (signal, index) =>
              `${index + 1}. ${signal.title}: ${signal.sourceUrl}`,
          )
          .join("\n")
      : "No approved references linked.";
  return [
    `${opportunity.productName} — ${assessment.country}`,
    `Indication / area: ${opportunity.therapeuticArea}`,
    `Owner to approach: ${opportunity.approachEntityName}`,
    `Why the market appears open: ${assessment.presenceStatement}`,
    `Why now: ${assessment.demandSummary || opportunity.whyNow}`,
    `Commercial case: ${assessment.economicsSummary}`,
    `Feasibility: ${assessment.feasibilitySummary}`,
    `Proposed mandate: representation, licensing, distribution management, or market-entry support.`,
    `Unresolved assumptions: ${[...opportunity.assumptions, ...assessment.blockers].join("; ") || "None recorded"}`,
    `References:\n${references}`,
  ].join("\n");
}

function buildReferralEmail(
  opportunity: Doc<"decisionOpportunities">,
  assessment: Doc<"opportunityMarketAssessments">,
) {
  return `Subject: ${opportunity.productName} — ${assessment.country} market-entry discussion\n\nHello,\n\nI am trying to reach the person responsible for international business development or licensing for ${opportunity.productName}. We have identified a reviewed ${assessment.country} market-entry case based on ${assessment.demandSummary.toLowerCase()}. KEMEDICA can support a flexible mandate covering representation, licensing, distribution management, or market entry.\n\nWould you be the right person for a short discussion, or could you point me to the appropriate colleague?\n\nBest regards,\nKEMEDICA`;
}

export const stats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    stages: v.record(v.string(), v.number()),
    contactReadyThisMonth: v.number(),
    staleAssessments: v.number(),
    unresolvedCriticalReviews: v.number(),
    monthlyTarget: v.number(),
    aboveMonthlyTarget: v.number(),
  }),
  handler: async (ctx) => {
    await requireMember(ctx);
    const opportunities = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_evidence_engine_version_and_priority_score", (q) =>
        q.eq("evidenceEngineVersion", EVIDENCE_ENGINE_VERSION),
      )
      .order("desc")
      .take(500);
    const stages = new Map<string, number>();
    for (const opportunity of opportunities) {
      const stage = opportunity.funnelStage ?? "needs_evidence";
      stages.set(stage, (stages.get(stage) ?? 0) + 1);
    }
    const assessments = (
      await ctx.db.query("opportunityMarketAssessments").take(1_500)
    ).filter(
      (assessment) =>
        assessment.evidenceEngineVersion === EVIDENCE_ENGINE_VERSION,
    );
    return {
      total: opportunities.length,
      stages: Object.fromEntries(stages),
      contactReadyThisMonth: opportunities.filter(
        (item) =>
          item.lastQualifiedAt &&
          item.lastQualifiedAt >= monthStart(Date.now()) &&
          [
            "contact_ready",
            "assigned",
            "contacted",
            "engaged",
            "diligence",
            "negotiating",
            "won",
          ].includes(item.funnelStage ?? ""),
      ).length,
      staleAssessments: assessments.filter(
        (assessment) => assessment.staleAfter <= Date.now(),
      ).length,
      unresolvedCriticalReviews: assessments.filter(
        (assessment) => assessment.criticalReviewOpen,
      ).length,
      monthlyTarget: MONTHLY_CONTACT_READY_TARGET,
      aboveMonthlyTarget: Math.max(
        0,
        opportunities.filter(
          (item) =>
            item.lastQualifiedAt &&
            item.lastQualifiedAt >= monthStart(Date.now()) &&
            [
              "contact_ready",
              "assigned",
              "contacted",
              "engaged",
              "diligence",
              "negotiating",
              "won",
            ].includes(item.funnelStage ?? ""),
        ).length - MONTHLY_CONTACT_READY_TARGET,
      ),
    };
  },
});

export const list = query({
  args: {
    stage: v.optional(funnelStage),
    targetCountry: v.optional(country),
    limit: v.optional(v.number()),
    queue: v.optional(v.union(v.literal("working"), v.literal("watchlist"))),
    search: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 80, 150));
    const candidates = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_evidence_engine_version_and_priority_score", (q) =>
        q.eq("evidenceEngineVersion", EVIDENCE_ENGINE_VERSION),
      )
      .order("desc")
      .take(Math.min(limit * 5, 500));
    const search = args.search?.trim().toLowerCase();
    const opportunities = candidates
      .filter(
        (opportunity) =>
          opportunity.evidenceEngineVersion === EVIDENCE_ENGINE_VERSION &&
          !opportunity.legacyQuarantinedAt,
      )
      .filter(
        (opportunity) => !args.stage || opportunity.funnelStage === args.stage,
      )
      .filter((opportunity) =>
        args.queue === "watchlist"
          ? opportunity.funnelStage === "watching"
          : !["watching", "disqualified", "lost"].includes(
              opportunity.funnelStage ?? "needs_evidence",
            ),
      )
      .filter(
        (opportunity) =>
          !search ||
          [
            opportunity.productName,
            opportunity.genericName,
            opportunity.approachEntityName,
            opportunity.therapeuticArea,
          ].some((value) => value.toLowerCase().includes(search)),
      )
      .slice(0, args.queue === "working" ? Math.min(limit, 20) : limit);
    const rows = await Promise.all(
      opportunities.map(async (opportunity) => {
        const assessments = await ctx.db
          .query("opportunityMarketAssessments")
          .withIndex("by_opportunity", (q) =>
            q.eq("decisionOpportunityId", opportunity._id),
          )
          .take(3);
        const visible = args.targetCountry
          ? assessments.filter((item) => item.country === args.targetCountry)
          : assessments;
        if (args.targetCountry && visible.length === 0) return null;
        const contact = await latestContact(ctx, opportunity.companyId);
        const assignee = opportunity.assignedMemberId
          ? await ctx.db.get(opportunity.assignedMemberId)
          : null;
        return { opportunity, assessments: visible, contact, assignee };
      }),
    );
    return rows.filter(Boolean);
  },
});

export const get = query({
  args: { opportunityId: v.id("decisionOpportunities") },
  returns: v.any(),
  handler: async (ctx, { opportunityId }) => {
    await requireMember(ctx);
    const opportunity = await ctx.db.get(opportunityId);
    if (!opportunity) return null;
    const [assessments, signals, tasks, activities, contact] =
      await Promise.all([
        ctx.db
          .query("opportunityMarketAssessments")
          .withIndex("by_opportunity", (q) =>
            q.eq("decisionOpportunityId", opportunityId),
          )
          .take(3),
        ctx.db
          .query("opportunitySignalLinks")
          .withIndex("by_opportunity", (q) =>
            q.eq("decisionOpportunityId", opportunityId),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("outreachTasks")
          .withIndex("by_opportunity", (q) =>
            q.eq("decisionOpportunityId", opportunityId),
          )
          .take(20),
        ctx.db
          .query("bdActivities")
          .withIndex("by_decision_opportunity", (q) =>
            q.eq("decisionOpportunityId", opportunityId),
          )
          .order("desc")
          .take(100),
        latestContact(ctx, opportunity.companyId),
      ]);
    return { opportunity, assessments, signals, tasks, activities, contact };
  },
});

export const reviewAssessment = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    country,
    productIdentityConfirmed: v.boolean(),
    ownerConfirmed: v.boolean(),
    registrationStatus: v.union(
      v.literal("registered"),
      v.literal("under_registration"),
      v.literal("verified_absent"),
      v.literal("not_found_unverified"),
      v.literal("unverified"),
    ),
    registrationEvidence: v.string(),
    rightsStatus: v.union(
      v.literal("clear_no_conflict_found"),
      v.literal("conflict"),
      v.literal("unknown"),
      v.literal("needs_review"),
    ),
    presenceStatement: v.string(),
    agentPartnerEvidence: v.string(),
    demandStrength: v.union(
      v.literal("strong"),
      v.literal("medium"),
      v.literal("weak"),
      v.literal("none"),
    ),
    strongSignalCount: v.number(),
    mediumSignalCount: v.number(),
    demandSummary: v.string(),
    competitionSummary: v.string(),
    economicsStatus: v.union(
      v.literal("evidence_backed"),
      v.literal("conservative_range"),
      v.literal("unvalidated"),
    ),
    economicsSummary: v.string(),
    feasibilityReviewed: v.boolean(),
    feasibilitySummary: v.string(),
    blockers: v.array(v.string()),
    scoreBreakdown,
    criticalReviewOpen: v.boolean(),
    evidenceObservedAt: v.number(),
    staleAfter: v.number(),
    normalizedPresentationKey: v.string(),
    companyReasonCode,
    companyReasonEvidenceUrl: v.string(),
    companyReasonEvidenceExcerpt: v.string(),
    companyReasonObservedAt: v.number(),
    intendedLocalApplicant: v.string(),
    nomineeCovenantStatus,
    referenceApproved: v.boolean(),
    eligibleCategory: v.boolean(),
    referencePriceAvailable: v.boolean(),
    priceChainPasses: v.optional(v.boolean()),
    economicsCalculated: v.boolean(),
    verificationMode: v.union(
      v.literal("snapshot"),
      v.literal("targeted_check"),
    ),
    targetedCheckResult: v.optional(
      v.union(
        v.literal("matches_found"),
        v.literal("no_match_found"),
        v.literal("inconclusive"),
      ),
    ),
    targetedCheckSourceUrl: v.optional(v.string()),
    targetedCheckSearchTerms: v.optional(v.string()),
    targetedCheckEvidenceExcerpt: v.optional(v.string()),
  },
  returns: v.id("opportunityMarketAssessments"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, ["admin", "analyst"]);
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) throw new Error("Opportunity not found");
    if (args.strongSignalCount < 0 || args.mediumSignalCount < 0)
      throw new Error("Signal counts cannot be negative");
    if (
      !Number.isFinite(args.evidenceObservedAt) ||
      !Number.isFinite(args.staleAfter) ||
      args.staleAfter <= args.evidenceObservedAt
    ) {
      throw new Error(
        "Fresh-until date must be later than the evidence observation date",
      );
    }
    if (
      args.rightsStatus === "clear_no_conflict_found" &&
      !/^No conflicting presence found as of \d{4}-\d{2}-\d{2}/i.test(
        args.presenceStatement.trim(),
      )
    ) {
      throw new Error(
        "A clear rights review must use the dated wording “No conflicting presence found as of YYYY-MM-DD”.",
      );
    }
    if (
      Object.values(args.scoreBreakdown).some(
        (score) => score < 0 || score > 100,
      )
    )
      throw new Error("Every score must be between 0 and 100");
    const sourceImport = (
      await ctx.db
        .query("registrationImports")
        .withIndex("by_source_type_and_created_at", (q) =>
          q.eq("sourceType", TARGET_IMPORT_SOURCE[args.country]),
        )
        .order("desc")
        .take(20)
    ).find((item) => item.coverageHealth === "accepted" && item.sourceFetchId);
    const sourceSnapshot = sourceImport?.sourceFetchId
      ? await ctx.db.get(sourceImport.sourceFetchId)
      : null;
    const healthySnapshot = Boolean(
      sourceImport &&
      sourceSnapshot &&
      sourceSnapshot.coverageHealth === "accepted" &&
      sourceSnapshot.structureStatus === "passed",
    );
    if (args.country === "UAE" && !healthySnapshot)
      throw new Error("UAE review requires the latest accepted EDE snapshot");
    if (args.verificationMode === "snapshot" && !healthySnapshot)
      throw new Error(
        `No accepted ${TARGET_REGISTRY[args.country]} snapshot is available; use a targeted check`,
      );
    if (args.verificationMode === "targeted_check") {
      if (args.country === "UAE")
        throw new Error(
          "UAE uses the accepted EDE snapshot, not targeted checks",
        );
      if (
        !args.targetedCheckResult ||
        !args.targetedCheckSourceUrl?.trim() ||
        !args.targetedCheckSearchTerms?.trim() ||
        !args.targetedCheckEvidenceExcerpt?.trim()
      )
        throw new Error(
          "A targeted check requires its result, official source URL, exact search terms, and evidence note",
        );
    }
    const matchCount =
      args.verificationMode === "snapshot" && sourceImport
        ? (
            await ctx.db
              .query("registrationImportRows")
              .withIndex("by_import_and_normalized_presentation_key", (q) =>
                q
                  .eq("importId", sourceImport._id)
                  .eq(
                    "normalizedPresentationKey",
                    args.normalizedPresentationKey,
                  ),
              )
              .take(1)
          ).length
        : 0;
    const derivedWhiteSpaceStatus =
      args.verificationMode === "snapshot"
        ? matchCount > 0
          ? ("matches_found" as const)
          : ("no_match_in_snapshot" as const)
        : args.targetedCheckResult === "matches_found"
          ? ("matches_found" as const)
          : args.targetedCheckResult === "no_match_found"
            ? ("no_match_in_targeted_check" as const)
            : ("not_checked" as const);
    if (
      args.companyReasonCode !== "UNCLASSIFIED" &&
      (!args.companyReasonEvidenceUrl.trim() ||
        !args.companyReasonEvidenceExcerpt.trim())
    ) {
      throw new Error(
        "A classified company reason requires a source URL and excerpt",
      );
    }
    const weightedScore = calculateWeightedScore(args.scoreBreakdown);
    const existing = await ctx.db
      .query("opportunityMarketAssessments")
      .withIndex("by_opportunity_and_country", (q) =>
        q
          .eq("decisionOpportunityId", args.opportunityId)
          .eq("country", args.country),
      )
      .unique();
    const commercialApprovalStatus =
      existing?.commercialApprovalStatus === "approved"
        ? ("approved" as const)
        : args.economicsCalculated
          ? ("provisional" as const)
          : ("not_requested" as const);
    const gates = evaluateEvidenceGates({
      referenceApproved: args.referenceApproved,
      eligibleCategory: args.eligibleCategory,
      whiteSpaceStatus: derivedWhiteSpaceStatus,
      companyReasonCode: args.companyReasonCode,
      rightsCleared: args.rightsStatus === "clear_no_conflict_found",
      referencePriceAvailable: args.referencePriceAvailable,
      priceChainPasses: args.priceChainPasses,
      economicsCalculated: args.economicsCalculated,
      commercialApproved: commercialApprovalStatus === "approved",
      demandQualified:
        args.strongSignalCount >= 1 || args.mediumSignalCount >= 2,
    });
    const now = Date.now();
    const gateSnapshot = {
      ...gates,
      evaluatedAt: now,
      engineVersion: EVIDENCE_ENGINE_VERSION,
    };
    const eligibleForQualification =
      args.productIdentityConfirmed &&
      args.ownerConfirmed &&
      args.feasibilityReviewed &&
      !args.criticalReviewOpen &&
      [
        gates.g1ReferenceApproval,
        gates.g2EligibleCategory,
        gates.g3WhiteSpace,
        gates.g4CompanyAndRights,
        gates.g5PriceChain,
        gates.g7Demand,
      ].every((gate) => gate === "PASS") &&
      ["PASS", "PROVISIONAL"].includes(gates.g6LifetimeEconomics);
    const stage =
      derivedWhiteSpaceStatus === "matches_found" ||
      args.rightsStatus === "conflict" ||
      ["PARKED", "IGNORING", "STRUCTURAL_NO"].includes(args.companyReasonCode)
        ? ("watching" as const)
        : eligibleForQualification
          ? ("qualified" as const)
          : ("needs_evidence" as const);
    const {
      opportunityId,
      referenceApproved: _referenceApproved,
      eligibleCategory: _eligibleCategory,
      referencePriceAvailable: _referencePriceAvailable,
      priceChainPasses: _priceChainPasses,
      economicsCalculated: _economicsCalculated,
      ...assessmentFields
    } = args;
    void _referenceApproved;
    void _eligibleCategory;
    void _referencePriceAvailable;
    void _priceChainPasses;
    void _economicsCalculated;
    const sourceSnapshotDate =
      args.verificationMode === "snapshot"
        ? sourceSnapshot?.fetchedAt
        : args.evidenceObservedAt;
    const sourceExpiresAt =
      args.verificationMode === "snapshot"
        ? sourceSnapshotDate
          ? sourceSnapshotDate + TARGET_SNAPSHOT_FRESHNESS_MS[args.country]
          : undefined
        : args.staleAfter;
    const findingStatement = whiteSpaceStatement({
      country: args.country,
      status: derivedWhiteSpaceStatus,
      snapshotDate: sourceSnapshotDate,
    });
    const record = {
      ...assessmentFields,
      decisionOpportunityId: opportunityId,
      stage,
      weightedScore,
      registrationStatus: [
        "no_match_in_snapshot",
        "no_match_in_targeted_check",
      ].includes(derivedWhiteSpaceStatus)
        ? ("not_found_unverified" as const)
        : derivedWhiteSpaceStatus === "matches_found"
          ? ("registered" as const)
          : ("unverified" as const),
      registrationEvidence: findingStatement,
      presenceStatement: findingStatement,
      evidenceEngineVersion: EVIDENCE_ENGINE_VERSION,
      gateSnapshot,
      commercialApprovalStatus,
      whiteSpaceStatus: derivedWhiteSpaceStatus,
      absenceConfidence:
        args.verificationMode === "targeted_check" &&
        args.country === "Saudi Arabia"
          ? ("medium" as const)
          : TARGET_CONFIDENCE[args.country],
      sourceSnapshotId:
        args.verificationMode === "snapshot" ? sourceSnapshot?._id : undefined,
      sourceSnapshotDate,
      sourceExpiresAt,
      verificationMode: args.verificationMode,
      targetedCheckResult:
        args.verificationMode === "targeted_check"
          ? args.targetedCheckResult
          : undefined,
      targetedCheckSourceUrl:
        args.verificationMode === "targeted_check"
          ? args.targetedCheckSourceUrl?.trim()
          : undefined,
      targetedCheckSearchTerms:
        args.verificationMode === "targeted_check"
          ? args.targetedCheckSearchTerms?.trim()
          : undefined,
      targetedCheckEvidenceExcerpt:
        args.verificationMode === "targeted_check"
          ? args.targetedCheckEvidenceExcerpt?.trim()
          : undefined,
      reviewedByMemberId: member._id,
      reviewedAt: now,
      updatedAt: now,
    };
    let id: Id<"opportunityMarketAssessments">;
    if (existing) {
      await ctx.db.patch(existing._id, record);
      id = existing._id;
    } else {
      id = await ctx.db.insert("opportunityMarketAssessments", {
        ...record,
        createdAt: now,
      });
    }
    if (
      !opportunity.funnelStage ||
      ["needs_evidence", "qualified", "watching"].includes(
        opportunity.funnelStage,
      )
    ) {
      await ctx.db.patch(opportunity._id, {
        funnelStage: stage,
        priorityScore: Math.max(opportunity.priorityScore, weightedScore),
        evidenceEngineVersion: EVIDENCE_ENGINE_VERSION,
        normalizedPresentationKey: args.normalizedPresentationKey,
        legacyQuarantinedAt: undefined,
        legacyQuarantineReason: undefined,
        updatedAt: now,
      });
    }
    return id;
  },
});

export const approveCommercialAssumptions = mutation({
  args: {
    assessmentId: v.id("opportunityMarketAssessments"),
    approvalNote: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, ["admin", "analyst"]);
    const assessment = await ctx.db.get(args.assessmentId);
    if (
      !assessment ||
      assessment.evidenceEngineVersion !== EVIDENCE_ENGINE_VERSION
    )
      throw new Error("v1.1 assessment not found");
    if (!args.approvalNote.trim())
      throw new Error(
        "Record why these provisional assumptions are acceptable for this pursuit",
      );
    const now = Date.now();
    const gateSnapshot = assessment.gateSnapshot
      ? {
          ...assessment.gateSnapshot,
          g6LifetimeEconomics: "PASS" as const,
          evaluatedAt: now,
        }
      : undefined;
    await ctx.db.patch(args.assessmentId, {
      commercialApprovalStatus: "approved",
      commercialApprovedByMemberId: member._id,
      commercialApprovedAt: now,
      economicsSummary: `${assessment.economicsSummary}\nApproval note: ${args.approvalNote.trim()}`,
      gateSnapshot,
      updatedAt: now,
    });
    return null;
  },
});

export const addEvidence = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    assessmentId: v.optional(v.id("opportunityMarketAssessments")),
    marketSignalId: v.optional(v.id("marketSignals")),
    sourceFetchId: v.optional(v.id("sourceFetches")),
    title: v.string(),
    sourceUrl: v.string(),
    sourceType: v.string(),
    evidenceStrength: v.union(
      v.literal("strong"),
      v.literal("medium"),
      v.literal("supporting"),
    ),
    observedAt: v.number(),
    parserVersion: v.string(),
    confidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("inferred"),
    ),
    reviewState: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  },
  returns: v.id("opportunitySignalLinks"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, ["admin", "analyst"]);
    const { opportunityId, ...evidenceFields } = args;
    return await ctx.db.insert("opportunitySignalLinks", {
      ...evidenceFields,
      decisionOpportunityId: opportunityId,
      ...(args.reviewState === "pending"
        ? {}
        : { reviewedByMemberId: member._id, reviewedAt: Date.now() }),
      createdAt: Date.now(),
    });
  },
});

export const verifyContact = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    name: v.string(),
    title: v.string(),
    role: v.union(
      v.literal("business_development"),
      v.literal("international_markets"),
      v.literal("licensing"),
      v.literal("commercial"),
      v.literal("executive"),
    ),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    sourceUrl: v.string(),
    sourceKind: v.union(
      v.literal("company_website"),
      v.literal("company_press_release"),
      v.literal("conference"),
      v.literal("linkedin"),
      v.literal("manual"),
    ),
    verifiedAt: v.number(),
  },
  returns: v.id("leadContacts"),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity?.companyId)
      throw new Error("Confirm the owner company before verifying a contact");
    if (!args.email?.trim() && !args.linkedinUrl?.trim())
      throw new Error("A public email or direct LinkedIn route is required");
    if (Date.now() - args.verifiedAt > 90 * 24 * 60 * 60 * 1_000)
      throw new Error("Contact verification must be within the last 90 days");
    const now = Date.now();
    const existing = await ctx.db
      .query("leadContacts")
      .withIndex("by_company_and_source_url", (q) =>
        q
          .eq("companyId", opportunity.companyId!)
          .eq("sourceUrl", args.sourceUrl),
      )
      .unique();
    const record = {
      companyId: opportunity.companyId,
      name: args.name.trim(),
      title: args.title.trim(),
      role: args.role,
      email: args.email?.trim() || undefined,
      linkedinUrl: args.linkedinUrl?.trim() || undefined,
      sourceUrl: args.sourceUrl.trim(),
      sourceKind: args.sourceKind,
      verifiedAt: args.verifiedAt,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, record);
      return existing._id;
    }
    return await ctx.db.insert("leadContacts", { ...record, createdAt: now });
  },
});

export const promoteContactReady = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    assessmentId: v.id("opportunityMarketAssessments"),
  },
  returns: v.object({ promoted: v.boolean(), blockers: v.array(v.string()) }),
  handler: async (ctx, { opportunityId, assessmentId }) => {
    const member = await requireMember(ctx, ["admin", "analyst"]);
    const now = Date.now();
    const opportunity = await ctx.db.get(opportunityId);
    const assessment = await ctx.db.get(assessmentId);
    if (
      !opportunity ||
      !assessment ||
      assessment.decisionOpportunityId !== opportunityId
    )
      throw new Error("Opportunity assessment not found");
    if (
      opportunity.evidenceEngineVersion !== EVIDENCE_ENGINE_VERSION ||
      assessment.evidenceEngineVersion !== EVIDENCE_ENGINE_VERSION
    ) {
      return {
        promoted: false,
        blockers: [
          "Pre-v1.1 pursuits must pass the current evidence engine before promotion.",
        ],
      };
    }
    const contact = await latestContact(ctx, opportunity.companyId);
    const approvedSignals = await ctx.db
      .query("opportunitySignalLinks")
      .withIndex("by_assessment_and_review_state", (q) =>
        q.eq("assessmentId", assessmentId).eq("reviewState", "approved"),
      )
      .take(100);
    const blockers = contactReadyBlockers({
      ...assessment,
      strongSignalCount: approvedSignals.filter(
        (signal) => signal.evidenceStrength === "strong",
      ).length,
      mediumSignalCount: approvedSignals.filter(
        (signal) => signal.evidenceStrength === "medium",
      ).length,
      contactVerifiedAt: contact?.verifiedAt,
      contactHasRoute: publicRoute(contact),
      now,
    });
    if (blockers.length > 0) return { promoted: false, blockers };

    await ctx.db.patch(assessmentId, {
      stage: "contact_ready",
      blockers: [],
      updatedAt: now,
    });
    await ctx.db.patch(opportunityId, {
      funnelStage: "contact_ready",
      lastQualifiedAt: now,
      staleAfter: assessment.staleAfter,
      outreachSubject: "",
      outreachDraft: "",
      outreachPackage: undefined,
      outreachReadiness: {
        gapConfirmed: true,
        ownershipConfirmed: true,
        contactConfirmed: true,
        reachableChannelAvailable: true,
        readyToSend: false,
      },
      outreachBlockers: [],
      priorityScore: assessment.weightedScore,
      updatedAt: now,
      lastPromotedAt: now,
    });
    if (opportunity.companyId)
      await ctx.db.insert("bdActivities", {
        companyId: opportunity.companyId,
        decisionOpportunityId: opportunityId,
        performedByMemberId: member._id,
        type: "stage_change",
        content: `Approved ${assessment.country} assessment as contact-ready. Outreach remains human-controlled.`,
        previousStage: opportunity.funnelStage ?? "needs_evidence",
        newStage: "contact_ready",
        createdAt: now,
      });
    return { promoted: true, blockers: [] };
  },
});

export const generateOutreachPackage = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    assessmentId: v.id("opportunityMarketAssessments"),
  },
  returns: v.object({ generated: v.boolean() }),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, ["admin", "analyst", "bd"]);
    const opportunity = await ctx.db.get(args.opportunityId);
    const assessment = await ctx.db.get(args.assessmentId);
    if (
      !opportunity ||
      !assessment ||
      assessment.decisionOpportunityId !== opportunity._id
    )
      throw new Error("Opportunity assessment not found");
    if (
      !canGenerateOutreach(
        assessment.stage,
        assessment.evidenceEngineVersion,
      ) ||
      opportunity.funnelStage !== "contact_ready"
    )
      throw new Error(
        "Approve the pursuit as Contact Ready before generating outreach material",
      );
    const approvedSignals = await ctx.db
      .query("opportunitySignalLinks")
      .withIndex("by_assessment_and_review_state", (q) =>
        q.eq("assessmentId", assessment._id).eq("reviewState", "approved"),
      )
      .take(100);
    const email = buildReferralEmail(opportunity, assessment);
    const brief = buildBrief(opportunity, assessment, approvedSignals);
    const now = Date.now();
    await ctx.db.patch(opportunity._id, {
      outreachSubject: `${opportunity.productName} — ${assessment.country} market-entry discussion`,
      outreachDraft: email,
      outreachPackage: {
        shortEmail: email,
        longEmail: email,
        linkedinMessage: email,
        callOpening: `I am calling about a reviewed ${assessment.country} market-entry case for ${opportunity.productName}.`,
        attachmentBrief: brief,
      },
      updatedAt: now,
    });
    if (opportunity.companyId)
      await ctx.db.insert("bdActivities", {
        companyId: opportunity.companyId,
        decisionOpportunityId: opportunity._id,
        performedByMemberId: member._id,
        type: "outreach_update",
        content:
          "Generated a cited outreach package by explicit human action; nothing was sent.",
        createdAt: now,
      });
    return { generated: true };
  },
});

export const assign = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    memberId: v.id("workspaceMembers"),
    contactId: v.optional(v.id("leadContacts")),
  },
  returns: v.object({ tasksCreated: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx, ["admin", "analyst"]);
    const opportunity = await ctx.db.get(args.opportunityId);
    const assignee = await ctx.db.get(args.memberId);
    if (!opportunity || opportunity.funnelStage !== "contact_ready")
      throw new Error("Only contact-ready opportunities can be assigned");
    if (!opportunity.companyId)
      throw new Error("A company is required before assignment");
    if (!opportunity.outreachPackage)
      throw new Error(
        "Generate and review the outreach package before assignment",
      );
    if (
      !assignee?.active ||
      !["admin", "analyst", "bd"].includes(assignee.role)
    )
      throw new Error("Assignee is not active");
    const now = Date.now();
    const existing = await ctx.db
      .query("outreachTasks")
      .withIndex("by_opportunity", (q) =>
        q.eq("decisionOpportunityId", args.opportunityId),
      )
      .take(20);
    const existingDays = new Set(existing.map((task) => task.sequenceDay));
    const sequence = [
      {
        day: 0 as const,
        channel: "email" as const,
        title: "Send reviewed referral email",
      },
      {
        day: 3 as const,
        channel: "linkedin" as const,
        title: "Follow up through LinkedIn",
      },
      {
        day: 7 as const,
        channel: "call" as const,
        title: "Call the company or referral contact",
      },
      {
        day: 14 as const,
        channel: "email" as const,
        title: "Send evidence-led follow-up",
      },
      {
        day: 30 as const,
        channel: "call" as const,
        title: "Close the loop or move to watching",
      },
    ];
    let tasksCreated = 0;
    for (const step of sequence) {
      if (existingDays.has(step.day)) continue;
      await ctx.db.insert("outreachTasks", {
        decisionOpportunityId: args.opportunityId,
        companyId: opportunity.companyId,
        contactId: args.contactId,
        assignedMemberId: args.memberId,
        sequenceDay: step.day,
        channel: step.channel,
        title: step.title,
        draft: step.day === 0 ? opportunity.outreachDraft : undefined,
        dueAt: now + step.day * 24 * 60 * 60 * 1_000,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      tasksCreated += 1;
    }
    await ctx.db.patch(args.opportunityId, {
      assignedMemberId: args.memberId,
      assignmentAcceptedAt: undefined,
      funnelStage: "assigned",
      updatedAt: now,
    });
    await ctx.db.insert("bdActivities", {
      companyId: opportunity.companyId,
      decisionOpportunityId: args.opportunityId,
      performedByMemberId: actor._id,
      type: "stage_change",
      content: `Assigned to ${assignee.name ?? assignee.email}; ${tasksCreated} human follow-up tasks created.`,
      previousStage: "contact_ready",
      newStage: "assigned",
      createdAt: now,
    });
    return { tasksCreated };
  },
});

export const logActivity = mutation({
  args: {
    opportunityId: v.id("decisionOpportunities"),
    type: v.union(
      v.literal("note"),
      v.literal("email_sent"),
      v.literal("email_received"),
      v.literal("call"),
      v.literal("meeting"),
      v.literal("deal_update"),
    ),
    content: v.string(),
    nextStage: v.optional(funnelStage),
  },
  returns: v.id("bdActivities"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, ["admin", "analyst", "bd"]);
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity?.companyId)
      throw new Error("Opportunity with a company is required");
    if (member.role === "bd" && opportunity.assignedMemberId !== member._id)
      throw new Error("This opportunity is assigned to another owner");
    const now = Date.now();
    const previousStage = opportunity.funnelStage ?? "needs_evidence";
    const contactStage =
      args.type === "email_sent" || args.type === "call"
        ? "contacted"
        : undefined;
    const nextStage = args.nextStage ?? contactStage;
    if (nextStage)
      await ctx.db.patch(args.opportunityId, {
        funnelStage: nextStage,
        ...(nextStage === "contacted" ? { lastContactedAt: now } : {}),
        updatedAt: now,
      });
    return await ctx.db.insert("bdActivities", {
      companyId: opportunity.companyId,
      decisionOpportunityId: args.opportunityId,
      performedByMemberId: member._id,
      type: args.type,
      content: args.content,
      previousStage,
      newStage: nextStage,
      createdAt: now,
    });
  },
});

export const acceptAssignment = mutation({
  args: { opportunityId: v.id("decisionOpportunities") },
  returns: v.null(),
  handler: async (ctx, { opportunityId }) => {
    const member = await requireMember(ctx, ["admin", "analyst", "bd"]);
    const opportunity = await ctx.db.get(opportunityId);
    if (
      !opportunity?.companyId ||
      opportunity.assignedMemberId !== member._id
    ) {
      throw new Error("This opportunity is not assigned to you");
    }
    if (opportunity.assignmentAcceptedAt) return null;
    const now = Date.now();
    await ctx.db.patch(opportunityId, {
      assignmentAcceptedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("bdActivities", {
      companyId: opportunity.companyId,
      decisionOpportunityId: opportunityId,
      performedByMemberId: member._id,
      type: "outreach_update",
      content: "BD owner accepted the assignment.",
      createdAt: now,
    });
    return null;
  },
});

export const completeTask = mutation({
  args: {
    taskId: v.id("outreachTasks"),
    status: v.union(v.literal("completed"), v.literal("skipped")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, ["admin", "analyst", "bd"]);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (member.role === "bd" && task.assignedMemberId !== member._id)
      throw new Error("This task is assigned to another owner");
    await ctx.db.patch(task._id, {
      status: args.status,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const myTasks = query({
  args: { includeCompleted: v.optional(v.boolean()) },
  returns: v.any(),
  handler: async (ctx, { includeCompleted }) => {
    const member = await requireMember(ctx, ["admin", "analyst", "bd"]);
    const now = Date.now();
    const tasks =
      member.role === "bd"
        ? await ctx.db
            .query("outreachTasks")
            .withIndex("by_assignee_and_status_and_due", (q) =>
              q.eq("assignedMemberId", member._id).eq("status", "pending"),
            )
            .take(100)
        : await ctx.db.query("outreachTasks").take(250);
    const visible = tasks
      .filter((task) => includeCompleted || task.status === "pending")
      .sort((left, right) => left.dueAt - right.dueAt);
    return await Promise.all(
      visible.map(async (task) => ({
        task,
        opportunity: await ctx.db.get(task.decisionOpportunityId),
        contact: task.contactId ? await ctx.db.get(task.contactId) : null,
        assignee: await ctx.db.get(task.assignedMemberId),
        overdue: task.dueAt < now,
      })),
    );
  },
});

export const companyRollups = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    await requireMember(ctx, ["admin", "analyst", "bd"]);
    const opportunities = await ctx.db.query("decisionOpportunities").take(500);
    const rank: Record<string, number> = {
      needs_evidence: 0,
      watching: 1,
      qualified: 2,
      contact_ready: 3,
      assigned: 4,
      contacted: 5,
      engaged: 6,
      diligence: 7,
      negotiating: 8,
      won: 9,
      disqualified: -1,
      lost: -1,
    };
    const grouped = new Map<Id<"companies">, Doc<"decisionOpportunities">[]>();
    for (const opportunity of opportunities) {
      if (!opportunity.companyId) continue;
      grouped.set(opportunity.companyId, [
        ...(grouped.get(opportunity.companyId) ?? []),
        opportunity,
      ]);
    }
    const rows = await Promise.all(
      [...grouped.entries()].map(async ([companyId, items]) => {
        const sorted = [...items].sort(
          (left, right) =>
            (rank[right.funnelStage ?? "needs_evidence"] ?? 0) -
            (rank[left.funnelStage ?? "needs_evidence"] ?? 0),
        );
        return {
          company: await ctx.db.get(companyId),
          stage: sorted[0]?.funnelStage ?? "needs_evidence",
          opportunityCount: items.length,
          contactReadyCount: items.filter((item) =>
            [
              "contact_ready",
              "assigned",
              "contacted",
              "engaged",
              "diligence",
              "negotiating",
              "won",
            ].includes(item.funnelStage ?? ""),
          ).length,
          topOpportunity: sorted[0] ?? null,
        };
      }),
    );
    return rows.sort(
      (left, right) => (rank[right.stage] ?? 0) - (rank[left.stage] ?? 0),
    );
  },
});

export const expireStaleUncontacted = mutation({
  args: {},
  returns: v.object({ demoted: v.number() }),
  handler: async (ctx) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const now = Date.now();
    const assessments = await ctx.db
      .query("opportunityMarketAssessments")
      .withIndex("by_stale_after", (q) => q.lte("staleAfter", now))
      .take(500);
    let demoted = 0;
    for (const assessment of assessments) {
      if (
        !["qualified", "contact_ready", "assigned"].includes(assessment.stage)
      )
        continue;
      const opportunity = await ctx.db.get(assessment.decisionOpportunityId);
      if (!opportunity || opportunity.lastContactedAt) continue;
      await ctx.db.patch(assessment._id, {
        stage: "needs_evidence",
        blockers: [
          ...assessment.blockers,
          "Evidence freshness expired; re-review required.",
        ],
        updatedAt: now,
      });
      await ctx.db.patch(opportunity._id, {
        funnelStage: "needs_evidence",
        assignedMemberId: undefined,
        updatedAt: now,
      });
      demoted += 1;
    }
    return { demoted };
  },
});

export const expireStaleUncontactedInternal = internalMutation({
  args: {},
  returns: v.object({ demoted: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const assessments = await ctx.db
      .query("opportunityMarketAssessments")
      .withIndex("by_stale_after", (q) => q.lte("staleAfter", now))
      .take(500);
    let demoted = 0;
    for (const assessment of assessments) {
      if (
        !["qualified", "contact_ready", "assigned"].includes(assessment.stage)
      )
        continue;
      const opportunity = await ctx.db.get(assessment.decisionOpportunityId);
      if (!opportunity || opportunity.lastContactedAt) continue;
      await ctx.db.patch(assessment._id, {
        stage: "needs_evidence",
        blockers: [
          ...assessment.blockers,
          "Evidence freshness expired; re-review required.",
        ],
        updatedAt: now,
      });
      await ctx.db.patch(opportunity._id, {
        funnelStage: "needs_evidence",
        assignedMemberId: undefined,
        updatedAt: now,
      });
      demoted += 1;
    }
    return { demoted };
  },
});
