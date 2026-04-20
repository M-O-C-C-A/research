import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

function statusWeight(status: Doc<"decisionOpportunities">["status"]) {
  return status === "active" ? 0 : status === "needs_validation" ? 1 : 2;
}

export const getCockpit = query({
  args: {},
  handler: async (ctx) => {
    const [decisionOpportunities, companies, gaps] = await Promise.all([
      ctx.db.query("decisionOpportunities").collect(),
      ctx.db.query("companies").collect(),
      ctx.db
        .query("gapOpportunities")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect(),
    ]);

    const companiesById = new Map<Id<"companies">, Doc<"companies">>(
      companies.map((company) => [company._id, company])
    );

    const ranked = decisionOpportunities
      .filter((item) => item.status !== "archived")
      .sort((left, right) => {
        const rankDelta = (left.rankingPosition ?? 9999) - (right.rankingPosition ?? 9999);
        if (rankDelta !== 0) return rankDelta;
        const statusDelta = statusWeight(left.status) - statusWeight(right.status);
        if (statusDelta !== 0) return statusDelta;
        return right.priorityScore - left.priorityScore;
      });

    const priorityMatches = ranked.slice(0, 6).map((item) => {
      const company = item.companyId ? companiesById.get(item.companyId) : null;
      return {
        id: item._id,
        title: item.title,
        productName: item.productName,
        genericName: item.genericName,
        companyName: company?.name ?? item.approachEntityName,
        focusMarkets: item.focusMarkets,
        secondaryMarkets: item.secondaryMarkets,
        priorityScore: item.priorityScore,
        rankingPosition: item.rankingPosition ?? null,
        confidenceLevel: item.confidenceLevel,
        whyThisMarket: item.whyThisMarket,
        whyNow: item.whyNow,
        howToEnter: item.entryStrategyRationale,
        howToEnterExplanation: item.howToEnterExplanation,
        entryStrategy: item.entryStrategy,
        regulatoryFeasibility: item.regulatoryFeasibility,
        targetRole: item.targetRole,
        companyWebsite: item.companyWebsite ?? company?.website ?? null,
        companyLinkedinUrl: item.companyLinkedinUrl ?? company?.linkedinCompanyUrl ?? null,
        contactName: item.contactName ?? null,
        contactTitle: item.contactTitle ?? null,
        contactEmail: item.contactEmail ?? company?.contactEmail ?? null,
        contactLinkedinUrl: item.contactLinkedinUrl ?? company?.linkedinUrl ?? null,
        status: item.status,
        outreachReady: item.outreachReadiness?.readyToSend ?? false,
        href: `/opportunities/${item._id}`,
      };
    });

    const unlinkedHighValueGaps = gaps.filter((gap) => {
      const linked = ranked.some((item) => item.gapOpportunityId === gap._id);
      return gap.gapScore >= 7 && !linked;
    });

    const actionQueue = [
      ...ranked
        .filter((item) => item.status === "needs_validation")
        .slice(0, 2)
        .map((item) => ({
          id: `validate-${item._id}`,
          title: `Validate identity for ${item.productName}`,
          description: `${item.focusMarkets.join(", ")} cannot be treated as outreach-ready until ownership and local whitespace are confirmed.`,
          actionLabel: "Review evidence",
          href: `/opportunities/${item._id}`,
        })),
      ...ranked
        .filter((item) => item.status === "active" && !item.contactEmail)
        .slice(0, 2)
        .map((item) => ({
          id: `contact-${item._id}`,
          title: `Close contact gap for ${item.productName}`,
          description: `${item.approachEntityName} is promotable, but outreach is still missing a named email-ready contact.`,
          actionLabel: "Open opportunity",
          href: `/opportunities/${item._id}`,
        })),
      ...unlinkedHighValueGaps.slice(0, 2).map((gap) => ({
        id: `gap-${gap._id}`,
        title: `Promote a real opportunity from ${gap.indication}`,
        description: `${gap.targetCountries.slice(0, 2).join(", ")} show strong pull, but no decision-ready partner opportunity is promoted yet.`,
        actionLabel: "Open gap research",
        href: "/gaps",
      })),
    ].slice(0, 5);

    return {
      priorityMatches,
      actionQueue,
      insightSummary: {
        promotedActiveCount: ranked.filter((item) => item.status === "active").length,
        needsValidationCount: ranked.filter((item) => item.status === "needs_validation").length,
        missingContactCount: ranked.filter(
          (item) => item.status === "active" && !item.contactEmail
        ).length,
        unlinkedHighValueGaps: unlinkedHighValueGaps.length,
      },
    };
  },
});

