"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { confidenceBadgeClass, entryStrategyLabel, statusBadgeClass } from "@/lib/decisionOpportunities";
import { ArrowRight, Globe2, Mail, Target } from "lucide-react";

interface MenaOpportunityGridProps {
  drugId: string;
}

export function MenaOpportunityGrid({ drugId }: MenaOpportunityGridProps) {
  const opportunities = useQuery(api.decisionOpportunities.listByDrug, {
    drugId: drugId as Id<"drugs">,
  });

  if (opportunities === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded bg-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center">
        <Target className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
        <p className="text-sm text-zinc-500">
          This product does not have a promoted decision opportunity yet. Rebuild the opportunity engine after refreshing research.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {opportunities.map((item) => (
        <Link
          key={item._id}
          href={`/opportunities/${item._id}`}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-400">
                  Rank #{item.rankingPosition ?? "—"}
                </span>
                <span className={`inline-flex rounded-md px-2 py-1 text-xs ${statusBadgeClass(item.status)}`}>
                  {item.status.replace("_", " ")}
                </span>
                <span className={`inline-flex rounded-md px-2 py-1 text-xs ${confidenceBadgeClass(item.confidenceLevel)}`}>
                  {item.confidenceLevel} confidence
                </span>
              </div>
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{item.approachEntityName}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{item.priorityScore.toFixed(1)}</p>
              <p className="text-xs text-zinc-500">priority</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Markets</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.focusMarkets.map((country) => (
                  <span
                    key={country}
                    className="inline-flex items-center rounded bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300"
                  >
                    <Globe2 className="mr-1 h-3 w-3" />
                    {country}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Route To Entry</p>
              <p className="mt-2 text-sm text-zinc-300">
                {entryStrategyLabel(item.entryStrategy)} · {item.timelineRange}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Contact Direction</p>
              <p className="mt-2 text-sm text-zinc-300">
                {item.contactName ?? item.targetRole}
              </p>
              {item.contactEmail && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400">
                  <Mail className="h-3 w-3" />
                  {item.contactEmail}
                </p>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-400">{item.whyThisMarket}</p>

          <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan-400">
            Open decision opportunity
            <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      ))}
    </div>
  );
}
