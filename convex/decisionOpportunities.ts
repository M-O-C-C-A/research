import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import {
  buildDecisionOpportunityDraft,
  FOCUS_MARKETS,
} from "./decisionOpportunityEngine";

const scoreBreakdownValidator = v.object({
  gapValidity: v.number(),
  commercialValue: v.number(),
  urgency: v.number(),
  feasibility: v.number(),
  partnerReachability: v.number(),
  evidenceConfidence: v.number(),
});

const opportunityArgs = {
  drugId: v.id("drugs"),
  companyId: v.optional(v.id("companies")),
  gapOpportunityId: v.optional(v.id("gapOpportunities")),
  gapCompanyMatchId: v.optional(v.id("gapCompanyMatches")),
  title: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("archived"),
    v.literal("needs_validation")
  ),
  therapeuticArea: v.string(),
  productName: v.string(),
  genericName: v.string(),
  manufacturerName: v.optional(v.string()),
  marketAuthorizationHolderName: v.optional(v.string()),
  approachEntityName: v.string(),
  approachEntityRole: v.union(
    v.literal("manufacturer"),
    v.literal("market_authorization_holder"),
    v.literal("licensor"),
    v.literal("regional_partner"),
    v.literal("distributor"),
    v.literal("unknown")
  ),
  focusMarkets: v.array(v.string()),
  secondaryMarkets: v.array(v.string()),
  gapType: v.union(
    v.literal("formulary_gap"),
    v.literal("regulatory_gap"),
    v.literal("tender_pull"),
    v.literal("channel_whitespace"),
    v.literal("mixed")
  ),
  productIdentityStatus: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("uncertain")
  ),
  gapSummary: v.string(),
  commercialRationale: v.string(),
  marketAttractiveness: v.string(),
  marketSizeEstimate: v.optional(v.string()),
  demandProxy: v.string(),
  competitivePressure: v.string(),
  regulatoryFeasibility: v.union(
    v.literal("easy"),
    v.literal("moderate"),
    v.literal("complex"),
    v.literal("unknown")
  ),
  timelineRange: v.string(),
  keyConstraint: v.string(),
  entryStrategy: v.union(
    v.literal("distributor"),
    v.literal("licensing"),
    v.literal("direct"),
    v.literal("watch")
  ),
  entryStrategyRationale: v.string(),
  whyThisMarket: v.string(),
  whyNow: v.string(),
  whyThisPartner: v.string(),
  targetRole: v.string(),
  contactName: v.optional(v.string()),
  contactTitle: v.optional(v.string()),
  contactEmail: v.optional(v.string()),
  contactLinkedinUrl: v.optional(v.string()),
  contactConfidence: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("inferred"),
    v.literal("none")
  ),
  outreachSubject: v.string(),
  outreachDraft: v.string(),
  confidenceLevel: v.union(
    v.literal("high"),
    v.literal("medium"),
    v.literal("low")
  ),
  confidenceSummary: v.string(),
  assumptions: v.array(v.string()),
  sourceCount: v.number(),
  priorityScore: v.number(),
  rankingPosition: v.optional(v.number()),
  scoreBreakdown: scoreBreakdownValidator,
  scoreExplanation: v.string(),
  whyThisMarketExplanation: v.string(),
  whyNowExplanation: v.string(),
  howToEnterExplanation: v.string(),
  whyThisPartnerExplanation: v.string(),
};

const aliasInputValidator = v.object({
  alias: v.string(),
  normalizedAlias: v.string(),
  aliasType: v.union(
    v.literal("brand"),
    v.literal("generic"),
    v.literal("inn"),
    v.literal("manufacturer"),
    v.literal("market_authorization_holder"),
    v.literal("other")
  ),
  confidence: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("uncertain")
  ),
  source: v.optional(v.string()),
  notes: v.optional(v.string()),
  companyId: v.optional(v.id("companies")),
});

const evidenceInputValidator = v.object({
  title: v.string(),
  url: v.string(),
  claim: v.string(),
  evidenceType: v.union(
    v.literal("regulatory"),
    v.literal("market"),
    v.literal("gap"),
    v.literal("company"),
    v.literal("contact"),
    v.literal("internal")
  ),
  confidence: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("inferred")
  ),
});

