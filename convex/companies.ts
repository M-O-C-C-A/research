import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  buildDisqualifierReasons,
  normalizePipelineStage,
} from "./distributorFit";

const PIPELINE_STAGE_VALIDATOR = v.union(
  v.literal("screened"),
  v.literal("qualified"),
  v.literal("contacted"),
  v.literal("intro_call"),
  v.literal("data_shared"),
  v.literal("partner_discussion"),
  v.literal("negotiating"),
  v.literal("won"),
  v.literal("lost")
);

const LEGACY_OR_NEW_STAGE_VALIDATOR = v.union(
  PIPELINE_STAGE_VALIDATOR,
  v.literal("prospect"),
  v.literal("engaged"),
  v.literal("contracted"),
  v.literal("disqualified")
);

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const all = await ctx.db.query("companies").order("asc").collect();
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.therapeuticAreas.some((a) => a.toLowerCase().includes(q))
    );
  },
});

export const get = query({
  args: { id: v.id("companies") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    name: v.string(),
    country: v.string(),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    therapeuticAreas: v.array(v.string()),
    // BD fields
    bdStatus: v.optional(LEGACY_OR_NEW_STAGE_VALIDATOR),
    bdScore: v.optional(v.number()),
    bdScoreRationale: v.optional(v.string()),
    companySize: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaPresence: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    revenueEstimate: v.optional(v.string()),
    employeeCount: v.optional(v.string()),
    distributorFitScore: v.optional(v.number()),
    distributorFitRationale: v.optional(v.string()),
    targetSegment: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaChannelStatus: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    exportReadiness: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    )),
    dealModelFit: v.optional(v.union(v.literal("distributor"))),
    priorityTier: v.optional(v.union(
      v.literal("tier_1"),
      v.literal("tier_2"),
      v.literal("tier_3"),
      v.literal("deprioritized"),
    )),
    partnerabilitySignals: v.optional(v.array(v.string())),
    disqualifierReasons: v.optional(v.array(v.string())),
    ownershipType: v.optional(v.string()),
    exportMarketsKnown: v.optional(v.array(v.string())),
    partneringHistory: v.optional(v.string()),
    manufacturingFootprint: v.optional(v.string()),
    primaryCommercialModel: v.optional(v.string()),
    entityRoles: v.optional(v.array(v.union(
      v.literal("manufacturer"),
      v.literal("market_authorization_holder"),
      v.literal("licensor"),
      v.literal("regional_partner"),
      v.literal("distributor")
    ))),
    commercialControlLevel: v.optional(v.union(
      v.literal("full"),
      v.literal("shared"),
      v.literal("limited"),
      v.literal("unknown")
    )),
    existingMenaPartners: v.optional(v.array(v.object({
      name: v.string(),
      role: v.union(
        v.literal("affiliate"),
        v.literal("distributor"),
        v.literal("local_mah_partner"),
        v.literal("licensee"),
        v.literal("co_marketing_partner"),
        v.literal("tender_partner"),
        v.literal("other")
      ),
      geographies: v.array(v.string()),
      exclusivity: v.optional(v.union(
        v.literal("exclusive"),
        v.literal("non_exclusive"),
        v.literal("unknown")
      )),
      confidence: v.union(
        v.literal("confirmed"),
        v.literal("likely"),
        v.literal("inferred")
      ),
      source: v.optional(v.string()),
      url: v.optional(v.string()),
    }))),
    menaPartnershipStrength: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("moderate"),
      v.literal("entrenched")
    )),
    approachTargetRecommendation: v.optional(v.union(
      v.literal("approach"),
      v.literal("watch"),
      v.literal("deprioritize")
    )),
    approachTargetReason: v.optional(v.string()),
    notApproachableReason: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("companies", { ...args, status: "active" }),
});

