/** Shared, deterministic v1.2 calculations. No inferred commercial inputs. */
export const POLICY_VERSION = "v1.2";
export const REGIONAL_MARKETS = [
  "UAE",
  "Saudi Arabia",
  "Bahrain",
  "Kuwait",
  "Oman",
  "Qatar",
  "Egypt",
] as const;
export type ChannelStatus =
  | "NONE"
  | "DISTRIBUTOR_ONLY"
  | "EXCLUSIVE_AGENT"
  | "OWN_AFFILIATE"
  | "UNKNOWN";
export type CitedSignal = {
  value: boolean;
  source: string;
  observedAt: number;
};
export type ChannelEvidence = {
  country: string;
  status: ChannelStatus;
  partner: string;
  productScope: string;
  source: string;
  observedAt: number;
};
export type CompanyFitInput = {
  channels: ChannelEvidence[];
  staffCount?: number;
  staffSource: string;
  staffObservedAt?: number;
  outLicensed: CitedSignal;
  partneringContact: CitedSignal;
  conferenceExhibitor: CitedSignal;
};
const channelPoints: Record<ChannelStatus, number> = {
  NONE: 40,
  DISTRIBUTOR_ONLY: 20,
  UNKNOWN: 5,
  EXCLUSIVE_AGENT: -30,
  OWN_AFFILIATE: -40,
};
export function calculateCompanyFit(input: CompanyFitInput, now = Date.now()) {
  const current = (source: string, date?: number) =>
    Boolean(
      source.trim() && date && date <= now && now - date <= 365 * 86400000,
    );
  const evidence = input.channels.filter(
    (c) =>
      REGIONAL_MARKETS.includes(
        c.country as (typeof REGIONAL_MARKETS)[number],
      ) && current(c.source, c.observedAt),
  );
  const status: ChannelStatus = evidence.some(
    (c) => c.status === "OWN_AFFILIATE",
  )
    ? "OWN_AFFILIATE"
    : evidence.some((c) => c.status === "EXCLUSIVE_AGENT")
      ? "EXCLUSIVE_AGENT"
      : evidence.some((c) => c.status === "DISTRIBUTOR_ONLY")
        ? "DISTRIBUTOR_ONLY"
        : REGIONAL_MARKETS.every(
              (country) =>
                evidence.some(
                  (c) => c.country === country && c.status === "NONE",
                ) &&
                !evidence.some(
                  (c) => c.country === country && c.status === "UNKNOWN",
                ),
            )
          ? "NONE"
          : "UNKNOWN";
  const size =
    input.staffCount !== undefined &&
    Number.isInteger(input.staffCount) &&
    input.staffCount >= 0 &&
    current(input.staffSource, input.staffObservedAt)
      ? input.staffCount < 250
        ? "SMALL"
        : input.staffCount <= 5000
          ? "MID"
          : "LARGE"
      : "UNKNOWN";
  const signal = (s: CitedSignal, points: number) =>
    s.value && current(s.source, s.observedAt) ? points : 0;
  const contributions = {
    mena_channel_status: channelPoints[status],
    out_licensed_other_emerging_region: signal(input.outLicensed, 35),
    partnering_page_or_bd_contact: signal(input.partneringContact, 20),
    partnering_conference_exhibitor: signal(input.conferenceExhibitor, 15),
    company_size:
      size === "SMALL" ? 30 : size === "MID" ? 15 : size === "LARGE" ? -20 : 0,
  };
  return {
    score: Object.values(contributions).reduce((a, b) => a + b, 0),
    contributions,
    channelStatus: status,
    companySize: size,
  };
}

