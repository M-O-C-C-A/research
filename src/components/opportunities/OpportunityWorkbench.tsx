"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DecisionOpportunityCards } from "./DecisionOpportunityCards";
import { RebuildOpportunityEngineButton } from "./RebuildOpportunityEngineButton";
import { GapsDashboard } from "@/components/gaps/GapsDashboard";
import { ArrowRight, DatabaseZap, FileSearch, Target } from "lucide-react";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";

export function OpportunityWorkbench() {
  const stats = useQuery(api.decisionOpportunities.stats, {});

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Opportunity decisions
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Choose what to pursue next
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Start with the recommended shortlist below. Each card combines market need,
            route to market, and contact direction so you can decide whether to move
            forward without digging through every research screen first.
          </p>
        </div>
        <RebuildOpportunityEngineButton />
      </div>

      <WorkflowCallout
        eyebrow="How To Use This Page"
        title="Read left to right: what it is, why it matters, and what to do next"
        description="A higher priority score means the opportunity looks more commercially attractive overall. Confidence shows how solid the supporting evidence is. Open any opportunity to see the recommended next action, outreach direction, and supporting evidence."
        href="/pipeline"
        actionLabel="Open outreach pipeline"
      />

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
          title="Recommended opportunities"
          description="Start here when you want the strongest opportunities with a clear reason to act and a suggested next move."
        />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Supporting Research Layer
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Use the research layer below when you need to inspect the raw market gap work behind
            the recommendations. Most users can make their next decision from the shortlist above.
          </p>
        </div>
        <GapsDashboard />
      </div>
    </main>
  );
}
