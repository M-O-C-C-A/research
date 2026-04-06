"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface AnalysisCountry {
  country: string;
  availabilityStatus: string;
  marketedNames: string[];
  genericAvailability: string;
  marketSizeValue?: number;
  marketSizeValueText?: string;
  marketValueCurrency?: string;
  marketSizeUnitsText?: string;
  patientPopulationText?: string;
  prevalenceText?: string;
  incidenceText?: string;
  channelSummary?: string;
  tenderVsPrivateSummary?: string;
  privateChannelShare?: number;
  publicChannelShare?: number;
  hospitalChannelShare?: number;
  channelMix?: { tenderShare?: number };
  marketAccessRoute?: string;
  priorityScore?: number;
  priorityReason?: string;
  availabilityNarrative?: string;
  competitionSummary?: string;
  payerMixSummary?: string;
  evidenceConfidence: string;
  evidenceItems: Array<{
    claim: string;
    title?: string;
    url?: string;
    sourceType: string;
    confidence: string;
  }>;
}

interface AnalysisData {
  product: {
    brandName: string;
  };
  lastAnalyzedAt: number | null;
  countries: AnalysisCountry[];
  summary: {
    availableMarkets: number;
    whitespaceMarkets: number;
    totalPatientPopulation?: number;
    totalMarketValue?: number;
    marketValueCurrency?: string;
    avgPrivateShare?: number;
    avgTenderShare?: number;
    avgHospitalShare?: number;
    avgInsuredShare?: number;
    prevalenceSummary?: string;
    incidenceSummary?: string;
    diseaseBurdenSummary?: string;
    priorityCountries: Array<{
      country: string;
      score?: number;
      reason?: string;
    }>;
  };
}

interface ProductMarketAnalysisPanelProps {
  analysis: AnalysisData;
  mode?: "inline" | "page";
}

function formatAvailabilityStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatGenericAvailability(value: string) {
  return value.replaceAll("_", " ");
}