function normalizeAlias(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqBy<T>(items: T[], keyFn: (item: T) => string) {
  return [...new Map(items.map((item) => [keyFn(item), item])).values()];
}

function chooseBestDrug(args: {
  company: Doc<"companies">;
  gap: Doc<"gapOpportunities">;
  drugs: Doc<"drugs">[];
}) {
  const candidateDrugs = args.drugs
    .filter((drug) => drug.companyId === args.company._id)
    .filter(
      (drug) =>
        args.gap.linkedDrugIds?.includes(drug._id) ||
        drug.therapeuticArea === args.gap.therapeuticArea
    )
    .sort((left, right) => {
      const leftLinked = args.gap.linkedDrugIds?.includes(left._id) ? 1 : 0;
      const rightLinked = args.gap.linkedDrugIds?.includes(right._id) ? 1 : 0;
      if (leftLinked !== rightLinked) return rightLinked - leftLinked;
      const leftScore = (left.patentUrgencyScore ?? 0) - (left.menaRegistrationCount ?? 0);
      const rightScore =
        (right.patentUrgencyScore ?? 0) - (right.menaRegistrationCount ?? 0);
      return rightScore - leftScore;
    });

  return candidateDrugs[0] ?? null;
}

function collectEvidence(args: {
  gap: Doc<"gapOpportunities">;
  match: Doc<"gapCompanyMatches">;
  company: Doc<"companies">;
  reportByDrugId: Map<Id<"drugs">, Doc<"reports">>;
  drugId: Id<"drugs">;
}) {
  const gapEvidence = (args.gap.sources ?? []).map((source) => ({
    title: source.title,
    url: source.url,
    claim: args.gap.demandEvidence,
    evidenceType: "gap" as const,
    confidence: "likely" as const,
  }));
  const matchEvidence = (args.match.evidenceLinks ?? []).map((source) => ({
    title: source.title,
    url: source.url,
    claim: args.match.rationale,
    evidenceType: "market" as const,
    confidence: "likely" as const,
  }));
  const companyEvidence = (args.company.bdEvidenceItems ?? [])
    .filter((item) => item.url)
    .map((item) => ({
      title: item.source,
      url: item.url!,
      claim: item.claim,
      evidenceType: "company" as const,
      confidence: "likely" as const,
    }));
  const reportEvidence = (args.reportByDrugId.get(args.drugId)?.sources ?? []).map(
    (source) => ({
      title: source.title,
      url: source.url,
      claim: "Supporting internal deal pursuit brief",
      evidenceType: "internal" as const,
      confidence: "inferred" as const,
    })
  );

  return uniqBy(
    [...gapEvidence, ...matchEvidence, ...companyEvidence, ...reportEvidence].slice(0, 12),
    (item) => `${item.url}|${item.claim}`
  );
}

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("active"), v.literal("archived"), v.literal("needs_validation"))
    ),
    market: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, market, limit }) => {
    const rows = status
      ? await ctx.db
          .query("decisionOpportunities")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query("decisionOpportunities").collect();

    return rows
      .filter((row) => !market || row.focusMarkets.includes(market))
      .sort((left, right) => {
        const leftRank = left.rankingPosition ?? 9999;
        const rightRank = right.rankingPosition ?? 9999;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return right.priorityScore - left.priorityScore;
      })
      .slice(0, limit ?? 50);
  },
});

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) => {
    const rows = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect();
    return rows.sort((left, right) => (left.rankingPosition ?? 9999) - (right.rankingPosition ?? 9999));
  },
});

export const listByGapOpportunity = query({
  args: { gapOpportunityId: v.id("gapOpportunities") },
  handler: async (ctx, { gapOpportunityId }) => {
    const rows = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_gap_opportunity", (q) => q.eq("gapOpportunityId", gapOpportunityId))
      .collect();
    return rows.sort((left, right) => (left.rankingPosition ?? 9999) - (right.rankingPosition ?? 9999));
  },
});

