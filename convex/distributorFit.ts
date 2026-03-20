import { Doc } from "./_generated/dataModel";

export const ACTIVE_PIPELINE_STAGES = [
  "screened",
  "qualified",
  "contacted",
  "intro_call",
  "data_shared",
  "partner_discussion",
  "negotiating",
  "won",
  "lost",
] as const;

export type ActivePipelineStage = (typeof ACTIVE_PIPELINE_STAGES)[number];

export function normalizePipelineStage(
  status?: string | null
): ActivePipelineStage {
  switch (status) {
    case "qualified":
    case "contacted":
    case "intro_call":
    case "data_shared":
    case "partner_discussion":
    case "negotiating":
    case "won":
    case "lost":
    case "screened":
      return status;
    case "prospect":
      return "screened";
    case "engaged":
      return "partner_discussion";
    case "contracted":
      return "won";
    case "disqualified":
      return "lost";
    default:
      return "screened";
  }
}

export function computeDistributorFitMetrics(args: {
  companySize?: "sme" | "mid" | "large" | null;
  menaPresence?: "none" | "limited" | "established" | null;
  patentUrgencyScore?: number | null;
  menaRegistrationCount?: number | null;
  portfolioBreadth?: number;
  hasPartneringSignals?: boolean;
  hasExportSignals?: boolean;
  hasRegulatoryReadiness?: boolean;
}) {
  const sizeScore =
    args.companySize === "sme" ? 3 :
    args.companySize === "mid" ? 2 : 0;
  const channelScore =
    args.menaPresence === "none" ? 3 :
    args.menaPresence === "limited" ? 1 : -2;
  const urgencyScore =
    (args.patentUrgencyScore ?? 0) >= 8 ? 1.5 :
    (args.patentUrgencyScore ?? 0) >= 6 ? 1 : 0;
  const whitespaceScore =
    (args.menaRegistrationCount ?? 0) === 0 ? 1.5 :
    (args.menaRegistrationCount ?? 0) <= 2 ? 0.5 : -1;
  const focusScore =
    (args.portfolioBreadth ?? 0) > 0 && (args.portfolioBreadth ?? 0) <= 8 ? 1 : 0.5;
  const partneringScore = args.hasPartneringSignals ? 1 : 0;
  const exportScore = args.hasExportSignals ? 0.5 : 0;
  const readinessScore = args.hasRegulatoryReadiness ? 0.5 : 0;

  const score = Math.max(
    0,
    Math.min(
      10,
      sizeScore +
        channelScore +
        urgencyScore +
        whitespaceScore +
        focusScore +
        partneringScore +
        exportScore +
        readinessScore
    )
  );

  const exportReadiness: "low" | "medium" | "high" =
    readinessScore + exportScore + partneringScore >= 1.5
      ? "high"
      : readinessScore + exportScore + partneringScore >= 0.5
        ? "medium"
        : "low";

  const priorityTier: "tier_1" | "tier_2" | "tier_3" | "deprioritized" =
    score >= 8
      ? "tier_1"
      : score >= 6
        ? "tier_2"
        : score >= 4
          ? "tier_3"
          : "deprioritized";

  return { score, exportReadiness, priorityTier };
}

export function buildDistributorFitRationale(args: {
  companyName: string;
  companySize?: "sme" | "mid" | "large" | null;
  menaPresence?: "none" | "limited" | "established" | null;
  portfolioFit?: string;
  hasPartneringSignals?: boolean;
  hasExportSignals?: boolean;
  menaRegistrationCount?: number | null;
}) {
  const fragments = [
    args.companySize === "large"
      ? "large manufacturer"
      : `${args.companySize ?? "unknown-size"} manufacturer`,
    args.menaPresence === "none"
      ? "no established MENA channel"
      : args.menaPresence === "limited"
        ? "limited MENA channel presence"
        : "existing MENA channel footprint",
    args.portfolioFit ?? "portfolio fit still being verified",
    args.hasPartneringSignals
      ? "public partnering signals present"
      : "few public partnering signals",
    (args.menaRegistrationCount ?? 0) === 0
      ? "clean MENA whitespace"
      : `${args.menaRegistrationCount ?? 0} known MENA registrations`,
  ];

  return `${args.companyName}: ${fragments.join(" · ")}.`;
}

export function buildDisqualifierReasons(args: {
  companySize?: "sme" | "mid" | "large" | null;
  menaPresence?: "none" | "limited" | "established" | null;
  menaRegistrationCount?: number | null;
  hasPartneringSignals?: boolean;
}) {
  const reasons: string[] = [];
  if (args.companySize === "large") {
    reasons.push("Large manufacturer with likely internal international distribution resources");
  }
  if (args.menaPresence === "established") {
    reasons.push("Established MENA channel footprint reduces distributor-entry need");
  }
  if ((args.menaRegistrationCount ?? 0) > 3) {
    reasons.push("Portfolio already has meaningful MENA registrations");
  }
  if (!args.hasPartneringSignals) {
    reasons.push("Limited public evidence of active partnering or export appetite");
  }
  return reasons;
}

export function summarizeCompanySignals(company: Partial<Doc<"companies">>) {
  const partnerabilitySignals = company.partnerabilitySignals ?? [];
  const hasPartneringSignals =
    partnerabilitySignals.length > 0 ||
    (company.partneringHistory?.length ?? 0) > 0;
  const hasExportSignals =
    (company.exportMarketsKnown?.length ?? 0) > 0 ||
    /export|licens|distribution|partner/i.test(
      `${company.primaryCommercialModel ?? ""} ${company.distributorFitRationale ?? ""}`
    );
  const hasRegulatoryReadiness =
    /ema|approved|gmp|marketed|commercial/i.test(
      `${company.description ?? ""} ${company.manufacturingFootprint ?? ""}`
    );

  return { hasPartneringSignals, hasExportSignals, hasRegulatoryReadiness };
}
