import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireMember } from "./authz";
import {
  discoveredMedicine,
  discoveryMarket,
  discoveryClaim,
  discoveryCountry,
  discoveryResearchCheck,
} from "./medicineDiscoveryValidators";
import { isTop20OwnerName } from "./continuousOpportunityEngine";
import type { MutationCtx } from "./_generated/server";

import {
  reviewBasis,
  researchReviewBlockers,
  shortlistBlockers,
  commercialSignals,
  validEvidenceUrl,
} from "./medicineDiscoveryReviewPolicy";

async function start(ctx: MutationCtx) {
  const latest = await ctx.db
    .query("medicineDiscoveryRuns")
    .withIndex("by_started_at")
    .order("desc")
    .first();
  if (
    latest?.status === "running" &&
    Date.now() - latest.startedAt < 15 * 60_000
  )
    return latest._id;
  if (latest?.status === "running")
    await ctx.db.patch(latest._id, {
      status: "error",
      completedAt: Date.now(),
      warnings: [
        ...latest.warnings,
        "Previous collection timed out; restarted safely.",
      ],
    });
  const id = await ctx.db.insert("medicineDiscoveryRuns", {
    status: "running",
    sinceYear: new Date().getUTCFullYear() - 3,
    startedAt: Date.now(),
    sourceCounts: [],
    candidateCount: 0,
    researchQueued: 0,
    warnings: [],
  });
  await ctx.scheduler.runAfter(0, internal.medicineDiscoveryActions.collect, {
    runId: id,
  });
  return id;
}
export const startRun = mutation({
  args: {},
  returns: v.id("medicineDiscoveryRuns"),
  handler: async (ctx) => {
    await requireMember(ctx, ["admin", "analyst"]);
    return start(ctx);
  },
});
export const scheduledRun = internalMutation({
  args: {},
  returns: v.id("medicineDiscoveryRuns"),
  handler: start,
});
export const runContext = internalQuery({
  args: { runId: v.id("medicineDiscoveryRuns") },
  returns: v.any(),
  handler: async (ctx, { runId }) => {
    const imports = await ctx.db
      .query("registrationImports")
      .withIndex("by_source_type_and_created_at", (q) =>
        q.eq("sourceType", "mohap_uae_complete_product_list"),
      )
      .order("desc")
      .take(10);
    const fallback = await ctx.db
      .query("registrationImports")
      .withIndex("by_source_type_and_created_at", (q) =>
        q.eq("sourceType", "uae_official_directory"),
      )
      .order("desc")
      .take(10);
    const snapshot = [...imports, ...fallback].find(
      (i) => i.coverageHealth === "accepted" && i.sourceFetchId,
    );
    const fetchRecord = snapshot?.sourceFetchId
      ? await ctx.db.get(snapshot.sourceFetchId)
      : null;
    const usable =
      snapshot &&
      fetchRecord?.ok &&
      Date.now() - fetchRecord.fetchedAt < 45 * 24 * 60 * 60_000;
    return { run: await ctx.db.get(runId), snapshot: usable ? snapshot : null };
  },
});
export const registryPage = internalQuery({
  args: {
    importId: v.id("registrationImports"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import", (q) => q.eq("importId", args.importId))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((r) => ({
        name: r.productName,
        inn: r.genericName ?? "",
        form: r.form ?? "",
        strength: r.strength ?? "",
        owner: r.mahName ?? r.manufacturerName ?? "",
        record:
          r.sourceRecordId ?? r.registrationNumber ?? String(r.sourceRowNumber),
      })),
    };
  },
});
export const ingest = internalMutation({
  args: {
    medicines: v.array(
      v.object({
        medicine: discoveredMedicine,
        markets: v.array(discoveryMarket),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { medicines }) => {
    if (medicines.length > 25) throw new Error("Use 25-medicine batches");
    for (const { medicine: m, markets } of medicines) {
      const old = await ctx.db
        .query("medicineDiscoveries")
        .withIndex("by_key", (q) => q.eq("key", m.key))
        .unique();
      const references = [
        ...(old?.references ?? []).filter(
          (r) => r.authority !== m.reference.authority,
        ),
        m.reference,
      ];
      const owner = m.owner || old?.owner || "";
      const firstApprovalDate = references.map((r) => r.approvedAt).sort()[0];
      const priority =
        20 +
        (m.orphan || old?.orphan ? 15 : 0) +
        (owner ? 10 : 0) -
        (isTop20OwnerName(owner) ? 20 : 0) +
        (markets.some((x) => x.status === "no_molecule_match") ? 10 : 0) +
        (Number(firstApprovalDate.slice(0, 4)) >=
        new Date().getUTCFullYear() - 1
          ? 10
          : 0);
      const fields = {
        brand: m.brand,
        inn: m.inn,
        owner,
        indication:
          (m.reference.authority === "US" &&
          old?.references.some((r) => r.authority === "EU")
            ? old.indication
            : m.indication) ||
          old?.indication ||
          "",
        area: m.area || old?.area || "",
        orphan: m.orphan || old?.orphan || false,
        advanced: m.advanced || old?.advanced || false,
        references,
        firstApprovalDate,
        markets,
        priority,
        checkedAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (old) await ctx.db.patch(old._id, fields);
      else
        await ctx.db.insert("medicineDiscoveries", {
          ...fields,
          key: m.key,
          researchStatus: "not_started",
          claims: [],
          disposition: "new",
          createdAt: Date.now(),
        });
    }
    return medicines.length;
  },
});
export const finishRun = internalMutation({
  args: {
    runId: v.id("medicineDiscoveryRuns"),
    sourceCounts: v.array(
      v.object({
        name: v.string(),
        url: v.string(),
        parsed: v.number(),
        eligible: v.number(),
        sourceDate: v.optional(v.string()),
      }),
    ),
    candidateCount: v.number(),
    warnings: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, ...fields }) => {
    await ctx.db.patch(runId, {
      ...fields,
      status: fields.sourceCounts.length
        ? fields.warnings.length
          ? "partial"
          : "completed"
        : "error",
      completedAt: Date.now(),
    });
    // Automatic expansion stays paused until the research benchmark is accepted.
    const queued = 0;
    await ctx.db.patch(runId, { researchQueued: queued });
    return null;
  },
});
async function queueResearch(ctx: MutationCtx) {
  const candidates = (
    await ctx.db
      .query("medicineDiscoveries")
      .withIndex("by_research_status_and_priority", (q) =>
        q.eq("researchStatus", "not_started"),
      )
      .order("desc")
      .take(100)
  )
    .filter((m) => m.disposition !== "parked")
    .slice(0, 6);
  for (let i = 0; i < candidates.length; i++) {
    await ctx.db.patch(candidates[i]._id, {
      researchStatus: "queued",
      researchStartedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      i * 45_000,
      internal.medicineDiscoveryActions.research,
      { id: candidates[i]._id },
    );
  }
  return candidates.length;
}
export const researchNextBatch = internalMutation({
  args: {},
  returns: v.number(),
  handler: queueResearch,
});
export const researchOne = mutation({
  args: { id: v.id("medicineDiscoveries") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const m = await ctx.db.get(id);
    if (!m) throw new Error("Medicine not found");
    if (
      ["queued", "running"].includes(m.researchStatus) &&
      Date.now() - (m.researchStartedAt ?? 0) < 12 * 60_000
    )
      return null;
    if (
      m.claims.some((c) => c.verification === "page_excerpt_verified") &&
      m.researchStatus !== "error" &&
      m.researchedAt &&
      Date.now() - m.researchedAt < 5 * 60_000
    )
      throw new Error(
        "Research just completed. Review its evidence before rerunning.",
      );
    await ctx.db.patch(id, {
      researchStatus: "queued",
      researchStartedAt: Date.now(),
      researchError: undefined,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.medicineDiscoveryActions.research,
      { id },
    );
    return null;
  },
});
export const getInternal = internalQuery({
  args: { id: v.id("medicineDiscoveries") },
  returns: v.any(),
  handler: async (ctx, { id }) => ctx.db.get(id),
});
export const markResearchRunning = internalMutation({
  args: { id: v.id("medicineDiscoveries") },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    const m = await ctx.db.get(id);
    if (!m || m.researchStatus !== "queued") return false;
    const active = await ctx.db
      .query("medicineDiscoveries")
      .withIndex("by_research_status_and_priority", (q) =>
        q.eq("researchStatus", "running"),
      )
      .take(20);
    if (
      active.some((x) => Date.now() - (x.researchStartedAt ?? 0) < 10 * 60_000)
    )
      return false;
    for (const stale of active)
      await ctx.db.patch(stale._id, {
        researchStatus: "error",
        researchError: "Research timed out. Retry this medicine.",
      });
    await ctx.db.patch(id, {
      researchStatus: "running",
      researchStartedAt: Date.now(),
    });
    return true;
  },
});
export const saveResearch = internalMutation({
  args: {
    id: v.id("medicineDiscoveries"),
    claims: v.array(discoveryClaim),
    warnings: v.array(v.string()),
    error: v.optional(v.string()),
    auditStorageId: v.optional(v.id("_storage")),
    checks: v.optional(v.array(discoveryResearchCheck)),
    policyVersion: v.optional(v.number()),
    signals: v.optional(v.array(discoveryClaim)),
  },
  returns: v.null(),
  handler: async (
    ctx,
    {
      id,
      claims,
      warnings,
      error,
      auditStorageId,
      checks,
      policyVersion,
      signals,
    },
  ) => {
    const old = await ctx.db.get(id);
    if (!old) return null;
    await ctx.db.patch(id, {
      claims: error ? old.claims : claims,
      researchChecks: checks ?? [],
      researchPolicyVersion: policyVersion,
      reviewSignals: [
        ...new Map(
          [
            ...(old.reviewSignals ?? []),
            ...old.claims.filter((c) =>
              ["partner", "possible_partner", "local_presence"].includes(
                c.kind,
              ),
            ),
            ...(signals ?? []),
          ].map((c) => [`${c.url}|${c.country}`, c]),
        ).values(),
      ].slice(0, 24),
      disposition: old.disposition === "shortlisted" ? "new" : old.disposition,
      shortlistCountry: undefined,
      researchStatus: error
        ? "error"
        : policyVersion === 2 &&
            (!checks ||
              checks.length !== 8 ||
              checks.some((c) => c.status !== "completed"))
          ? "partial"
          : claims.length
            ? "completed"
            : "no_findings",
      researchWarnings: warnings,
      researchAuditStorageId: auditStorageId ?? old.researchAuditStorageId,
      researchError: error,
      researchedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const setDisposition = mutation({
  args: {
    id: v.id("medicineDiscoveries"),
    country: v.optional(discoveryCountry),
    disposition: v.union(
      v.literal("new"),
      v.literal("shortlisted"),
      v.literal("parked"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { id, disposition, country }) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const medicine = await ctx.db.get(id);
    if (!medicine) throw new Error("Medicine not found");
    if (disposition === "shortlisted") {
      if (!country) throw new Error("Choose the country for this shortlist.");
      const blockers = shortlistBlockers(medicine, country);
      if (blockers.length) throw new Error(blockers.join(" "));
    }
    await ctx.db.patch(id, {
      disposition,
      shortlistCountry: disposition === "shortlisted" ? country : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const dashboard = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    await requireMember(ctx);
    const candidates = await ctx.db
      .query("medicineDiscoveries")
      .withIndex("by_priority")
      .order("desc")
      .take(1000);
    const run = await ctx.db
      .query("medicineDiscoveryRuns")
      .withIndex("by_started_at")
      .order("desc")
      .first();
    return {
      candidates: candidates.map((m) =>
        m.disposition === "shortlisted" &&
        shortlistBlockers(m, m.shortlistCountry ?? "UAE").length
          ? { ...m, disposition: "new" as const }
          : m,
      ),
      run,
      bounded: candidates.length === 1000,
    };
  },
});

export const processResearchQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Recover terminated actions even when there is no next queued medicine.
    const running = await ctx.db
      .query("medicineDiscoveries")
      .withIndex("by_research_status_and_priority", (q) =>
        q.eq("researchStatus", "running"),
      )
      .take(20);
    for (const m of running) {
      if (Date.now() - (m.researchStartedAt ?? 0) >= 10 * 60_000) {
        await ctx.db.patch(m._id, {
          researchStatus: "error",
          researchError:
            "Research reached its time limit. Completed checks and existing evidence were retained; retry the unresolved work.",
          disposition: m.disposition === "shortlisted" ? "new" : m.disposition,
          shortlistCountry: undefined,
        });
      }
    }
    const next = await ctx.db
      .query("medicineDiscoveries")
      .withIndex("by_research_status_and_priority", (q) =>
        q.eq("researchStatus", "queued"),
      )
      .order("desc")
      .first();
    if (next)
      await ctx.scheduler.runAfter(
        0,
        internal.medicineDiscoveryActions.research,
        { id: next._id },
      );
    return null;
  },
});

export const researchAudit = query({
  args: { id: v.id("medicineDiscoveries") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { id }) => {
    await requireMember(ctx);
    const m = await ctx.db.get(id);
    return m?.researchAuditStorageId
      ? ctx.storage.getUrl(m.researchAuditStorageId)
      : null;
  },
});

export const recheckEvidence = mutation({
  args: { id: v.id("medicineDiscoveries") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireMember(ctx, ["admin", "analyst"]);
    await ctx.scheduler.runAfter(
      0,
      internal.medicineDiscoveryActions.revalidateAudit,
      { id },
    );
    return null;
  },
});

export const recordCommercialReview = mutation({
  args: {
    id: v.id("medicineDiscoveries"),
    country: discoveryCountry,
    expectedBasis: v.string(),
    reviewer: v.string(),
    registrationNote: v.string(),
    rightsNote: v.string(),
    rationale: v.string(),
    evidenceUrls: v.array(v.string()),
    resolvedSignalUrls: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, expectedBasis, ...review }) => {
    await requireMember(ctx, ["admin", "analyst"]);
    const medicine = await ctx.db.get(id);
    if (!medicine) throw new Error("Medicine not found");
    if (expectedBasis !== reviewBasis(medicine))
      throw new Error(
        "Evidence changed. Reload and review the current findings.",
      );
    const blockers = researchReviewBlockers(medicine, review.country);
    if (blockers.length) throw new Error(blockers.join(" "));
    if (review.reviewer.trim().length < 2 || review.reviewer.length > 120)
      throw new Error("Enter the reviewing analyst's name.");
    for (const note of [
      review.registrationNote,
      review.rightsNote,
      review.rationale,
    ])
      if (note.trim().length < 40 || note.length > 4000)
        throw new Error("Explain each review decision in 40–4,000 characters.");
    if (
      !review.evidenceUrls.length ||
      review.evidenceUrls.length > 12 ||
      !review.evidenceUrls.every(validEvidenceUrl)
    )
      throw new Error("Add 1–12 supporting evidence links.");
    const signals = commercialSignals(medicine, review.country);
    if (
      review.resolvedSignalUrls.length > 36 ||
      signals.some((c) => !review.resolvedSignalUrls.includes(c.url))
    )
      throw new Error(
        "Review and explicitly resolve every relevant commercial warning.",
      );
    const entry = { ...review, basis: expectedBasis, reviewedAt: Date.now() };
    await ctx.db.insert("medicineCommercialReviews", {
      medicineId: id,
      review: entry,
    });
    await ctx.db.patch(id, { commercialReview: entry, updatedAt: Date.now() });
    return null;
  },
});

export const recordResearchProgress = internalMutation({
  args: {
    id: v.id("medicineDiscoveries"),
    checks: v.array(discoveryResearchCheck),
  },
  returns: v.null(),
  handler: async (ctx, { id, checks }) => {
    const m = await ctx.db.get(id);
    if (m?.researchStatus === "running")
      await ctx.db.patch(id, {
        researchChecks: checks,
        researchPolicyVersion: 2,
      });
    return null;
  },
});
