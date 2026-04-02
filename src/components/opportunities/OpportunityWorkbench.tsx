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
  const guidedFlow = useQuery(api.dashboard.getGuidedFlow, {});

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Best Opportunities
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Review the strongest opportunities first
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            This page is your shortlist of the best opportunities in the system. Start here when
            you want to see what looks commercially attractive, what is blocked, and what is ready
            for outreach.
          </p>
        </div>
        <RebuildOpportunityEngineButton />
      </div>

      <WorkflowCallout
        eyebrow="What To Do Here"
        title="Open the top card, confirm blockers, then prepare outreach"
        description="A higher priority score means the opportunity looks more commercially attractive overall. Open any card to see plain-language reasoning, blockers, and the outreach package."
        href={guidedFlow?.resumeHref ?? "/workflow"}
        actionLabel="Return to guided process"
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          {
            label: "Active Opportunities",
            value: stats?.active ?? 0,
            icon: Target,
            sublabel: "best current opportunities",
          },
          {
            label: "Blocked",
            value: stats?.needsValidation ?? 0,
            icon: FileSearch,
            sublabel: "still need confirmation before outreach",
          },
          {
            label: "KSA/UAE Focused",
            value: stats?.topFocus ?? 0,
            icon: DatabaseZap,
            sublabel: "top launch-market opportunities",
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
          title="Best opportunities right now"
          description="The strongest opportunities with the clearest next action."
        />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Advanced Research Layer
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Use the detailed research layer below only when you need to inspect the raw market work
            behind the shortlist. Most users can stay with the cards above.
          </p>
        </div>
        <GapsDashboard />
      </div>
    </main>
  );
}
