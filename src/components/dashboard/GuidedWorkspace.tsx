"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ArrowRight, Building2, FileSearch, FileText, GitBranch, Target } from "lucide-react";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { ActionQueueWidget } from "@/components/dashboard/ActionQueueWidget";
import { DecisionOpportunityCards } from "@/components/opportunities/DecisionOpportunityCards";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import { buttonVariants } from "@/components/ui/button";
import { NextActionCard } from "@/components/shared/NextActionCard";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

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
  const loadGuidedFlow = useAction(api.dashboard.getGuidedFlowSnapshot);
  const [guidedFlow, setGuidedFlow] = useState<
    | {
        currentStep: string;
        primaryAction: {
          label: string;
          description: string;
          href: string;
        };
        blockers: string[];
        resumeHref: string;
        bestOpportunityId: string | null;
        needsValidationCount: number;
        snapshot: {
          companyCount: number;
          productCount: number;
          opportunityCount: number;
          activeOutreachCount: number;
        };
      }
    | undefined
  >();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
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
  }, [loadGuidedFlow]);
  const snapshot = guidedFlow?.snapshot;
  const companies = snapshot?.companyCount ?? 0;
  const drugs = snapshot?.productCount ?? 0;
  const opportunities = snapshot?.opportunityCount ?? 0;
  const pipeline = snapshot?.activeOutreachCount ?? 0;
  const needsValidation = guidedFlow?.needsValidationCount ?? 0;

  const currentStage = guidedFlow?.currentStep ?? "company";
  const highlightedStep =
    currentStage === "blockers" || currentStage === "outreach"
      ? "outreach"
      : currentStage === "follow_up"
        ? "pipeline"
        : currentStage;
  const recommendedNextAction = guidedFlow?.primaryAction
    ? {
        label: currentStage === "follow_up" ? "Continue Process" : "Start Process",
        title: guidedFlow.primaryAction.label,
        description: guidedFlow.primaryAction.description,
        href: guidedFlow.primaryAction.href,
        actionLabel: guidedFlow.primaryAction.label,
      }
    : {
        label: "Start Process",
        title: "Start with a company",
        description: "Add one manufacturer so the system can guide you toward a real opportunity.",
        href: "/companies",
        actionLabel: "Start with a company",
      };

  const steps: WorkflowStep[] = [
    {
      key: "company",
      label: "Choose a company",
      description:
        "Start with one manufacturer you care about. This creates the account you will evaluate, contact, and move through outreach.",
      href: "/companies",
      actionLabel: "Open company directory",
      complete: companies > 0,
      icon: Building2,
    },
    {
      key: "product",
      label: "Add the right product",
      description:
        "Add one drug or product so the system can connect manufacturer ownership, market access, and whitespace in MENA.",
      href: "/drugs",
      actionLabel: "Open product directory",
      complete: drugs > 0,
      icon: FileSearch,
    },
    {
      key: "opportunity",
      label: "Review the gap",
      description:
        "Use the opportunity layer to see where the product is missing, what the route to market looks like, and which countries matter most.",
      href: "/gaps",
      actionLabel: "Open opportunities",
      complete: opportunities > 0,
      icon: Target,
    },
    {
      key: "outreach",
      label: "Prepare outreach",
      description:
        "Open the best opportunity, verify blockers, identify the right contact, and use the outreach package to make a confident first approach.",
      href: "/workflow",
      actionLabel: "Open guided flow",
      complete: (guidedFlow?.bestOpportunityId != null) || opportunities > 0,
      icon: FileText,
    },
    {
      key: "pipeline",
      label: "Keep momentum",
      description:
        "Once outreach begins, keep the company moving through follow-up, data requests, and partner discussions without losing context.",
      href: "/pipeline",
      actionLabel: "Open pipeline",
      complete: pipeline > 0,
      icon: GitBranch,
    },
  ];

  return (
    <div className="space-y-8">
      <GuidedFlowBanner
        hereLabel="Start process"
        helperText="Use this page when you want the app to guide you step by step from target selection to outreach and follow-up."
      />

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
            {BRAND_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            One clear process from first idea to real outreach
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {BRAND_TAGLINE}. This page acts like an assistant: one current step, one next step,
            clear blockers, and the best place to focus right now.
          </p>
        </div>

        <NextActionCard {...recommendedNextAction} />
      </section>

      <StatsBar snapshot={snapshot} needsValidationCount={needsValidation} />

      <section className="grid gap-4 lg:grid-cols-2">
        <WorkflowCallout
          eyebrow="Need To Browse First?"
          title="Open the directories before you commit to a path"
          description="If you want to browse targets before following the guided recommendation, use the company and product directories."
          tone="emphasis"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/companies"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
          >
            <p className="text-sm font-semibold text-white">Browse companies</p>
            <p className="mt-1 text-sm text-zinc-500">
              Review manufacturers and decide who is worth pursuing.
            </p>
          </Link>
          <Link
            href="/drugs"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
          >
            <p className="text-sm font-semibold text-white">Browse products</p>
            <p className="mt-1 text-sm text-zinc-500">
              Review products, owners, and route them into whitespace analysis.
            </p>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Guided Process
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">What to do next, step by step</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Stay on this page if you want the app to tell you what to do next without extra decision-making.
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
                          step.key === highlightedStep
                            ? "bg-[color:var(--brand-surface)] text-[var(--brand-300)]"
                            : step.complete
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {step.key === highlightedStep
                          ? "Do this now"
                          : step.complete
                            ? "Done or in motion"
                            : "Coming up"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{step.description}</p>
                    <Link
                      href={step.href}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-300)] hover:text-[var(--brand-400)]"
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

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Progress Snapshot
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-zinc-900/70 px-3 py-3">
                <p className="text-xs text-zinc-500">Promoted opportunities</p>
                <p className="mt-1 text-lg font-semibold text-white">{opportunities}</p>
              </div>
              <div className="rounded-lg bg-zinc-900/70 px-3 py-3">
                <p className="text-xs text-zinc-500">Need validation</p>
                <p className="mt-1 text-lg font-semibold text-white">{needsValidation}</p>
              </div>
              <div className="rounded-lg bg-zinc-900/70 px-3 py-3">
                <p className="text-xs text-zinc-500">Active follow-up</p>
                <p className="mt-1 text-lg font-semibold text-white">{pipeline}</p>
              </div>
            </div>
          </div>

          {(guidedFlow?.blockers?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                What is blocking progress
              </p>
              <div className="mt-2 space-y-1 text-sm text-zinc-300">
                {guidedFlow?.blockers.map((blocker) => (
                  <p key={blocker}>{blocker}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <ActionQueueWidget />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Need More Research?
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Launch a scan and come back to the guided process
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              These actions help when the next step is blocked because you still need more companies, more products, or stronger evidence.
            </p>
          </div>
          <DiscoverCompaniesButton label="Research companies" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/companies"
            className={cn(buttonVariants({ variant: "outline" }), "border-zinc-700 text-zinc-300 hover:text-white")}
          >
            Open company directory
          </Link>
          <Link
            href="/drugs"
            className={cn(buttonVariants({ variant: "outline" }), "border-zinc-700 text-zinc-300 hover:text-white")}
          >
            Open product directory
          </Link>
          <Link
            href="/discovery"
            className={cn(buttonVariants({ variant: "ghost" }), "text-[var(--brand-300)] hover:text-[var(--brand-400)]")}
          >
            View latest research
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <WorkflowCallout
          eyebrow="Best Opportunities"
          title="Where you should focus once the current step is done"
          description="These are the clearest opportunities in the system right now based on market need, route to market, and contact direction."
          href="/gaps"
          actionLabel="Open all opportunities"
        />
        <DecisionOpportunityCards
          title="Best opportunities right now"
          description="Shortlisted plays that are closest to a practical KEMEDICA move."
        />
      </section>

      <WorkflowCallout
        eyebrow="Advanced Tools"
        title="Need deeper research or raw analysis?"
        description="Advanced tools are available when you want to inspect discovery jobs, research runs, or source detail. Most users can stay inside the guided process above."
        href="/discovery"
        actionLabel="Open advanced research"
      />
    </div>
  );
}
