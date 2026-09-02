import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

const ninetyDays = 90 * 24 * 60 * 60 * 1_000;

export const candidateOpportunitiesToCanonical = migrations.define({
  table: "candidateOpportunities",
  migrateOne: async (ctx, candidate) => {
    const migrationKey = `candidate:${candidate._id}`;
    let opportunity = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_migration_key", (q) => q.eq("migrationKey", migrationKey))
      .unique();
    if (!opportunity) {
      opportunity = (await ctx.db
        .query("decisionOpportunities")
        .withIndex("by_drug_and_company", (q) => q.eq("drugId", candidate.drugId).eq("companyId", candidate.companyId))
        .take(1))[0];
    }
    const now = Date.now();
    if (!opportunity) {
      const opportunityId = await ctx.db.insert("decisionOpportunities", {
        drugId: candidate.drugId,
        companyId: candidate.companyId,
        title: `${candidate.productName} — ${candidate.targetCountry}`,
        status: "needs_validation",
        therapeuticArea: "Specialty medicine",
        productName: candidate.productName,
        genericName: candidate.genericName,
        approachEntityName: candidate.approachEntityName,
        approachEntityRole: "unknown",
        focusMarkets: candidate.targetCountries,
        gapType: "mixed",
        productIdentityStatus: "likely",
        gapSummary: candidate.rankRationale,
        commercialRationale: candidate.rankRationale,
        marketAttractiveness: "Migrated from the historical candidate queue; country evidence requires review.",
        demandProxy: candidate.qualificationReasons.join("; "),
        competitivePressure: "Needs review",
        regulatoryFeasibility: "unknown",
        timelineRange: "Needs review",
        keyConstraint: candidate.blockers.join("; ") || "Evidence review required",
        entryStrategy: "watch",
        entryStrategyRationale: "Select a flexible KEMEDICA mandate after country-level review.",
        whyThisMarket: candidate.rankRationale,
        whyNow: candidate.qualificationReasons.join("; "),
        whyThisPartner: "Ownership and territory rights require analyst confirmation.",
        targetRole: "International business development or licensing",
        contactName: candidate.contactName,
        contactTitle: candidate.contactTitle,
        contactConfidence: candidate.contactName ? "likely" : "none",
        outreachSubject: `${candidate.productName} — market-entry discussion`,
        outreachDraft: "Prepared only after country evidence and contact review.",
        confidenceLevel: "low",
        confidenceSummary: "Migrated historical candidate; not contact-ready.",
        assumptions: ["Historical source migrated without upgrading evidence confidence."],
        sourceCount: candidate.sourceSystems.length,
        priorityScore: candidate.rankScore,
        scoreBreakdown: {
          gapValidity: candidate.rankScore,
          commercialValue: candidate.rankScore,
          urgency: candidate.origin === "quick_win_signal" ? 75 : 50,
          feasibility: 40,
          partnerReachability: candidate.contactName ? 60 : 20,
          evidenceConfidence: 40,
        },
        scoreExplanation: candidate.rankRationale,
        whyThisMarketExplanation: candidate.rankRationale,
        whyNowExplanation: candidate.qualificationReasons.join("; "),
        howToEnterExplanation: "Representation, licensing, distribution management, or market-entry support.",
        whyThisPartnerExplanation: "Requires territory-rights review.",
        funnelStage: "needs_evidence",
        staleAfter: candidate.staleAfter,
        migrationKey,
        legacySource: "candidate_opportunity",
        createdAt: candidate.createdAt,
        updatedAt: now,
        lastPromotedAt: candidate.lastQualifiedAt,
      });
      opportunity = await ctx.db.get(opportunityId);
    }
    if (!opportunity) throw new Error("Failed to create canonical opportunity");
    const existingAssessment = await ctx.db.query("opportunityMarketAssessments")
      .withIndex("by_opportunity_and_country", (q) => q.eq("decisionOpportunityId", opportunity!._id).eq("country", candidate.targetCountry)).unique();
    if (!existingAssessment) {
      await ctx.db.insert("opportunityMarketAssessments", {
        decisionOpportunityId: opportunity._id,
        country: candidate.targetCountry,
        stage: "needs_evidence",
        productIdentityConfirmed: false,
        ownerConfirmed: false,
        registrationStatus: "not_found_unverified",
        registrationEvidence: "Historical candidate did not contain an authorized absence determination.",
        rightsStatus: "needs_review",
        presenceStatement: `Partner and rights review pending as of ${new Date(now).toISOString().slice(0, 10)}.`,
        agentPartnerEvidence: "No reviewed country-specific rights evidence migrated.",
        demandStrength: candidate.origin === "quick_win_signal" ? "medium" : "weak",
        strongSignalCount: 0,
        mediumSignalCount: candidate.origin === "quick_win_signal" ? 1 : 0,
        demandSummary: candidate.qualificationReasons.join("; "),
        competitionSummary: "Needs review",
        economicsStatus: "unvalidated",
        economicsSummary: "UNVALIDATED — historical score is not commercial sizing.",
        feasibilityReviewed: false,
        feasibilitySummary: "Needs analyst review",
        blockers: [...candidate.blockers, "Authorized registration absence, territory rights, feasibility, and economics require review."],
        scoreBreakdown: {
          gapValidity: Math.min(candidate.rankScore, 60), commercialValue: 40,
          urgencyDemand: candidate.origin === "quick_win_signal" ? 60 : 35,
          regulatoryFeasibility: 30, partnerRightsReachability: candidate.contactName ? 50 : 20, evidenceConfidence: 35,
        },
        weightedScore: Math.min(candidate.rankScore, 49),
        criticalReviewOpen: true,
        evidenceObservedAt: candidate.evidenceObservedAt,
        staleAfter: candidate.staleAfter || now + ninetyDays,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const actionableLeadsToCanonical = migrations.define({
  table: "actionableLeads",
  migrateOne: async (ctx, lead) => {
    const migrationKey = `actionable:${lead._id}`;
    let opportunity = await ctx.db.query("decisionOpportunities")
      .withIndex("by_migration_key", (q) => q.eq("migrationKey", migrationKey)).unique();
    if (!opportunity) {
      opportunity = (await ctx.db.query("decisionOpportunities")
        .withIndex("by_drug_and_company", (q) => q.eq("drugId", lead.drugId).eq("companyId", lead.companyId)).take(1))[0];
    }
    const now = Date.now();
    if (!opportunity) {
      const id = await ctx.db.insert("decisionOpportunities", {
        drugId: lead.drugId, companyId: lead.companyId, title: `${lead.productName} — ${lead.country}`,
        status: "needs_validation", therapeuticArea: "Specialty medicine", productName: lead.productName,
        genericName: lead.genericName, approachEntityName: lead.approachEntityName, approachEntityRole: "unknown",
        focusMarkets: [lead.country], gapType: lead.signalType === "shortage" ? "shortage_gap" : lead.signalType === "tender" ? "tender_pull" : "mixed",
        productIdentityStatus: "likely", gapSummary: lead.signalTitle, commercialRationale: lead.rankRationale ?? lead.signalTitle,
        marketAttractiveness: lead.signalTitle, demandProxy: lead.signalTitle, competitivePressure: "Needs review",
        regulatoryFeasibility: "unknown", timelineRange: "Needs review", keyConstraint: lead.blockers?.join("; ") || "Country rights review required",
        entryStrategy: "watch", entryStrategyRationale: "Determine flexible mandate after review.", whyThisMarket: lead.signalTitle,
        whyNow: lead.signalTitle, whyThisPartner: "Ownership and rights require confirmation.", targetRole: lead.contactTitle,
        contactName: lead.contactName, contactTitle: lead.contactTitle,
        contactConfidence: "likely", outreachSubject: `${lead.productName} — ${lead.country} market-entry discussion`,
        outreachDraft: "Historical draft withheld until the unified evidence gate passes.", confidenceLevel: "medium",
        confidenceSummary: "Migrated lead with a market signal and contact; absence, rights, feasibility, and economics remain unverified.",
        assumptions: ["Historical lead status does not imply contact-ready status in the unified funnel."], sourceCount: 1,
        priorityScore: lead.rankScore,
        scoreBreakdown: { gapValidity: 50, commercialValue: 40, urgency: 70, feasibility: 30, partnerReachability: 65, evidenceConfidence: 50 },
        scoreExplanation: lead.rankRationale ?? lead.signalTitle, whyThisMarketExplanation: lead.signalTitle,
        whyNowExplanation: lead.signalTitle, howToEnterExplanation: "Flexible KEMEDICA mandate.",
        whyThisPartnerExplanation: "Named historical contact available; verify freshness.",
        funnelStage: "needs_evidence", staleAfter: lead.staleAfter, migrationKey, legacySource: "actionable_lead",
        createdAt: lead.createdAt, updatedAt: now, lastPromotedAt: lead.lastQualifiedAt,
      });
      opportunity = await ctx.db.get(id);
    }
    if (!opportunity) throw new Error("Failed to create canonical opportunity");
    const existingAssessment = await ctx.db.query("opportunityMarketAssessments")
      .withIndex("by_opportunity_and_country", (q) => q.eq("decisionOpportunityId", opportunity!._id).eq("country", lead.country)).unique();
    if (!existingAssessment) {
      await ctx.db.insert("opportunityMarketAssessments", {
        decisionOpportunityId: opportunity._id, country: lead.country, stage: "needs_evidence",
        productIdentityConfirmed: false, ownerConfirmed: false, registrationStatus: "not_found_unverified",
        registrationEvidence: "Historical lead did not include an authorized absence determination.", rightsStatus: "needs_review",
        presenceStatement: `No reviewed product-specific partner conclusion as of ${new Date(now).toISOString().slice(0, 10)}.`,
        agentPartnerEvidence: "Needs analyst approval.", demandStrength: "strong", strongSignalCount: 1, mediumSignalCount: 0,
        demandSummary: lead.signalTitle, competitionSummary: "Needs review", economicsStatus: "unvalidated",
        economicsSummary: "UNVALIDATED — demand evidence does not establish commercial value.", feasibilityReviewed: false,
        feasibilitySummary: "Needs analyst review", blockers: [...(lead.blockers ?? []), "Authorized absence, rights, feasibility, and economics require review."],
        scoreBreakdown: { gapValidity: 45, commercialValue: 40, urgencyDemand: 70, regulatoryFeasibility: 30, partnerRightsReachability: 55, evidenceConfidence: 50 },
        weightedScore: Math.min(lead.rankScore, 55), criticalReviewOpen: true,
        evidenceObservedAt: lead.lastQualifiedAt, staleAfter: lead.staleAfter || now + ninetyDays, createdAt: now, updatedAt: now,
      });
    }
    const linked = await ctx.db.query("opportunitySignalLinks")
      .withIndex("by_opportunity", (q) => q.eq("decisionOpportunityId", opportunity!._id)).take(100);
    if (!linked.some((item) => item.marketSignalId === lead.signalId)) {
      await ctx.db.insert("opportunitySignalLinks", {
        decisionOpportunityId: opportunity._id, marketSignalId: lead.signalId, title: lead.signalTitle,
        sourceUrl: lead.sourceUrl, sourceType: lead.signalType, evidenceStrength: "strong", observedAt: lead.lastQualifiedAt,
        parserVersion: "legacy-migration-v1", confidence: "likely", reviewState: "pending", createdAt: now,
      });
    }
  },
});

export const run = migrations.runner();
