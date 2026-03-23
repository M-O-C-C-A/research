"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowRight, Building2, FileText, GitBranch, Target } from "lucide-react";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { ActionQueueWidget } from "@/components/dashboard/ActionQueueWidget";
import { DecisionOpportunityCards } from "@/components/opportunities/DecisionOpportunityCards";
import { NextActionCard } from "@/components/shared/NextActionCard";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

type WorkflowStep = {
  key: string;
  label: string;
  description: string;
  href: string;
  actionLabel: string;
  complete: boolean;
  icon: ComponentType<{ className?: string }>;
};

export function GuidedWorkspace() {
  const companyStats = useQuery(api.companies.stats, {});
  const drugStats = useQuery(api.drugs.stats, {});
  const oppStats = useQuery(api.decisionOpportunities.stats, {});
  const pipelineStats = useQuery(api.companies.pipelineStats, {});

  const companies = companyStats?.total ?? 0;
  const drugs = drugStats?.total ?? 0;
  const opportunities = oppStats?.active ?? 0;
  const pipeline = pipelineStats?.activeCount ?? 0;

  const recommendedNextAction =
    companies === 0
      ? {
          title: "Add your first company",
          description:
            "Start with one manufacturer you already know. Once it is in the system, you can add products, review opportunity signals, and decide where to focus first.",
          href: "/companies",
          actionLabel: "Open companies",
        }
      : drugs === 0
        ? {
            title: "Add the first drug you want to assess",
            description:
              "A drug record is what turns a company into a concrete opportunity review. Add one product so the platform can help you compare markets and build a decision brief.",
            href: "/drugs",
            actionLabel: "Open drugs",
          }
        : opportunities === 0
          ? {
              title: "Review market signals and shortlist a real opportunity",
              description:
                "You already have enough data to start deciding. Open the opportunities page to see the strongest plays and move from raw research into a recommendation.",
              href: "/gaps",
              actionLabel: "Open opportunities",
            }
          : pipeline === 0
            ? {
                title: "Choose one opportunity and move it into outreach",
                description:
                  "The strongest value now comes from acting on the best-ranked opportunity. Review the recommendation, confirm the next step, and start tracking outreach.",
                href: "/gaps",
                actionLabel: "Review top opportunity",
              }
            : {
                title: "Continue the most urgent follow-up",
                description:
                  "Your workflow is already in motion. Use the action queue below to keep momentum and make the next commercial decision with confidence.",
                href: "/pipeline",
                actionLabel: "Open pipeline",
              };

  const steps: WorkflowStep[] = [
    {
      key: "add-data",
      label: "Add data",
      description:
        "Start by adding a company or drug you want to assess so the rest of the workflow has something concrete to work with.",
      href: companies === 0 ? "/companies" : "/drugs",
      actionLabel: companies === 0 ? "Add a company" : "Add a drug",
      complete: companies > 0 && drugs > 0,
      icon: Building2,
    },
    {
      key: "review-signals",
      label: "Review market signals",
      description:
        "Use the ranked opportunities view to see where there is real whitespace, demand, and a credible route into the market.",
      href: "/gaps",
      actionLabel: "Review opportunities",
      complete: opportunities > 0,
      icon: Target,
    },
    {
      key: "generate-brief",
      label: "Generate brief",
      description:
        "Open a drug and generate a decision brief when you need a business-ready summary of the evidence, market context, and priority actions.",
      href: "/drugs",
      actionLabel: "Open drug briefs",
      complete: drugs > 0,
      icon: FileText,
    },
    {
      key: "track-outreach",
      label: "Track outreach",
      description:
        "Once you have chosen what to pursue, move the company into the pipeline so everyone can see the current stage and next follow-up.",
      href: "/pipeline",
      actionLabel: "Open pipeline",
      complete: pipeline > 0,
      icon: GitBranch,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            {BRAND_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            A simpler path from research to the next commercial decision
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {BRAND_TAGLINE}. Follow the steps below to move from a company or product idea
            to a clear recommendation on what to do next.
          </p>
        </div>

        <NextActionCard {...recommendedNextAction} />
      </section>

      <StatsBar />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Start Here
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Guided workflow</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Each step tells you what to do, why it matters, and where to go next.
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.key}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{step.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          step.complete
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {step.complete ? "In motion" : "Needs attention"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{step.description}</p>
                    <Link
                      href={step.href}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      <step.icon className="h-4 w-4" />
                      {step.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ActionQueueWidget />
      </section>

      <section className="space-y-4">
        <WorkflowCallout
          eyebrow="Where To Decide"
          title="Recommended opportunities"
          description="When you are ready to decide what to pursue, start with the shortlist below. These are the strongest opportunities based on market need, entry path, and outreach direction."
          href="/gaps"
          actionLabel="Open all opportunities"
        />
        <DecisionOpportunityCards
          title="Recommended opportunities"
          description="Shortlisted plays with clear reasons to act, contact direction, and evidence to support the next conversation."
        />
      </section>

      <WorkflowCallout
        eyebrow="Advanced Research"
        title="Need to inspect the raw research behind the recommendations?"
        description="Advanced research tools are still available when you want to review discovery runs or supporting gap analysis in more detail, but most users can stay in the guided workflow above."
        href="/discovery"
        actionLabel="Open advanced research"
      />
    </div>
  );
}
