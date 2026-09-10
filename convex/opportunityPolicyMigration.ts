import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireMember } from "./authz";
import { isTop20OwnerName } from "./continuousOpportunityEngine";
import { POLICY_VERSION } from "./opportunityAssessmentPolicy";

/** Preview each bounded page before applying its exact fingerprint. Never deletes history. */
export const migratePage = mutation({
  args: {
    paginationOpts: paginationOptsValidator,
    dryRun: v.boolean(),
    expectedFingerprint: v.optional(v.string()),
  },
  returns: v.object({
    fingerprint: v.string(),
    affected: v.number(),
    restoredLargePharma: v.number(),
    preservedQuarantine: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin"]);
    const page = await ctx.db
      .query("decisionOpportunities")
      .paginate(args.paginationOpts);
    const candidates = page.page.filter(
      (o) => o.evidenceEngineVersion === "v1.1",
    );
    const rows = await Promise.all(
      candidates.map(async (opportunity) => ({
        opportunity,
        assessments: await ctx.db
          .query("opportunityMarketAssessments")
          .withIndex("by_opportunity", (q) =>
            q.eq("decisionOpportunityId", opportunity._id),
          )
          .take(3),
      })),
    );
    const snapshot = JSON.stringify(rows);
    let hash = 2166136261;
    for (let i = 0; i < snapshot.length; i++)
      hash = Math.imul(hash ^ snapshot.charCodeAt(i), 16777619);
    const fingerprint = `${POLICY_VERSION}:${rows.length}:${hash >>> 0}`;
    if (!args.dryRun && args.expectedFingerprint !== fingerprint)
      throw new Error(
        "Migration preview changed; generate a fresh preview for this page.",
      );
    let restoredLargePharma = 0;
    let preservedQuarantine = 0;
    for (const { opportunity, assessments } of rows) {
      const restore = Boolean(
        opportunity.legacyQuarantinedAt &&
        /top.?20 pharma exclusion/i.test(
          opportunity.legacyQuarantineReason ?? "",
        ),
      );
      if (restore) restoredLargePharma++;
      if (opportunity.legacyQuarantinedAt && !restore) preservedQuarantine++;
      if (args.dryRun) continue;
      const contacted = [
        "assigned",
        "contacted",
        "engaged",
        "diligence",
        "negotiating",
        "won",
        "lost",
      ].includes(opportunity.funnelStage ?? "");
      const now = Date.now();
      await ctx.db.patch(opportunity._id, {
        evidenceEngineVersion: POLICY_VERSION,
        companyFitScore: 5,
        deprioritizationReasons: isTop20OwnerName(
          opportunity.approachEntityName,
        )
          ? ["Large international pharma; remains eligible"]
          : [],
        ...(restore
          ? {
              legacyQuarantinedAt: undefined,
              legacyQuarantineReason: undefined,
            }
          : {}),
        ...(!contacted
          ? {
              funnelStage: "needs_evidence" as const,
              priorityScore: 0,
              outreachPackage: undefined,
              outreachSubject: "",
              outreachDraft: "",
            }
          : {}),
        updatedAt: now,
      });
      for (const a of assessments)
        await ctx.db.patch(a._id, {
          evidenceEngineVersion: POLICY_VERSION,
          absenceConfidence: undefined,
          productIdentityConfirmed: false,
          ownerConfirmed: false,
          currentMah: undefined,
          registryMatchKind: "unresolved",
          nomineeRequired: false,
          ...(!contacted
            ? {
                stage: "needs_evidence" as const,
                commercialApprovalStatus: "not_requested" as const,
              }
            : {}),
          gateSnapshot: a.gateSnapshot
            ? {
                ...a.gateSnapshot,
                engineVersion: POLICY_VERSION,
                g3WhiteSpace: "UNVALIDATED",
                g4CompanyAndRights:
                  a.rightsStatus === "clear_no_conflict_found"
                    ? "PASS"
                    : "UNVALIDATED",
                g6LifetimeEconomics: "UNVALIDATED",
                evaluatedAt: now,
              }
            : undefined,
          blockers: [
            ...new Set([
              ...a.blockers,
              "Review exact registration versus equivalent competitors and the five-year forecast under v1.2.",
            ]),
          ],
          updatedAt: now,
        });
    }
    return {
      fingerprint,
      affected: rows.length,
      restoredLargePharma,
      preservedQuarantine,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
