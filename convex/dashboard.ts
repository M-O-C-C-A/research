import { query } from "./_generated/server";
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
        targetRole: item.targetRole,
        contactName: item.contactName ?? null,
        status: item.status,
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
