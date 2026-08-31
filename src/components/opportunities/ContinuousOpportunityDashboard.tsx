"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Activity, AlertTriangle, Database, Eye, FileSearch, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function ContinuousOpportunityDashboard() {
  const [running, setRunning] = useState(false);
  const sourceHealth = useQuery(api.continuousOpportunityEngine.listSourceHealth);
  const latestRun = useQuery(api.continuousOpportunityEngine.getLatestRunDashboard);
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

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { label: "Candidate universe", value: candidates, icon: FileSearch },
            { label: "Passed gates", value: passed, icon: ShieldCheck },
            { label: "Top-20 excluded", value: excluded, icon: AlertTriangle },
            { label: "Already registered", value: registered, icon: Eye },
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
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                Latest risk-adjusted screening run
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Ranked by Model 1 / Model 4 expected value and current opportunity score.
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-400">
                  <tr className="border-b border-zinc-800">
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Gate</th>
                    <th className="py-2 pr-3">Risk margin</th>
                    <th className="py-2 pr-3">Model 1 EV</th>
                    <th className="py-2 pr-3">Model 4 EV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map((item) => (
                    <tr key={item._id} className="align-top text-zinc-300">
                      <td className="py-3 pr-3 text-zinc-400">#{item.rankingPosition ?? "—"}</td>
                      <td className="py-3 pr-3">
                        {item.decisionOpportunityId ? (
                          <Link href={`/opportunities/${item.decisionOpportunityId}`} className="font-medium text-white hover:text-[var(--brand-300)]">
                            {item.productName}
                          </Link>
                        ) : (
                          <span className="font-medium text-white">{item.productName}</span>
                        )}
                        <p className="mt-1 text-xs text-zinc-400">{item.inn} · {item.primaryMarket}</p>
                      </td>
                      <td className="py-3 pr-3">{item.companyName}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-medium ${statusClass(item.gateStatus)}`}>
                          {item.gateStatus.replace("_", " ")}
                        </span>
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{item.gateReasons[0]}</p>
                      </td>
                      <td className="py-3 pr-3 font-medium text-white">{item.riskAdjustedMargin.toFixed(2)}</td>
                      <td className="py-3 pr-3">{formatMoney(item.model1ExpectedValue)}</td>
                      <td className="py-3 pr-3">{formatMoney(item.model4ExpectedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