function formatNumber(value?: number) {
  if (value === undefined) return "Not yet quantified";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value?: number, currency?: string) {
  if (value === undefined) return "Not yet quantified";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency ?? "USD"} ${value.toLocaleString()}`;
  }
}

function formatShare(value?: number) {
  if (value === undefined) return "Proxy pending";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value?: number | null) {
  if (!value) return "Not run yet";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function statusBadgeClass(value: string) {
  switch (value) {
    case "formally_registered":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "tender_formulary_only":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "hospital_import_only":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "not_found":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }
}

export function ProductMarketAnalysisPanel({
  analysis,
  mode = "inline",
}: ProductMarketAnalysisPanelProps) {
  const summary = analysis.summary;

  return (
    <section
      className={
        mode === "page"
          ? "space-y-6"
          : "mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5"
      }
    >
      <div className={mode === "page" ? "rounded-xl border border-zinc-800 bg-zinc-900 p-6" : ""}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-300)]">
              GCC++ Product Market Scan
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {analysis.product.brandName} market availability and opportunity
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              UAE is prioritized first, followed by the remaining GCC++ countries. This view combines
              local availability, branded versus generic presence, market size proxies, disease burden,
              and channel evidence.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Last refreshed</p>
            <p className="mt-1 font-medium text-white">{formatDate(analysis.lastAnalyzedAt)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Available markets" value={`${summary.availableMarkets}`} />
          <SummaryCard label="Whitespace markets" value={`${summary.whitespaceMarkets}`} />
          <SummaryCard
            label="Patient population"
            value={formatNumber(summary.totalPatientPopulation)}
            helper="Addressable/customer proxies where available"
          />
          <SummaryCard
            label="Market value"
            value={formatCurrency(summary.totalMarketValue, summary.marketValueCurrency)}
            helper="Summed annual opportunity/value proxies"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Private share"
            value={formatShare(summary.avgPrivateShare)}
            helper="Average across quantified countries"
          />
          <SummaryCard
            label="Tender share"
            value={formatShare(summary.avgTenderShare)}
            helper="Public tender / procurement proxy"
          />
          <SummaryCard
            label="Hospital share"
            value={formatShare(summary.avgHospitalShare)}
            helper="Private hospital / import-led access"
          />
          <SummaryCard
            label="Insured share"
            value={formatShare(summary.avgInsuredShare)}
            helper="Only shown where reimbursement evidence exists"
          />
        </div>

        {(summary.prevalenceSummary || summary.incidenceSummary || summary.diseaseBurdenSummary) && (
          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Disease burden context</p>
            {summary.prevalenceSummary && (
              <p className="mt-2 text-sm text-zinc-300">
                <span className="text-white">Prevalence:</span> {summary.prevalenceSummary}
              </p>
            )}
            {summary.incidenceSummary && (
              <p className="mt-2 text-sm text-zinc-300">
                <span className="text-white">Incidence:</span> {summary.incidenceSummary}
              </p>
            )}
            {summary.diseaseBurdenSummary && (
              <p className="mt-2 text-sm text-zinc-400">{summary.diseaseBurdenSummary}</p>
            )}
          </div>
        )}

        {summary.priorityCountries.length > 0 && (
          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Priority countries</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {summary.priorityCountries.map((item) => (
                <div
                  key={item.country}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.country}</p>
                    <span className="text-sm font-semibold text-[var(--brand-300)]">
                      {(item.score ?? 0).toFixed(1)}
                    </span>
                  </div>
                  {item.reason && <p className="mt-2 text-sm text-zinc-400">{item.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {analysis.countries.map((row) => (
          <article
            key={row.country}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{row.country}</h3>
                  <Badge className={statusBadgeClass(row.availabilityStatus)}>
                    {formatAvailabilityStatus(row.availabilityStatus)}
                  </Badge>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0">
                    {formatGenericAvailability(row.genericAvailability)}
                  </Badge>
                </div>
                {row.availabilityNarrative && (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {row.availabilityNarrative}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Priority score</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {(row.priorityScore ?? 0).toFixed(1)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Metric label="Marketed names" value={row.marketedNames.join(", ") || "No local name captured"} />
              <Metric label="Patient population" value={row.patientPopulationText ?? "Not yet quantified"} />
              <Metric label="Market size (units)" value={row.marketSizeUnitsText ?? "Not yet quantified"} />
              <Metric
                label="Market size (value)"
                value={
                  row.marketSizeValueText ??
                  formatCurrency(row.marketSizeValue, row.marketValueCurrency)
                }
              />
              <Metric label="Prevalence" value={row.prevalenceText ?? "Needs more evidence"} />
              <Metric label="Incidence" value={row.incidenceText ?? "Needs more evidence"} />
              <Metric
                label="Channels"
                value={
                  row.channelSummary ??
                  row.marketAccessRoute?.replaceAll("_", " ") ??
                  "Channel mix pending"
                }
              />
              <Metric
                label="Tender vs private"
                value={row.tenderVsPrivateSummary ?? "Tender/private split pending"}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Pill label={`Private ${formatShare(row.privateChannelShare)}`} />
              <Pill label={`Tender ${formatShare(row.channelMix?.tenderShare ?? row.publicChannelShare)}`} />
              <Pill label={`Hospital ${formatShare(row.hospitalChannelShare)}`} />
              <Pill
                label={
                  row.marketAccessRoute
                    ? row.marketAccessRoute.replaceAll("_", " ")
                    : "route pending"
                }
              />
              <Pill label={`Evidence ${row.evidenceConfidence}`} />
            </div>

            {(row.priorityReason || row.competitionSummary || row.payerMixSummary) && (
              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                {row.priorityReason && (
                  <p className="text-sm text-zinc-300">
                    <span className="text-white">Why prioritize:</span> {row.priorityReason}
                  </p>
                )}
                {row.competitionSummary && (
                  <p className="mt-2 text-sm text-zinc-400">
                    <span className="text-white">Competition:</span> {row.competitionSummary}
                  </p>
                )}
                {row.payerMixSummary && (
                  <p className="mt-2 text-sm text-zinc-400">
                    <span className="text-white">Insured vs out-of-pocket:</span> {row.payerMixSummary}
                  </p>
                )}
              </div>
            )}

            {row.evidenceItems.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Evidence</p>
                <div className="mt-3 space-y-2">
                  {row.evidenceItems.slice(0, mode === "page" ? 4 : 3).map((item, index) => (
                    <div
                      key={`${row.country}-${index}`}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0">
                          {item.sourceType.replaceAll("_", " ")}
                        </Badge>
                        <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-0">
                          {item.confidence}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">{item.claim}</p>
                      {item.url && (
                        <Link
                          href={item.url}
                          target="_blank"
                          className="mt-2 inline-flex text-xs text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                        >
                          {item.title ?? "Open source"}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-1 text-xs text-zinc-500">{helper}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-300">{value}</p>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-zinc-950 px-3 py-1 text-zinc-300">
      {label}
    </span>
  );
}