export const getCockpitSnapshot = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.runQuery(api.dashboard.getCockpit, {});
  },
});

export const getGuidedFlow = query({
  args: {},
  handler: async (ctx) => {
    const [companies, drugs, opportunities] = await Promise.all([
      ctx.db.query("companies").collect(),
      ctx.db.query("drugs").collect(),
      ctx.db.query("decisionOpportunities").collect(),
    ]);

    const activePipelineCount = companies.filter((company) => {
      const stage = company.bdStatus;
      return (
        stage === "qualified" ||
        stage === "contacted" ||
        stage === "intro_call" ||
        stage === "data_shared" ||
        stage === "partner_discussion" ||
        stage === "negotiating"
      );
    }).length;

    const ranked = opportunities
      .filter((item) => item.status !== "archived")
      .sort((left, right) => {
        const rankDelta = (left.rankingPosition ?? 9999) - (right.rankingPosition ?? 9999);
        if (rankDelta !== 0) return rankDelta;
        return right.priorityScore - left.priorityScore;
      });

    const bestOpportunity = ranked[0] ?? null;
    const blockedOpportunity =
      ranked.find(
        (item) =>
          item.status === "needs_validation" ||
          !item.outreachReadiness?.readyToSend
      ) ?? null;
    const readyOpportunity =
      ranked.find((item) => item.outreachReadiness?.readyToSend) ?? null;

    const currentStep =
      companies.length === 0
        ? "company"
        : drugs.length === 0
          ? "product"
          : ranked.length === 0
            ? "opportunity"
            : blockedOpportunity
              ? "blockers"
              : readyOpportunity
                ? "outreach"
                : activePipelineCount > 0
                  ? "follow_up"
                  : "opportunity";

    const primaryAction =
      currentStep === "company"
        ? {
            label: "Start with a company",
            description:
              "Add one manufacturer you want to pursue so the rest of the process has something concrete to work with.",
            href: "/companies",
          }
        : currentStep === "product"
          ? {
              label: "Add a product",
              description:
                "Add one product so the system can assess market whitespace, ownership, and opportunity fit.",
              href: "/drugs",
            }
          : currentStep === "opportunity"
            ? {
                label: "Review best opportunity",
                description:
                  "Use the shortlist to see where market need, route to entry, and contact direction are strongest.",
                href: "/gaps",
              }
            : currentStep === "blockers"
              ? {
                  label: "Resolve blocker",
                  description:
                    "A promising opportunity exists, but it still needs confirmation before outreach should begin.",
                  href: blockedOpportunity
                    ? `/opportunities/${blockedOpportunity._id}`
                    : "/gaps",
                }
              : currentStep === "outreach"
                ? {
                    label: "Prepare first outreach",
                    description:
                      "Open the recommended opportunity and use the outreach package to start a real first-touch conversation.",
                    href: readyOpportunity
                      ? `/opportunities/${readyOpportunity._id}`
                      : "/gaps",
                  }
                : {
                    label: "Continue follow-up",
                    description:
                      "You already have active outreach in motion. Pick up the next commercial follow-up from the pipeline.",
                    href: "/pipeline",
                  };

    const blockers = blockedOpportunity?.outreachBlockers ?? [];

    return {
      currentStep,
      primaryAction,
      secondaryAction:
        bestOpportunity != null
          ? {
              label: "See best opportunities",
              href: "/gaps",
            }
          : {
              label: "Open guided process",
              href: "/workflow",
            },
      blockers,
      resumeHref:
        currentStep === "follow_up"
          ? "/pipeline"
          : primaryAction.href,
      bestOpportunityId: bestOpportunity?._id ?? null,
      needsValidationCount: ranked.filter((item) => item.status === "needs_validation").length,
      snapshot: {
        companyCount: companies.length,
        productCount: drugs.length,
        opportunityCount: ranked.length,
        activeOutreachCount: activePipelineCount,
      },
    };
  },
});

export const getGuidedFlowSnapshot = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.runQuery(api.dashboard.getGuidedFlow, {});
  },
});
