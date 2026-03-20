"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { ArrowRight, Target, TrendingUp } from "lucide-react";

function GapScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-red-500/20 text-red-300"
      : score >= 6
        ? "bg-orange-500/20 text-orange-300"
        : "bg-yellow-500/20 text-yellow-300";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

export function TopGapsWidget() {
  const gaps = useQuery(api.gapOpportunities.listTop, { limit: 5 });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded bg-cyan-500/10 p-1.5">
            <Target className="h-4 w-4 text-cyan-400" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Top Gap Opportunities
          </h2>
        </div>
        <Link
          href="/gaps"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {gaps === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : gaps.length === 0 ? (
        <div className="py-8 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">No gap opportunities yet</p>
          <Link
            href="/gaps"
            className="mt-2 inline-block text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Run Gap Analysis →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {gaps.map((gap) => (
            <Link
              key={gap._id}
              href="/gaps"
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-zinc-800 transition-colors group"
            >
              <GapScoreBadge score={gap.gapScore} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {gap.indication}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {gap.therapeuticArea} · {gap.targetCountries.slice(0, 3).join(", ")}
                  {gap.targetCountries.length > 3 ? ` +${gap.targetCountries.length - 3}` : ""}
                </p>
              </div>
              {gap.regulatoryFeasibility && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  gap.regulatoryFeasibility === "high"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : gap.regulatoryFeasibility === "medium"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-red-500/10 text-red-400"
                }`}>
                  {gap.regulatoryFeasibility}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
