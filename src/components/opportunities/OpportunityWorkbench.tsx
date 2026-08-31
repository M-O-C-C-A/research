"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { DecisionOpportunityCards } from "./DecisionOpportunityCards";
import { RebuildOpportunityEngineButton } from "./RebuildOpportunityEngineButton";
import { ArrowRight, FileSearch, Target } from "lucide-react";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";

export function OpportunityWorkbench() {
  const loadStats = useAction(api.decisionOpportunities.statsSnapshot);
  const loadGuidedFlow = useAction(api.dashboard.getGuidedFlowSnapshot);
  const [stats, setStats] = useState<
    {
      total: number;
      active: number;
      needsValidation: number;
      topFocus: number;
      avgPriorityScore: number;
    } | undefined
  >();
  const [guidedFlow, setGuidedFlow] = useState<{ resumeHref: string } | undefined>();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void loadStats({}).then((result) => {
        if (!cancelled) {
          setStats(result);
        }
      });

      void loadGuidedFlow({}).then((result) => {
        if (!cancelled) {
          setGuidedFlow(result);
        }
      });
    };

    refresh();
    window.addEventListener("decision-opportunities:refresh", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("decision-opportunities:refresh", refresh);
    };
  }, [loadGuidedFlow, loadStats]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
            Historical Research
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Legacy opportunity research
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            This preserved workspace contains the previous scoring and research records. It does not publish leads to the outreach queue.
          </p>
        </div>
        <details className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:w-auto">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">
            Advanced
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <RebuildOpportunityEngineButton />
            <Link
              href="/discovery"
              className="text-sm text-[var(--brand-300)] hover:text-[var(--brand-400)]"
            >
              Open raw research jobs
            </Link>
          </div>
        </details>
      </div>

      <WorkflowCallout
        eyebrow="Decision Flow"
        title="Open the top pursuit, clear blockers, then prepare outreach"
        description="Higher scores indicate better commercial fit. If a card is blocked, resolve the blocker before spending time on outreach."
        href={guidedFlow?.resumeHref ?? "/workflow"}
        actionLabel="Resume next action"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Active",
            value: stats?.active ?? 0,
            icon: Target,
            sublabel: "ready to review",
          },
          {
            label: "Blocked",
            value: stats?.needsValidation ?? 0,
            icon: FileSearch,
            sublabel: "need validation",
          },
          {
            label: "Avg Priority",
            value: stats?.avgPriorityScore?.toFixed(1) ?? "0.0",
            icon: ArrowRight,
            sublabel: "across active pursuits",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-300">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                <p className="mt-1 text-xs text-zinc-400">{card.sublabel}</p>
              </div>
              <div className="rounded-lg bg-zinc-950 p-2.5">
                <card.icon className="h-5 w-5 text-[var(--brand-300)]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div id="top-opportunities">
        <DecisionOpportunityCards
          title="Opportunity shortlist"
          description="The strongest product-company-market pursuits with the clearest next action."
        />
      </div>
    </main>
  );
}
