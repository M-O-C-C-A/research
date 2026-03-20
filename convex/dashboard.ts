import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { normalizePipelineStage } from "./distributorFit";

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
      return "Generate brief";
    case "review_report":
      return "Review brief";
    case "open_company":
      return "Open manufacturer";
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
  distributorFitScore?: number | null;
  priorityTier?: string | null;
}) {
  const parts = [
    `${args.highOpportunityMarkets} high-opportunity MENA market${
      args.highOpportunityMarkets === 1 ? "" : "s"
    }`,
  ];

  if (args.topCountries.length > 0) {
    parts.push(`launch focus ${args.topCountries.join(", ")}`);
  }
  if (args.bestGap?.indication) {
    parts.push(`gap fit ${args.bestGap.indication}`);
  }
  if (args.distributorFitScore != null) {
    parts.push(`distributor fit ${args.distributorFitScore.toFixed(1)}/10`);
  }
  if (args.priorityTier) {
    parts.push(args.priorityTier.replace("_", " "));
  }

  return parts.join(" · ");
}

export const getCockpit = query({
  args: {},
  handler: async (ctx) => {
    const [companies, drugs, opportunities, reports, gaps, gapMatches] =
      await Promise.all([
        ctx.db.query("companies").collect(),
        ctx.db.query("drugs").collect(),
        ctx.db.query("opportunities").collect(),
        ctx.db.query("reports").collect(),
        ctx.db
          .query("gapOpportunities")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .collect(),
        ctx.db.query("gapCompanyMatches").collect(),
      ]);

    const companyById = new Map<Id<"companies">, Doc<"companies">>(
      companies.map((company) => [company._id, company])
    );
    const reportByDrugId = new Map<Id<"drugs">, Doc<"reports">>(
      reports.map((report) => [report.drugId, report])
    );
    const opportunitiesByDrug = new Map<Id<"drugs">, Doc<"opportunities">[]>();
    const matchesByCompany = new Map<Id<"companies">, Doc<"gapCompanyMatches">[]>();

    for (const opportunity of opportunities) {
      const bucket = opportunitiesByDrug.get(opportunity.drugId) ?? [];
      bucket.push(opportunity);
      opportunitiesByDrug.set(opportunity.drugId, bucket);
    }

    for (const match of gapMatches) {
      const bucket = matchesByCompany.get(match.companyId) ?? [];
      bucket.push(match);
      matchesByCompany.set(match.companyId, bucket);
    }

    const matches = drugs
      .map((drug) => {
        const company = drug.companyId ? companyById.get(drug.companyId) : null;
        const drugOpportunities =
          opportunitiesByDrug
            .get(drug._id)
            ?.filter((opportunity) => opportunity.opportunityScore !== undefined)
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

        const persistedMatch = company
          ? (matchesByCompany.get(company._id) ?? [])
              .sort((left, right) => right.distributorFitScore - left.distributorFitScore)
              .find((match) =>
                match.targetCountries.some((country) => topCountries.includes(country))
              ) ??
            (matchesByCompany.get(company._id) ?? [])
              .sort((left, right) => right.distributorFitScore - left.distributorFitScore)[0]
          : null;

        const bestGap = persistedMatch
          ? gaps.find((gap) => gap._id === persistedMatch.gapOpportunityId) ?? null
          : gaps
              .map((gap) => {
                const overlapCount = gap.targetCountries.filter((country) =>
                  topCountries.includes(country)
                ).length;
                const sameTherapeuticArea =
                  gap.therapeuticArea === drug.therapeuticArea ? 1 : 0;
                const linkedDrug = gap.linkedDrugIds?.includes(drug._id) ? 1 : 0;
                const linkedCompany =
                  company && gap.linkedCompanyIds?.includes(company._id) ? 1 : 0;

                return {
                  gap,
                  fitScore:
                    gap.gapScore +
                    overlapCount * 1.5 +
                    sameTherapeuticArea * 2 +
                    linkedDrug * 4 +
                    linkedCompany * 3,
                };
              })
              .filter((entry) => entry.fitScore > 0)
              .sort((left, right) => right.fitScore - left.fitScore)[0]?.gap ?? null;

        let nextAction: MatchAction = "view_drug";
        let nextHref = `/drugs/${drug._id}`;

        if (!report || report.status === "error") {
          nextAction = report?.status === "error" ? "review_report" : "generate_report";
          nextHref = `/drugs/${drug._id}?tab=report`;
        } else if (
          company &&
          ["screened", "qualified", "contacted"].includes(
            normalizePipelineStage(company.bdStatus)
          )
        ) {
          nextAction = "open_company";
          nextHref = `/companies/${company._id}`;
        } else if (bestGap) {
          nextAction = "review_gap";
          nextHref = "/gaps";
        }

        const distributorFitScore =
          company?.distributorFitScore ?? company?.bdScore ?? persistedMatch?.distributorFitScore ?? 0;
        const controlModifier =
          company?.commercialControlLevel === "full"
            ? 1.2
            : company?.commercialControlLevel === "shared"
              ? 0.6
              : company?.commercialControlLevel === "limited"
                ? -1
                : 0;
        const partnerModifier =
          company?.menaPartnershipStrength === "none"
            ? 1
            : company?.menaPartnershipStrength === "limited"
              ? 0.3
              : company?.menaPartnershipStrength === "moderate"
                ? -0.6
                : company?.menaPartnershipStrength === "entrenched"
                  ? -1.5
                  : 0;
        const compositeScore =
          (bestGap?.gapScore ?? 0) * 1.8 +
          distributorFitScore * 1.5 +
          avgOpportunityScore * 1.2 +
          highOpportunityMarkets +
          controlModifier +
          partnerModifier;

        return {
          drugId: drug._id,
          drugName: drug.name,
          genericName: drug.genericName,
          therapeuticArea: drug.therapeuticArea,
          companyId: company?._id ?? null,
          companyName: company?.name ?? drug.manufacturerName ?? "Unknown manufacturer",
          reportStatus: report?.status ?? "missing",
          avgOpportunityScore: Number(avgOpportunityScore.toFixed(1)),
          highOpportunityMarkets,
          topCountries,
          bdStatus: company?.bdStatus ?? null,
          bdScore: distributorFitScore,
          gapId: bestGap?._id ?? null,
          gapIndication: bestGap?.indication ?? null,
          gapScore: bestGap ? Number(bestGap.gapScore.toFixed(1)) : null,
          priorityTier: company?.priorityTier ?? persistedMatch?.priorityTier ?? null,
          rationale: buildMatchRationale({
            highOpportunityMarkets,
            topCountries,
            bestGap,
            distributorFitScore,
            priorityTier: company?.priorityTier ?? persistedMatch?.priorityTier ?? null,
          }),
          nextAction,
          nextActionLabel: toActionLabel(nextAction),
          nextHref,
          compositeScore,
        };
      })
      .filter(
        (match): match is NonNullable<typeof match> =>
          match !== null && match.highOpportunityMarkets > 0
      )
      .sort((left, right) => right.compositeScore - left.compositeScore);

    const priorityMatches = matches.slice(0, 4);

    const actionQueue = [
      ...matches
        .filter((match) => match.reportStatus === "missing")
        .slice(0, 2)
        .map((match) => ({
          id: `report-${match.drugId}`,
          title: `Generate pursuit brief for ${match.drugName}`,
          description: `${match.highOpportunityMarkets} high-potential market${
            match.highOpportunityMarkets === 1 ? "" : "s"
          } and ${match.bdScore.toFixed(1)}/10 distributor fit.`,
          action: "generate_report" as const,
          actionLabel: toActionLabel("generate_report"),
          href: `/drugs/${match.drugId}?tab=report`,
        })),
      ...matches
        .filter(
          (match) =>
            match.companyId &&
            ["screened", "qualified", "contacted"].includes(
              normalizePipelineStage(match.bdStatus)
            )
        )
        .slice(0, 2)
        .map((match) => ({
          id: `pipeline-${match.companyId}`,
          title: `Qualify ${match.companyName} for MENA outreach`,
          description: `${match.drugName} already maps to ${match.topCountries.join(
            ", "
          )} with strong gap-first pull.`,
          action: "advance_pipeline" as const,
          actionLabel: toActionLabel("advance_pipeline"),
          href: `/companies/${match.companyId}`,
        })),
      ...gaps
        .filter(
          (gap) =>
            gap.gapScore >= 7 &&
            (!gap.linkedCompanyIds || gap.linkedCompanyIds.length === 0)
        )
        .slice(0, 2)
        .map((gap) => ({
          id: `gap-${gap._id}`,
          title: `Source manufacturers for ${gap.indication}`,
          description: `${gap.targetCountries.slice(0, 3).join(", ")} still lack shortlisted EU suppliers.`,
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
            (!gap.linkedCompanyIds || gap.linkedCompanyIds.length === 0)
        ).length,
      },
    };
  },
});