export type ForecastScenario = {
  name: "downside" | "base" | "upside";
  eligiblePatients: number;
  reachablePct: number;
  annualPatientGrowthPct: number;
  adoptionPct: number[];
  unitsPerPatient: number;
  netPrice: number;
  annualPriceGrowthPct: number;
  launchDelayMonths: number;
  kemedicaSharePct: number;
  unitCost: number;
  annualOperatingCost: number;
  upfrontCost: number;
  workingCapitalPct: number;
  probabilityOfSuccessPct: number;
  publicSharePct: number;
  tenderDiscountPct: number;
  reimbursementReachPct: number;
};
export function calculateForecast(input: ForecastScenario) {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error(`${key} must be finite`);
  }
  for (const key of [
    "eligiblePatients",
    "unitsPerPatient",
    "netPrice",
    "unitCost",
    "annualOperatingCost",
    "upfrontCost",
    "launchDelayMonths",
  ] as const) {
    if (input[key] < 0) throw new Error(`${key} cannot be negative`);
  }
  for (const key of [
    "reachablePct",
    "kemedicaSharePct",
    "workingCapitalPct",
    "probabilityOfSuccessPct",
    "publicSharePct",
    "tenderDiscountPct",
    "reimbursementReachPct",
  ] as const) {
    if (input[key] < 0 || input[key] > 100)
      throw new Error(`${key} must be 0–100`);
  }
  if (input.annualPatientGrowthPct < -100 || input.annualPriceGrowthPct < -100)
    throw new Error("Annual growth cannot be below -100%");
  if (
    input.adoptionPct.length !== 5 ||
    input.adoptionPct.some((v) => !Number.isFinite(v) || v < 0 || v > 100)
  )
    throw new Error(
      "Supply five annual adoption percentages between 0 and 100",
    );
  let cumulativeCash = -input.upfrontCost;
  let priorWorkingCapital = 0;
  const years = input.adoptionPct.map((adoption, i) => {
    const activeFraction =
      Math.max(0, Math.min(12, (i + 1) * 12 - input.launchDelayMonths)) / 12;
    const patients =
      ((((((input.eligiblePatients *
        (1 + input.annualPatientGrowthPct / 100) ** i *
        input.reachablePct) /
        100) *
        input.reimbursementReachPct) /
        100) *
        adoption) /
        100) *
      activeFraction;
    const units = patients * input.unitsPerPatient;
    const blendedPrice =
      input.netPrice *
      (1 - ((input.publicSharePct / 100) * input.tenderDiscountPct) / 100);
    const revenue =
      units * blendedPrice * (1 + input.annualPriceGrowthPct / 100) ** i;
    const kemedicaIncome = (revenue * input.kemedicaSharePct) / 100;
    const costs = units * input.unitCost + input.annualOperatingCost;
    const workingCapital = (revenue * input.workingCapitalPct) / 100;
    const cash =
      kemedicaIncome - costs - (workingCapital - priorWorkingCapital);
    priorWorkingCapital = workingCapital;
    cumulativeCash += cash;
    return {
      year: i + 1,
      patients,
      units,
      revenue,
      kemedicaIncome,
      costs,
      workingCapital,
      cash,
      cumulativeCash,
    };
  });
  const paybackYear = years.find((y) => y.cumulativeCash >= 0)?.year ?? null;
  const riskAdjustedCash =
    ((cumulativeCash + input.upfrontCost) * input.probabilityOfSuccessPct) /
      100 -
    input.upfrontCost;
  return { years, cumulativeCash, paybackYear, riskAdjustedCash };
}

export function compareOpportunityRank(
  a: {
    priorityScore: number;
    companyFitScore?: number;
    forecastBaseCashUsd?: number;
  },
  b: {
    priorityScore: number;
    companyFitScore?: number;
    forecastBaseCashUsd?: number;
  },
) {
  return (
    b.priorityScore - a.priorityScore ||
    (b.companyFitScore ?? 5) - (a.companyFitScore ?? 5) ||
    (b.forecastBaseCashUsd ?? -Infinity) -
      (a.forecastBaseCashUsd ?? -Infinity) ||
    0
  );
}

export function registrationLabel(status?: string) {
  return status === "registered"
    ? "Registered"
    : status === "checked_not_registered"
      ? "Not registered in checked registry"
      : "Unresolved";
}
