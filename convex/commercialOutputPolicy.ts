import type { Infer } from "convex/values";
import type { studyInput } from "./commercialAssessmentValidators";
import { calculateForecast } from "./opportunityAssessmentPolicy";

export function buildCommercialOutput(
  input: Infer<typeof studyInput>,
  now = Date.now(),
) {
  const prices = input.prices.map((p) => {
    if (
      ![p.amount, p.unitsPerPack, p.fxToUsd].every(Number.isFinite) ||
      p.amount < 0 ||
      p.unitsPerPack <= 0 ||
      p.fxToUsd <= 0
    )
      throw new Error(
        "Price amounts, pack units, and FX must be valid positive values (zero price is allowed)",
      );
    const current =
      p.observedAt > 0 &&
      p.observedAt <= now &&
      now - p.observedAt <= 365 * 86400000;
    const validFx =
      p.currency === "USD"
        ? p.fxToUsd === 1
        : p.fxSource.trim() &&
          p.fxObservedAt > 0 &&
          p.fxObservedAt <= now &&
          now - p.fxObservedAt <= 90 * 86400000;
    const validRegion =
      p.kind === "germany_reference"
        ? p.country === "Germany"
        : p.kind === "gcc_registered"
          ? ["UAE", "Saudi Arabia"].includes(p.country)
          : true;
    return {
      ...p,
      unitPriceUsd: (p.amount / p.unitsPerPack) * p.fxToUsd,
      included: Boolean(
        p.comparable &&
        p.source.trim() &&
        p.presentation.trim() &&
        p.priceType.trim() &&
        p.unitBasis === input.unitBasis &&
        current &&
        validFx &&
        validRegion &&
        p.kind !== "directional",
      ),
    };
  });
  const comparable = prices.filter((p) => p.included);
  const corridor = comparable.length
    ? {
        low: Math.min(...comparable.map((p) => p.unitPriceUsd)),
        high: Math.max(...comparable.map((p) => p.unitPriceUsd)),
        unitBasis: input.unitBasis,
        complete:
          comparable.some((p) => p.kind === "germany_reference") &&
          comparable.some((p) => p.kind === "gcc_registered"),
      }
    : null;
  const forecasts = input.scenarios.map((s) => ({
    name: s.name,
    ...calculateForecast(s),
  }));
  const base = input.scenarios.find((s) => s.name === "base");
  const baseResult = forecasts.find((s) => s.name === "base");
  const channel = !base
    ? "Unresolved"
    : base.publicSharePct > 50
      ? "Public / tender"
      : base.publicSharePct === 50
        ? "Mixed public and private"
        : "Private";
  const tenderAvailable = comparable.some((p) => p.kind === "tender");
  const tenderContribution = base
    ? (base.netPrice *
        (1 - base.tenderDiscountPct / 100) *
        base.kemedicaSharePct) /
        100 -
      base.unitCost
    : null;
  const sequence =
    tenderContribution !== null &&
    tenderContribution <= 0 &&
    base &&
    base.publicSharePct > 0
      ? "Revise tender price or costs before public-channel entry: unit contribution is not positive."
      : !base || !input.feasibility.trim() || !input.reimbursement.trim()
        ? "Complete feasibility and reimbursement review before selecting a sequence."
        : base.publicSharePct === 100
          ? "Tender first, subject to procurement eligibility and positive tender economics."
          : tenderAvailable
            ? "Private launch → tender expansion after local evidence and procurement eligibility."
            : "Private launch first; assess tender expansion when a dated benchmark and eligibility are available.";
  const recommendation = {
    channel,
    sequence,
    pricingBand: corridor
      ? `USD ${corridor.low.toFixed(2)}–${corridor.high.toFixed(2)} per ${input.unitBasis} (${corridor.complete ? "Germany + GCC anchors" : "partial corridor"})`
      : "Unvalidated: comparable price anchors needed",
    caution:
      baseResult && baseResult.cumulativeCash <= 0
        ? "Base-case five-year cash outcome is not positive; revise price, volume, costs, or entry route before pursuit."
        : "Recommendation depends on the recorded volume, price and feasibility assumptions.",
  };
  const summary = `${input.startYear}–${input.startYear + 4} forecast in USD. ${forecasts.map((f) => `${f.name}: KEMEDICA cumulative cash ${f.cumulativeCash.toFixed(0)}, payback ${f.paybackYear ? `year ${f.paybackYear}` : "beyond horizon"}`).join("; ")}. Price corridor: ${recommendation.pricingBand}. Channel: ${channel}. ${sequence}`;
  return { prices, corridor, forecasts, recommendation, summary };
}
