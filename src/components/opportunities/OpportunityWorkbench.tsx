"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DecisionOpportunityCards } from "./DecisionOpportunityCards";
import { RebuildOpportunityEngineButton } from "./RebuildOpportunityEngineButton";
import { GapsDashboard } from "@/components/gaps/GapsDashboard";
import { ArrowRight, DatabaseZap, FileSearch, Target } from "lucide-react";

export function OpportunityWorkbench() {
  const stats = useQuery(api.decisionOpportunities.stats, {});

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            KEMEDICA Opportunity Engine
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Decision-ready opportunities, not raw gap browsing
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            This view promotes only the opportunities that already connect product, market, route
            to entry, and contact direction into a BD-ready unit.
          </p>
        </div>
        <RebuildOpportunityEngineButton />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Active Opportunities",
            value: stats?.active ?? 0,
            icon: Target,
            sublabel: "shortlisted and promoted",
          },
          {
            label: "Need Validation",
            value: stats?.needsValidation ?? 0,
            icon: FileSearch,
            sublabel: "identity or whitespace still uncertain",
          },
          {
            label: "KSA/UAE Focused",
            value: stats?.topFocus ?? 0,
            icon: DatabaseZap,
            sublabel: "phase 1 launch-market opportunities",
          },
          {
            label: "Avg Priority",
            value: stats?.avgPriorityScore?.toFixed(1) ?? "0.0",
            icon: ArrowRight,
            sublabel: "across active promoted opportunities",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                <p className="mt-1 text-xs text-zinc-600">{card.sublabel}</p>
              </div>
              <div className="rounded-lg bg-zinc-950 p-2.5">
                <card.icon className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div id="top-opportunities">
        <DecisionOpportunityCards
          title="Top Opportunities"
          description="Prioritized KSA/UAE-forward opportunities with explicit justification and outreach context."
        />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Supporting Research Layer
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Gap discovery remains available here, but it now supports the promoted opportunity layer
            above instead of being the primary decision surface.
          </p>
        </div>
        <GapsDashboard />
      </div>
    </main>
  );
}
