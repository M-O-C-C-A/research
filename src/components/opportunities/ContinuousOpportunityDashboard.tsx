"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Activity, AlertTriangle, Database, Eye, FileSearch, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const TARGET_MARKETS = ["Egypt", "Saudi Arabia", "UAE"] as const;
const PRODUCT_CLASSES = [
  ["innovator", "Innovator"],
  ["on_patent", "On patent"],
  ["orphan_rare_disease", "Orphan / rare disease"],
  ["hybrid", "Hybrid"],
  ["off_patent_biosimilar", "Off-patent / biosimilar"],
] as const;
const EXCLUSION_LABELS = [
  ["alreadyRegisteredTarget", "Already registered in a target market"],
  ["top20Pharma", "Owned by a top-20 pharma company"],
  ["menaRightsLicensed", "MENA rights already licensed"],
  ["withdrawnOrSuspended", "Withdrawn or suspended"],
  ["belowMarginFloor", "Below margin floor"],
  ["distributionInfeasible", "Distribution infeasible"],
] as const;

function statusClass(status?: string) {
  switch (status) {
    case "active":
    case "completed":
    case "passed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "stale":
    case "structural_change":
    case "blocked_by_robots":
    case "error":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "partial":
    case "needs_review":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

function formatMoney(value?: number) {
  if (!value) return "UNVALIDATED";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortMoney(value?: number) {
  if (value === undefined || value === null || value <= 0) return "UNVALIDATED";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}bn`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return formatMoney(value);
}

export function ContinuousOpportunityDashboard() {
  const [running, setRunning] = useState(false);
  const [targetMarket, setTargetMarket] = useState<(typeof TARGET_MARKETS)[number] | "All">("All");
  const [productClass, setProductClass] = useState<string>("All");
  const [exclusions, setExclusions] = useState({
    alreadyRegisteredTarget: true,
    top20Pharma: true,
    menaRightsLicensed: true,
    withdrawnOrSuspended: true,
    belowMarginFloor: true,
    distributionInfeasible: true,
  });
  const sourceHealth = useQuery(api.continuousOpportunityEngine.listSourceHealth);
  const latestRun = useQuery(api.continuousOpportunityEngine.getScreeningDashboard, {
    targetMarket: targetMarket === "All" ? undefined : targetMarket,
    productClass: productClass === "All" ? undefined : productClass as "innovator" | "on_patent" | "orphan_rare_disease" | "hybrid" | "off_patent_biosimilar",
    exclusions,
  });
  const changeEvents = useQuery(api.continuousOpportunityEngine.listChangeEvents, { limit: 8 });
  const seedSources = useMutation(api.continuousOpportunityEngine.seedSourceRegistry);
  const rebuildRun = useAction(api.continuousOpportunityEngine.rebuildOpportunityRun);
  const runSources = useAction(api.continuousOpportunityEngine.runDueSourceDispatcher);

  async function seedAndRebuild() {
    setRunning(true);
    try {
      await seedSources({});
      await rebuildRun({ trigger: "manual" });
    } finally {
      setRunning(false);
    }
  }

  async function fetchAndRebuild() {
    setRunning(true);
    try {
      await runSources({});
    } finally {
      setRunning(false);
    }
  }

  const run = latestRun?.run;
  const items = latestRun?.items ?? [];
  const cascade = latestRun?.cascade;
  const passed = run?.passedGateCount ?? 0;
  const candidates = run?.candidateCount ?? 0;
  const excluded = run?.excludedTop20Count ?? 0;
  const registered = run?.targetRegisteredCount ?? 0;

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Continuous Opportunity Engine
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              Screen authorized small-company medicines for Middle East whitespace
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              The engine retains raw source payloads, applies provenance-gated facts, excludes top-20 pharma owners,
              ranks by risk-adjusted margin, and writes change events when the opportunity picture moves.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={seedAndRebuild} disabled={running}>
              <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
              Rebuild run
            </Button>
            <Button onClick={fetchAndRebuild} disabled={running}>
              <Database className="h-4 w-4" />
              Fetch due sources
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            { label: "Candidate universe", value: candidates, icon: FileSearch },
            { label: "Passed gates", value: passed, icon: ShieldCheck },
            { label: "Top-20 excluded", value: excluded, icon: AlertTriangle },
            { label: "Already registered", value: registered, icon: Eye },
            { label: "Visible after filters", value: cascade?.visible ?? 0, icon: Activity },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-300">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                </div>
                <card.icon className="h-5 w-5 text-[var(--brand-300)]" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 border-t border-zinc-800 pt-5 xl:grid-cols-[0.8fr_0.8fr_1.4fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Target market</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["All", ...TARGET_MARKETS] as const).map((market) => (
                <button
                  key={market}
                  type="button"
                  onClick={() => setTargetMarket(market)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    targetMarket === market
                      ? "border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] text-white"
                      : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white"
                  }`}
                >
                  {market}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Product class</p>
            <select
              value={productClass}
              onChange={(event) => setProductClass(event.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[color:var(--brand-border)]"
            >
              <option value="All">All classes</option>
              {PRODUCT_CLASSES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Exclusion rules
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXCLUSION_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={exclusions[key]}
                    onChange={(event) =>
                      setExclusions((current) => ({ ...current, [key]: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-[var(--brand-500)]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">Screen</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Ranked by risk-adjusted KEMEDICA gross margin.
              </p>
            </div>
            {run && (
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClass(run.status)}`}>
                {run.status}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              No immutable run yet. Use Rebuild run to create the first snapshot from current opportunities.
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map((item, index) => {
                const markets = Object.entries(item.peakSalesByMarket ?? {}).map(
                  ([market, value]) => [market, Number(value)] as const
                );
                const maxMarketSales = Math.max(...markets.map(([, value]) => value), 1);
                const sizingIsValidated = item.sizingStatus && item.sizingStatus !== "unvalidated";
                return (
                  <article
                    key={item._id}
                    className="rounded-lg border border-zinc-800 bg-[#141c18] p-5 text-zinc-200 shadow-sm"
                  >
                    <div className="grid gap-4 md:grid-cols-[4rem_minmax(0,1fr)_9rem_9rem]">
                      <p className="font-mono text-lg font-semibold text-zinc-400">
                        {(index + 1).toString().padStart(2, "0")}
                      </p>
                      <div className="min-w-0">
                        {item.decisionOpportunityId ? (
                          <Link href={`/opportunities/${item.decisionOpportunityId}`} className="truncate text-2xl font-semibold text-white hover:text-[var(--brand-300)]">
                            {item.productName}
                          </Link>
                        ) : (
                          <h3 className="truncate text-2xl font-semibold text-white">{item.productName}</h3>
                        )}
                        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                          {item.inn} · {item.companyName} · {item.indication ?? "Indication UNKNOWN"}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{shortMoney(item.peakSalesUsd)}</p>
                        <p className="mt-1 font-mono text-xs uppercase tracking-[0.22em] text-zinc-400">
                          {sizingIsValidated ? "Peak sales" : "Sizing"}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{shortMoney(item.riskAdjustedMargin)}</p>
                        <p className="mt-1 font-mono text-xs uppercase tracking-[0.22em] text-zinc-400">
                          {sizingIsValidated ? "Risk-adj." : "Risk-adj."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-zinc-700/70 pt-5">
                      <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                        Peak in-market sales by market
                      </p>
                      <div className="space-y-3">
                        {markets.length === 0 ? (
                          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                            UNVALIDATED: open the Asset File and add sizing inputs for each target market.
                          </div>
                        ) : markets.map(([market, value]) => (
                          <div key={market} className="grid grid-cols-[9rem_minmax(0,1fr)_5rem] items-center gap-3">
                            <p className="text-sm font-semibold text-white">{market}</p>
                            <div className="h-3 rounded bg-zinc-800">
                              {value > 0 && (
                                <div
                                  className="h-3 rounded bg-emerald-300/70"
                                  style={{ width: `${Math.max(4, Math.min(100, (value / maxMarketSales) * 100))}%` }}
                                />
                              )}
                            </div>
                            <p className="text-right text-sm text-white">{shortMoney(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-relaxed text-zinc-300">
                      {item.gateReasons[0]} {item.cascadeBasis ?? "Rebuild the run to populate the five-step sizing basis."}
                    </p>
                    <div className="mt-5 grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
                      <p className="font-mono uppercase tracking-[0.18em] text-zinc-400">Status</p>
                      <p>
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(item.gateStatus)}`}>
                          {(item.productClass ?? "unclassified").replaceAll("_", " ")}
                        </span>
                      </p>
                      <p className="font-mono uppercase tracking-[0.18em] text-zinc-400">Approvals</p>
                      <p className="text-zinc-300">{item.approvalsSummary ?? item.homeAuthorizationStatus}</p>
                      <p className="font-mono uppercase tracking-[0.18em] text-zinc-400">MENA rights</p>
                      <p className="text-zinc-300">{item.menaRightsSummary ?? item.territoryRightsStatus}</p>
                      <p className="font-mono uppercase tracking-[0.18em] text-zinc-400">KEM margin</p>
                      <p className="text-zinc-300">{shortMoney(item.kemedicaMarginAtPeakUsd)} at peak</p>
                      <p className="font-mono uppercase tracking-[0.18em] text-zinc-400">Sizing basis</p>
                      <p className="text-zinc-300">{item.sizingStatus?.replaceAll("_", " ") ?? "legacy run"}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                Change events
              </h2>
              <Link href="/watchlist" className="text-xs font-medium text-[var(--brand-300)] hover:text-white">
                Open watchlist
              </Link>
            </div>
            <div className="space-y-3">
              {(changeEvents ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">No changes detected yet.</p>
              ) : (
                changeEvents?.map((event) => (
                  <div key={event._id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="flex items-start gap-2">
                      <Activity className="mt-0.5 h-4 w-4 text-[var(--brand-300)]" />
                      <div>
                        <p className="text-sm font-medium text-white">{event.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{event.summary}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                Source health
              </h2>
              <Link href="/review" className="text-xs font-medium text-[var(--brand-300)] hover:text-white">
                Review queue
              </Link>
            </div>
            <div className="space-y-2">
              {(sourceHealth ?? []).slice(0, 8).map((source) => (
                <div key={source._id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{source.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{source.cadence} · {source.sourceRegistry}</p>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium ${statusClass(source.status)}`}>
                    {source.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
              {sourceHealth?.length === 0 && (
                <p className="text-sm text-zinc-500">Seed sources to initialize the registry.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