export const update = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    therapeuticAreas: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    // BD fields
    bdStatus: v.optional(LEGACY_OR_NEW_STAGE_VALIDATOR),
    bdScore: v.optional(v.number()),
    bdScoreRationale: v.optional(v.string()),
    companySize: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaPresence: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    revenueEstimate: v.optional(v.string()),
    employeeCount: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    bdNotes: v.optional(v.string()),
    bdScoredAt: v.optional(v.number()),
    linkedinCompanyUrl: v.optional(v.string()),
    researchedAt: v.optional(v.number()),
    bdEvidenceItems: v.optional(v.array(v.object({
      claim: v.string(),
      source: v.string(),
      url: v.optional(v.string()),
    }))),
    keyContacts: v.optional(v.array(v.object({
      name: v.string(),
      title: v.string(),
      email: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      confidence: v.union(v.literal("confirmed"), v.literal("likely"), v.literal("inferred")),
      source: v.optional(v.string()),
    }))),
    distributorFitScore: v.optional(v.number()),
    distributorFitRationale: v.optional(v.string()),
    targetSegment: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaChannelStatus: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    exportReadiness: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    )),
    dealModelFit: v.optional(v.union(v.literal("distributor"))),
    priorityTier: v.optional(v.union(
      v.literal("tier_1"),
      v.literal("tier_2"),
      v.literal("tier_3"),
      v.literal("deprioritized"),
    )),
    partnerabilitySignals: v.optional(v.array(v.string())),
    disqualifierReasons: v.optional(v.array(v.string())),
    ownershipType: v.optional(v.string()),
    exportMarketsKnown: v.optional(v.array(v.string())),
    partneringHistory: v.optional(v.string()),
    manufacturingFootprint: v.optional(v.string()),
    primaryCommercialModel: v.optional(v.string()),
    entityRoles: v.optional(v.array(v.union(
      v.literal("manufacturer"),
      v.literal("market_authorization_holder"),
      v.literal("licensor"),
      v.literal("regional_partner"),
      v.literal("distributor")
    ))),
    commercialControlLevel: v.optional(v.union(
      v.literal("full"),
      v.literal("shared"),
      v.literal("limited"),
      v.literal("unknown")
    )),
    existingMenaPartners: v.optional(v.array(v.object({
      name: v.string(),
      role: v.union(
        v.literal("affiliate"),
        v.literal("distributor"),
        v.literal("local_mah_partner"),
        v.literal("licensee"),
        v.literal("co_marketing_partner"),
        v.literal("tender_partner"),
        v.literal("other")
      ),
      geographies: v.array(v.string()),
      exclusivity: v.optional(v.union(
        v.literal("exclusive"),
        v.literal("non_exclusive"),
        v.literal("unknown")
      )),
      confidence: v.union(
        v.literal("confirmed"),
        v.literal("likely"),
        v.literal("inferred")
      ),
      source: v.optional(v.string()),
      url: v.optional(v.string()),
    }))),
    menaPartnershipStrength: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("moderate"),
      v.literal("entrenched")
    )),
    approachTargetRecommendation: v.optional(v.union(
      v.literal("approach"),
      v.literal("watch"),
      v.literal("deprioritize")
    )),
    approachTargetReason: v.optional(v.string()),
    notApproachableReason: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

// Atomic stage change + activity log
export const moveStage = mutation({
  args: {
    id: v.id("companies"),
    newStatus: PIPELINE_STAGE_VALIDATOR,
  },
  handler: async (ctx, { id, newStatus }) => {
    const company = await ctx.db.get(id);
    if (!company) return;
    const previousStage = normalizePipelineStage(company.bdStatus);
    await ctx.db.patch(id, { bdStatus: newStatus });
    await ctx.db.insert("bdActivities", {
      companyId: id,
      type: "stage_change",
      content: `Moved from ${previousStage} to ${newStatus}`,
      previousStage,
      newStage: newStatus,
      createdAt: Date.now(),
    });
  },
});

export const listByBdStatus = query({
  args: {
    bdStatus: PIPELINE_STAGE_VALIDATOR,
  },
  handler: async (ctx, { bdStatus }) => {
    const companies = await ctx.db.query("companies").collect();
    return companies.filter(
      (company) => normalizePipelineStage(company.bdStatus) === bdStatus
    );
  },
});

export const listTopBdScored = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_bd_score")
      .order("desc")
      .take(limit ?? 10);
  },
});

export const pipelineStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("companies").collect();
    const counts: Record<string, number> = {
      screened: 0,
      qualified: 0,
      contacted: 0,
      intro_call: 0,
      data_shared: 0,
      partner_discussion: 0,
      negotiating: 0,
      won: 0,
      lost: 0,
      unset: 0,
    };
    for (const c of all) {
      const stage = normalizePipelineStage(c.bdStatus);
      counts[stage] = (counts[stage] ?? 0) + 1;
    }
    const activeCount =
      (counts.qualified ?? 0) +
      (counts.contacted ?? 0) +
      (counts.intro_call ?? 0) +
      (counts.data_shared ?? 0) +
      (counts.partner_discussion ?? 0) +
      (counts.negotiating ?? 0);
    return { counts, total: all.length, activeCount };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("companies").collect();
    return { total: all.length };
  },
});

export const listByIds = query({
  args: { ids: v.array(v.id("companies")) },
  handler: async (ctx, { ids }) => {
    const results = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return results.filter((r): r is NonNullable<typeof r> => r != null);
  },
});

export const listPrioritized = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const companies = await ctx.db.query("companies").collect();
    return companies
      .map((company) => ({
        ...company,
        normalizedStage: normalizePipelineStage(company.bdStatus),
        inferredDisqualifiers:
          company.disqualifierReasons && company.disqualifierReasons.length > 0
            ? company.disqualifierReasons
            : buildDisqualifierReasons({
                companySize: company.targetSegment ?? company.companySize,
                menaPresence: company.menaChannelStatus ?? company.menaPresence,
                menaRegistrationCount: 0,
                hasPartneringSignals:
                  (company.partnerabilitySignals?.length ?? 0) > 0,
              }),
      }))
      .sort(
        (a, b) =>
          (b.distributorFitScore ?? b.bdScore ?? 0) -
          (a.distributorFitScore ?? a.bdScore ?? 0)
      )
      .slice(0, limit ?? 25);
  },
});
