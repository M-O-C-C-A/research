"use client";

import Link from "next/link";
import { NextActionCard } from "@/components/shared/NextActionCard";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { ArrowRight, Building2, Pill } from "lucide-react";

export function HomeDashboard() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
            {BRAND_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            The easiest way to find the next good opportunity
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {BRAND_TAGLINE}. Start the guided process below and move through company,
            product, and market research one step at a time.
          </p>
        </div>

        <NextActionCard
          label="Start Process"
          title="Start with a company"
          description="Add one manufacturer so the app can guide you toward a real opportunity."
          href="/companies"
          actionLabel="Start Process"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[color:var(--brand-surface)] p-3 text-[var(--brand-300)]">
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
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-300)] hover:text-[var(--brand-400)]"
          >
            Open company directory
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[color:var(--brand-surface)] p-3 text-[var(--brand-300)]">
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
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-300)] hover:text-[var(--brand-400)]"
          >
            Open product directory
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            Research More
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Start a scan without hunting for the right tool
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Use these shortcuts when you want to enrich your target list, scan for more companies, or jump directly into whitespace review.
          </p>
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
            className="block rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-700 hover:bg-[color:var(--brand-surface)]/40"
          >
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-white">Check market opportunity</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Go straight to the best opportunity shortlist and review which products are most actionable now.
              </p>
            </div>
          </Link>
        </div>
      </section>

      <WorkflowCallout
        eyebrow="Advanced"
        title="Need deeper research tools?"
        description="Raw discovery jobs, detailed research runs, and supporting analysis are still available when you need them."
        href="/discovery"
        actionLabel="Open advanced tools"
      />
    </div>
  );
}
