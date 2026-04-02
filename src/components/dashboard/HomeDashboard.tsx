"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DecisionOpportunityCards } from "@/components/opportunities/DecisionOpportunityCards";
import { ActionQueueWidget } from "@/components/dashboard/ActionQueueWidget";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import { buttonVariants } from "@/components/ui/button";
import { NextActionCard } from "@/components/shared/NextActionCard";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ArrowRight, Building2, Pill } from "lucide-react";

export function HomeDashboard() {
  const guidedFlow = useQuery(api.dashboard.getGuidedFlow, {});

  const primaryAction = guidedFlow?.primaryAction ?? {
    label: "Start Process",
    title: "Start with a company",
    description: "Add one manufacturer so the app can guide you toward a real opportunity.",
    href: "/companies",
    actionLabel: "Start with a company",
  };

  return (
    <div className="space-y-8">
      <GuidedFlowBanner
        hereLabel="Home command center"
        helperText="Use this page when you want one clear recommendation, quick access to your directories, and a short list of the best commercial opportunities."
      />

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            {BRAND_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            The easiest way to find the next good opportunity
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {BRAND_TAGLINE}. Start the guided process below and the app will tell you what to
            do next, what is blocked, and where the strongest opportunities are right now.
          </p>
        </div>

        <NextActionCard
          label={guidedFlow?.currentStep === "follow_up" ? "Continue Process" : "Start Process"}
          title={primaryAction.label}
          description={primaryAction.description}
          href={primaryAction.href}
          actionLabel={primaryAction.label}
        />
      </section>

      <StatsBar />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-zinc-950 p-3 text-cyan-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Directory
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">Browse companies</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Review target manufacturers, check fit, and launch deeper company or portfolio research.
              </p>
            </div>
          </div>
          <Link
            href="/companies"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            Open company directory
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-zinc-950 p-3 text-cyan-300">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Directory
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">Browse products</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Review products, compare owners and manufacturers, and move straight into whitespace review.
              </p>
            </div>
          </div>
          <Link
            href="/drugs"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            Open product directory
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Continue Where You Left Off
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Your next step is already picked for you
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Use this if you want the simplest path without deciding which page to open.
          </p>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-sm font-semibold text-white">{primaryAction.label}</p>
            <p className="mt-2 text-sm text-zinc-400">{primaryAction.description}</p>
            <Link
              href={primaryAction.href}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
            >
              Open next step
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {(guidedFlow?.blockers?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                What is blocking progress
              </p>
              <div className="mt-2 space-y-1 text-sm text-zinc-300">
                {guidedFlow?.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}
              </div>
            </div>
          )}
        </div>

        <ActionQueueWidget />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Research More
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Start a scan without hunting for the right tool
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Use these shortcuts when you want to enrich your target list, scan for more companies, or jump directly into whitespace review.
            </p>
          </div>
          <DiscoverCompaniesButton label="Research companies" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/companies"
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-700"
          >
            <p className="text-sm font-semibold text-white">Research this company</p>
            <p className="mt-1 text-sm text-zinc-400">
              Open the company directory, choose a target, and run a deeper company or product scan.
            </p>
          </Link>
          <Link
            href="/drugs"
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-700"
          >
            <p className="text-sm font-semibold text-white">Research this product</p>
            <p className="mt-1 text-sm text-zinc-400">
              Open the product directory to review product detail, ownership, and decision-brief coverage.
            </p>
          </Link>
          <Link
            href="/gaps"
            className={cn(
              "rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-700",
              buttonVariants({ variant: "ghost" })
            )}
          >
            <div className="w-full text-left">
              <p className="text-sm font-semibold text-white">Check market opportunity</p>
              <p className="mt-1 text-sm text-zinc-400">
                Go straight to the best opportunity shortlist and review which products are most actionable now.
              </p>
            </div>
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <WorkflowCallout
          eyebrow="Best Opportunities"
          title="If you only review one thing, review this shortlist"
          description="These are the strongest opportunities in the app right now based on market need, route to market, and readiness for outreach."
          href="/gaps"
          actionLabel="See all best opportunities"
        />
        <DecisionOpportunityCards
          title="Best opportunities right now"
          description="The strongest opportunities, explained in plain language."
        />
      </section>

      <WorkflowCallout
        eyebrow="Advanced"
        title="Need deeper research tools?"
        description="Raw discovery jobs, detailed research runs, and supporting analysis are still available when you need them, but most users can stay in the guided process and directories."
        href="/discovery"
        actionLabel="Open advanced tools"
      />
    </div>
  );
}
