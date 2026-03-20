import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type MatchAction =
  | "generate_report"
  | "review_report"
  | "open_company"
  | "review_gap"
  | "view_drug";

type QueueAction =
  | "generate_report"
  | "advance_pipeline"
  | "review_gap";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toActionLabel(action: MatchAction | QueueAction): string {
  switch (action) {
    case "generate_report":
      return "Generate report";
    case "review_report":
      return "Review report";
    case "open_company":
      return "Open company";
    case "review_gap":
      return "Review gap";
    case "advance_pipeline":
      return "Advance pipeline";
    case "view_drug":
      return "Open drug";
  }
}

function buildMatchRationale(args: {
  highOpportunityMarkets: number;
  topCountries: string[];
  bestGap?: Doc<"gapOpportunities"> | null;
  bdScore?: number;
}): string {
  const parts = [
    `${args.highOpportunityMarkets} MENA market${
      args.highOpportunityMarkets === 1 ? "" : "s"
    } already score high`,
  ];

  if (args.topCountries.length > 0) {
    parts.push(`strongest pull in ${args.topCountries.join(", ")}`);
  }

  if (args.bestGap?.indication) {
    parts.push(`gap signal aligns with ${args.bestGap.indication}`);
  }

  if (args.bdScore !== undefined) {
    parts.push(`BD score ${args.bdScore.toFixed(1)}/10`);
  }

  return parts.join(" · ");
}

