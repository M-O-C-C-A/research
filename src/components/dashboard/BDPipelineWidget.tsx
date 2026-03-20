"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";

const STAGES = [
  { key: "prospect", label: "Prospect", color: "bg-zinc-500" },
  { key: "contacted", label: "Contacted", color: "bg-blue-500" },
  { key: "engaged", label: "Engaged", color: "bg-indigo-500" },
  { key: "negotiating", label: "Negotiating", color: "bg-violet-500" },
  { key: "contracted", label: "Contracted", color: "bg-emerald-500" },
];

export function BDPipelineWidget() {
  const stats = useQuery(api.companies.pipelineStats, {});

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded bg-orange-500/10 p-1.5">
            <GitBranch className="h-4 w-4 text-orange-400" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            BD Pipeline
          </h2>
        </div>
        <Link
          href="/pipeline"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View pipeline <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {stats === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : stats.total === 0 ? (
        <div className="py-8 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">No companies in pipeline yet</p>
          <Link
            href="/companies"
            className="mt-2 inline-block text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            Discover companies →
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {STAGES.map((stage) => {
            const count = stats.counts[stage.key] ?? 0;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">{stage.label}</span>
                  <span className="text-xs font-medium text-white tabular-nums">
                    {count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800">
                  <div
                    className={`h-1.5 rounded-full transition-all ${stage.color}`}
                    style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="pt-1 flex items-center justify-between">
            <span className="text-xs text-zinc-600">{stats.total} total companies</span>
            <span className="text-xs text-emerald-400 font-medium">
              {stats.counts.contracted ?? 0} contracted
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