export const get = query({
  args: { id: v.id("decisionOpportunities") },
  handler: async (ctx, { id }) => {
    const opportunity = await ctx.db.get(id);
    if (!opportunity) return null;

    const [drug, company, gap, evidence, aliases] = await Promise.all([
      ctx.db.get(opportunity.drugId),
      opportunity.companyId ? ctx.db.get(opportunity.companyId) : null,
      opportunity.gapOpportunityId ? ctx.db.get(opportunity.gapOpportunityId) : null,
      ctx.db
        .query("opportunityEvidence")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", id))
        .collect(),
      ctx.db
        .query("productIdentityAliases")
        .withIndex("by_drug", (q) => q.eq("drugId", opportunity.drugId))
        .collect(),
    ]);

    return {
      ...opportunity,
      drug,
      company,
      gap,
      evidence: evidence.sort((left, right) => left.title.localeCompare(right.title)),
      aliases,
    };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("decisionOpportunities").collect();
    const active = rows.filter((row) => row.status === "active");
    const needsValidation = rows.filter((row) => row.status === "needs_validation");
    const topFocus = active.filter((row) =>
      row.focusMarkets.some((market) => FOCUS_MARKETS.includes(market as (typeof FOCUS_MARKETS)[number]))
    );
    return {
      total: rows.length,
      active: active.length,
      needsValidation: needsValidation.length,
      topFocus: topFocus.length,
      avgPriorityScore:
        active.length > 0
          ? active.reduce((sum, row) => sum + row.priorityScore, 0) / active.length
          : 0,
    };
  },
});

export const upsert = mutation({
  args: opportunityArgs,
  handler: async (ctx, args) => {
    const existing = args.gapOpportunityId
      ? await ctx.db
          .query("decisionOpportunities")
          .withIndex("by_drug_and_gap_opportunity", (q) =>
            q.eq("drugId", args.drugId).eq("gapOpportunityId", args.gapOpportunityId)
          )
          .unique()
      : args.companyId
        ? await ctx.db
            .query("decisionOpportunities")
            .withIndex("by_drug_and_company", (q) =>
              q.eq("drugId", args.drugId).eq("companyId", args.companyId)
            )
            .unique()
        : null;

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now, lastPromotedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("decisionOpportunities", {
      ...args,
      createdAt: now,
      updatedAt: now,
      lastPromotedAt: now,
    });
  },
});

