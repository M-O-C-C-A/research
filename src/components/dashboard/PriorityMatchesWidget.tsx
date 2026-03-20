"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { ArrowRight, Globe2, Pill, Sparkles, Target } from "lucide-react";
import { CardGridSkeleton } from "@/components/shared/LoadingSkeleton";

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "ready"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "generating"
        ? "bg-blue-500/15 text-blue-400"
        : status === "error"
          ? "bg-red-500/15 text-red-400"
          : "bg-amber-500/15 text-amber-400";

  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {status === "missing" ? "report missing" : status}
    </span>
  );
}

export function PriorityMatchesWidget() {
  const cockpit = useQuery(api.dashboard.getCockpit, {});

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded bg-emerald-500/10 p-1.5">
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Europe to MENA Matches
            </h2>
            <p className="text-xs text-zinc-500">
              Best current links between EU drugs, demand gaps, and BD targets
            </p>
          </div>
        </div>
      </div>

      {cockpit === undefined ? (
        <CardGridSkeleton count={4} />
      ) : cockpit.priorityMatches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
          <Pill className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No strong Europe-to-MENA matches yet. Generate more reports or run gap analysis.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cockpit.priorityMatches.map((match) => (
            <div
              key={match.drugId}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {match.drugName}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {match.genericName} · {match.companyName}
                  </p>
                </div>
                <StatusBadge status={match.reportStatus} />
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-zinc-900 px-3 py-2">
                  <p className="text-zinc-500">Avg opportunity</p>
                  <p className="mt-1 font-medium text-white">
                    {match.avgOpportunityScore.toFixed(1)}/10
                  </p>
                </div>
                <div className="rounded-md bg-zinc-900 px-3 py-2">
                  <p className="text-zinc-500">High-score markets</p>
                  <p className="mt-1 font-medium text-white">
                    {match.highOpportunityMarkets}
                  </p>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {match.topCountries.map((country) => (
                  <span
                    key={country}
                    className="inline-flex items-center rounded bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300"
                  >
                    <Globe2 className="mr-1 h-3 w-3" />
                    {country}
                  </span>
                ))}
                {match.gapIndication && (
                  <span className="inline-flex items-center rounded bg-orange-500/10 px-2 py-1 text-[11px] text-orange-300">
                    <Target className="mr-1 h-3 w-3" />
                    {match.gapIndication}
                  </span>
                )}
              </div>

              <p className="mb-4 line-clamp-2 text-xs text-zinc-400">
                {match.rationale}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">
                  {match.therapeuticArea}
                </span>
                <Link
                  href={match.nextHref}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {match.nextActionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