export const getCockpit = query({
  args: {},
  handler: async (ctx) => {
    const [companies, drugs, opportunities, reports, gaps] = await Promise.all([
      ctx.db.query("companies").collect(),
      ctx.db.query("drugs").collect(),
      ctx.db.query("opportunities").collect(),
      ctx.db.query("reports").collect(),
      ctx.db
        .query("gapOpportunities")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect(),
    ]);

    const companyById = new Map<Id<"companies">, Doc<"companies">>(
      companies.map((company) => [company._id, company])
    );
    const reportByDrugId = new Map<Id<"drugs">, Doc<"reports">>(
      reports.map((report) => [report.drugId, report])
    );
    const opportunitiesByDrug = new Map<Id<"drugs">, Doc<"opportunities">[]>();

    for (const opportunity of opportunities) {
      const bucket = opportunitiesByDrug.get(opportunity.drugId) ?? [];
      bucket.push(opportunity);
      opportunitiesByDrug.set(opportunity.drugId, bucket);
    }

    const matches = drugs
      .map((drug) => {
        const company = drug.companyId ? companyById.get(drug.companyId) : null;
        const drugOpportunities =
          opportunitiesByDrug
            .get(drug._id)
            ?.filter(
              (opportunity) => opportunity.opportunityScore !== undefined
            )
            .sort(
              (left, right) =>
                (right.opportunityScore ?? 0) - (left.opportunityScore ?? 0)
            ) ?? [];

        if (drugOpportunities.length === 0) return null;

        const topCountries = drugOpportunities.slice(0, 3).map((item) => item.country);
        const highOpportunityMarkets = drugOpportunities.filter(
          (item) => (item.opportunityScore ?? 0) >= 7
        ).length;
        const avgOpportunityScore = average(
          drugOpportunities.map((item) => item.opportunityScore ?? 0)
        );
        const report = reportByDrugId.get(drug._id) ?? null;

        const bestGap =
          gaps
            .map((gap) => {
              const overlapCount = gap.targetCountries.filter((country) =>
                topCountries.includes(country)
              ).length;
              const sameTherapeuticArea =
                gap.therapeuticArea === drug.therapeuticArea ? 1 : 0;
              const linkedDrug =
                gap.linkedDrugIds?.includes(drug._id) === true ? 1 : 0;
              const linkedCompany =
                company && gap.linkedCompanyIds?.includes(company._id) === true
                  ? 1
                  : 0;
              const fitScore =
                gap.gapScore +
                overlapCount * 1.5 +
                sameTherapeuticArea * 2 +
                linkedDrug * 4 +
                linkedCompany * 3;

              return {
                gap,
                fitScore,
                overlapCount,
              };
            })
            .filter(
              (entry) =>
                entry.overlapCount > 0 ||
                entry.gap.therapeuticArea === drug.therapeuticArea ||
                entry.gap.linkedDrugIds?.includes(drug._id) ||
                (company &&
                  entry.gap.linkedCompanyIds?.includes(company._id) === true)
            )
            .sort((left, right) => right.fitScore - left.fitScore)[0] ?? null;

        let nextAction: MatchAction = "view_drug";
        let nextHref = `/drugs/${drug._id}`;

        if (!report || report.status === "error") {
          nextAction = report?.status === "error" ? "review_report" : "generate_report";
          nextHref = `/drugs/${drug._id}?tab=report`;
        } else if (
          company &&
          (!company.bdStatus || company.bdStatus === "prospect" || company.bdStatus === "contacted")
        ) {
          nextAction = "open_company";
          nextHref = `/companies/${company._id}`;
        } else if (bestGap) {
          nextAction = "review_gap";
          nextHref = "/gaps";
        }

        const compositeScore =
          avgOpportunityScore * 2 +
          highOpportunityMarkets * 1.5 +
          (bestGap?.gap.gapScore ?? 0) * 0.8 +
          (company?.bdScore ?? 0) * 0.4;

        return {
          drugId: drug._id,
          drugName: drug.name,
          genericName: drug.genericName,
          therapeuticArea: drug.therapeuticArea,
          companyId: company?._id ?? null,
          companyName:
            company?.name ?? drug.manufacturerName ?? "Unknown manufacturer",
          reportStatus: report?.status ?? "missing",
          avgOpportunityScore: Number(avgOpportunityScore.toFixed(1)),
          highOpportunityMarkets,
          topCountries,
          bdStatus: company?.bdStatus ?? null,
          bdScore: company?.bdScore ?? null,
          gapId: bestGap?.gap._id ?? null,
          gapIndication: bestGap?.gap.indication ?? null,
          gapScore: bestGap ? Number(bestGap.gap.gapScore.toFixed(1)) : null,
          rationale: buildMatchRationale({
            highOpportunityMarkets,
            topCountries,
            bestGap: bestGap?.gap,
            bdScore: company?.bdScore,
          }),
          nextAction,
          nextActionLabel: toActionLabel(nextAction),
          nextHref,
          compositeScore,
        };
      })
      .filter(
        (
          match
        ): match is NonNullable<typeof match> =>
          match !== null && match.highOpportunityMarkets > 0
      )
      .sort((left, right) => right.compositeScore - left.compositeScore);

    const priorityMatches = matches.slice(0, 4).map((match) => ({
      drugId: match.drugId,
      drugName: match.drugName,
      genericName: match.genericName,
      therapeuticArea: match.therapeuticArea,
      companyId: match.companyId,
      companyName: match.companyName,
      reportStatus: match.reportStatus,
      avgOpportunityScore: match.avgOpportunityScore,
      highOpportunityMarkets: match.highOpportunityMarkets,
      topCountries: match.topCountries,
      bdStatus: match.bdStatus,
      bdScore: match.bdScore,
      gapId: match.gapId,
      gapIndication: match.gapIndication,
      gapScore: match.gapScore,
      rationale: match.rationale,
      nextAction: match.nextAction,
      nextActionLabel: match.nextActionLabel,
      nextHref: match.nextHref,
    }));

    const actionQueue = [
      ...matches
        .filter((match) => match.reportStatus === "missing")
        .slice(0, 2)
        .map((match) => ({
          id: `report-${match.drugId}`,
          title: `Generate MENA report for ${match.drugName}`,
          description: `${match.highOpportunityMarkets} high-potential market${
            match.highOpportunityMarkets === 1 ? "" : "s"
          } identified across ${match.topCountries.join(", ")}.`,
          action: "generate_report" as const,
          actionLabel: toActionLabel("generate_report"),
          href: `/drugs/${match.drugId}?tab=report`,
        })),
      ...matches
        .filter(
          (match) =>
            match.companyId &&
            (!match.bdStatus ||
              match.bdStatus === "prospect" ||
              match.bdStatus === "contacted")
        )
        .slice(0, 2)
        .map((match) => ({
          id: `pipeline-${match.companyId}`,
          title: `Advance ${match.companyName} in BD pipeline`,
          description: `${match.drugName} already shows demand pull in ${match.topCountries.join(
            ", "
          )}.`,
          action: "advance_pipeline" as const,
          actionLabel: toActionLabel("advance_pipeline"),
          href: `/companies/${match.companyId}`,
        })),
      ...gaps
        .filter(
          (gap) =>
            gap.gapScore >= 7 &&
            (!gap.linkedDrugIds || gap.linkedDrugIds.length === 0)
        )
        .slice(0, 2)
        .map((gap) => ({
          id: `gap-${gap._id}`,
          title: `Review unlinked gap in ${gap.therapeuticArea}`,
          description: `${gap.indication} across ${gap.targetCountries
            .slice(0, 3)
            .join(", ")} still has no linked EU drug.`,
          action: "review_gap" as const,
          actionLabel: toActionLabel("review_gap"),
          href: "/gaps",
        })),
    ].slice(0, 5);

    return {
      priorityMatches,
      actionQueue,
      insightSummary: {
        reportCoverageGap: matches.filter((match) => match.reportStatus === "missing")
          .length,
        pipelineReadyCompanies: matches.filter(
          (match) => match.companyId && (match.bdScore ?? 0) >= 7
        ).length,
        unlinkedHighValueGaps: gaps.filter(
          (gap) =>
            gap.gapScore >= 7 &&
            (!gap.linkedDrugIds || gap.linkedDrugIds.length === 0)
        ).length,
      },
    };
  },
});