export const replaceEvidence = mutation({
  args: {
    decisionOpportunityId: v.id("decisionOpportunities"),
    evidence: v.array(evidenceInputValidator),
  },
  handler: async (ctx, { decisionOpportunityId, evidence }) => {
    const existing = await ctx.db
      .query("opportunityEvidence")
      .withIndex("by_decision_opportunity", (q) =>
        q.eq("decisionOpportunityId", decisionOpportunityId)
      )
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }
    const now = Date.now();
    for (const item of evidence) {
      await ctx.db.insert("opportunityEvidence", {
        decisionOpportunityId,
        ...item,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const replaceAliasesForDrug = mutation({
  args: {
    drugId: v.id("drugs"),
    aliases: v.array(aliasInputValidator),
  },
  handler: async (ctx, { drugId, aliases }) => {
    const existing = await ctx.db
      .query("productIdentityAliases")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }
    const now = Date.now();
    for (const alias of aliases) {
      await ctx.db.insert("productIdentityAliases", {
        drugId,
        ...alias,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const applyRankings = mutation({
  args: { orderedIds: v.array(v.id("decisionOpportunities")) },
  handler: async (ctx, { orderedIds }) => {
    for (const [index, id] of orderedIds.entries()) {
      await ctx.db.patch(id, {
        rankingPosition: index + 1,
        updatedAt: Date.now(),
      });
    }
  },
});

export const archiveUntouched = mutation({
  args: { keepIds: v.array(v.id("decisionOpportunities")) },
  handler: async (ctx, { keepIds }) => {
    const all = await ctx.db.query("decisionOpportunities").collect();
    for (const item of all) {
      if (!keepIds.includes(item._id) && item.status !== "archived") {
        await ctx.db.patch(item._id, {
          status: "archived",
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const rebuildFromResearch = action({
  args: {},
  handler: async (ctx): Promise<{ rebuilt: number; focusMarkets: string[] }> => {
    const [companies, drugs, gaps, matches, reports] = await Promise.all([
      ctx.runQuery(api.companies.list, {}),
      ctx.runQuery(api.drugs.list, {}),
      ctx.runQuery(api.gapOpportunities.list, { status: "active" }),
      ctx.runQuery(api.gapCompanyMatches.listAllForEngine, {}),
      ctx.runQuery(api.reports.listAllForEngine, {}),
    ]);

    const companiesById = new Map(companies.map((item) => [item._id, item]));
    const gapsById = new Map(gaps.map((item) => [item._id, item]));
    const reportByDrugId = new Map(reports.map((item) => [item.drugId, item]));
    const touchedIds: Id<"decisionOpportunities">[] = [];

    for (const drug of drugs) {
      const aliases = uniqBy(
        [
          {
            alias: drug.name,
            normalizedAlias: normalizeAlias(drug.name),
            aliasType: "brand" as const,
            confidence: "confirmed" as const,
            notes: "Primary product name from registry",
            source: "internal_registry",
            companyId: drug.companyId ?? undefined,
          },
          {
            alias: drug.genericName,
            normalizedAlias: normalizeAlias(drug.genericName),
            aliasType: "generic" as const,
            confidence: "confirmed" as const,
            notes: "Primary generic / INN from registry",
            source: "internal_registry",
            companyId: drug.companyId ?? undefined,
          },
          drug.primaryManufacturerName
            ? {
                alias: drug.primaryManufacturerName,
                normalizedAlias: normalizeAlias(drug.primaryManufacturerName),
                aliasType: "manufacturer" as const,
                confidence: "likely" as const,
                notes: "Primary manufacturer on drug record",
                source: "internal_registry",
                companyId: drug.companyId ?? undefined,
              }
            : null,
          drug.primaryMarketAuthorizationHolderName
            ? {
                alias: drug.primaryMarketAuthorizationHolderName,
                normalizedAlias: normalizeAlias(drug.primaryMarketAuthorizationHolderName),
                aliasType: "market_authorization_holder" as const,
                confidence: "likely" as const,
                notes: "Primary MAH on drug record",
                source: "internal_registry",
                companyId: drug.companyId ?? undefined,
              }
            : null,
        ].filter((item): item is NonNullable<typeof item> => item !== null),
        (item) => `${item.aliasType}:${item.normalizedAlias}`
      );

      await ctx.runMutation(api.decisionOpportunities.replaceAliasesForDrug, {
        drugId: drug._id,
        aliases,
      });
    }

    for (const match of matches) {
      const company = companiesById.get(match.companyId);
      const gap = gapsById.get(match.gapOpportunityId);
      if (!company || !gap) continue;

      const drug = chooseBestDrug({ company, gap, drugs });
      if (!drug) continue;

      const evidence = collectEvidence({
        gap,
        match,
        company,
        reportByDrugId,
        drugId: drug._id,
      });

      const draft = buildDecisionOpportunityDraft({
        gap,
        company,
        drug,
        match,
        sourceCount: evidence.length,
      });

      const opportunityId = await ctx.runMutation(api.decisionOpportunities.upsert, {
        ...draft,
        drugId: drug._id,
        companyId: company._id,
        gapOpportunityId: gap._id,
        gapCompanyMatchId: match._id,
      });

      await ctx.runMutation(api.decisionOpportunities.replaceEvidence, {
        decisionOpportunityId: opportunityId,
        evidence,
      });

      touchedIds.push(opportunityId);
    }

    const ranked = (
      await Promise.all(
        touchedIds.map(async (id) => await ctx.runQuery(api.decisionOpportunities.get, { id }))
      )
    )
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => {
        if (left.status !== right.status) {
          if (left.status === "active") return -1;
          if (right.status === "active") return 1;
        }
        return right.priorityScore - left.priorityScore;
      })
      .map((item) => item._id);

    await ctx.runMutation(api.decisionOpportunities.applyRankings, {
      orderedIds: ranked,
    });
    await ctx.runMutation(api.decisionOpportunities.archiveUntouched, {
      keepIds: ranked,
    });

    return {
      rebuilt: ranked.length,
      focusMarkets: [...FOCUS_MARKETS],
    };
  },
});
