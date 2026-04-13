"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProductOpportunityCards } from "./ProductOpportunityCards";
import { RebuildOpportunityEngineButton } from "./RebuildOpportunityEngineButton";
import { GapsDashboard } from "@/components/gaps/GapsDashboard";
import { ArrowRight, DatabaseZap, FileSearch, Target } from "lucide-react";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";

export function OpportunityWorkbench() {
  const stats = useQuery(api.canonicalOpportunities.productRankingStats, {});
  const guidedFlow = useQuery(api.dashboard.getGuidedFlow, {});

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
            Best Opportunities
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Review the strongest product opportunities first
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            This page is now product-first. It ranks unavailable products in GCC++ by market need
            and by how little MAH, manufacturer, or distributor footprint we can find in-region.
          </p>
        </div>
        <RebuildOpportunityEngineButton />
      </div>

      <WorkflowCallout
        eyebrow="What To Do Here"
        title="Open the top product, confirm whitespace, then prepare outreach"
        description="A higher product score means the product looks missing in GCC++, commercially attractive, and less covered by local partners. Open any card to review the linked entity, anchor-market evidence, and next move."
        href={guidedFlow?.resumeHref ?? "/workflow"}
        actionLabel="Return to guided process"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Product Opportunities",
            value: stats?.totalProductOpportunities ?? 0,
            icon: Target,
            sublabel: "product-led shortlist",
          },
          {
            label: "Confirmed White Space",
            value: stats?.confirmedWhitespace ?? 0,
            icon: FileSearch,
            sublabel: "absent in anchor GCC++ markets",
          },
          {
            label: "No Partner Footprint",
            value: stats?.noPartnerFootprint ?? 0,
            icon: DatabaseZap,
            sublabel: "weak or absent GCC++ links",
          },
          {
            label: "Avg Product Score",
            value: stats?.averageScore?.toFixed(1) ?? "0.0",
            icon: ArrowRight,
            sublabel: "across current product candidates",
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
                <card.icon className="h-5 w-5 text-[var(--brand-300)]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div id="top-opportunities">
        <ProductOpportunityCards
          title="Unavailable products with strong GCC++ need and no partner footprint"
          description="This shortlist ranks canonical products first. It prioritizes products that still look absent across the anchor GCC++ markets, show stronger commercial need, and do not yet show a meaningful MAH, manufacturer, or distributor footprint in-region."
        />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Legacy Gap Workspace</h2>
          <p className="mt-1 text-xs text-zinc-500">
            The older disease-area gap explorer is still available for raw research, but it is no longer the primary Best Opportunities view.
          </p>
        </div>
        <details className="group rounded-xl border border-zinc-800 bg-zinc-950/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-zinc-200">
            <span>Open legacy disease-area gap explorer</span>
            <span className="text-xs text-zinc-500 group-open:hidden">Hidden by default</span>
            <span className="hidden text-xs text-zinc-500 group-open:inline">Expanded</span>
          </summary>
          <div className="border-t border-zinc-800 pt-4">
            <div className="mb-4 px-4">
              <Link
                href="/drugs"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-300)] transition-colors hover:text-[var(--brand-200)]"
              >
                Use the product directory for product-first research
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <GapsDashboard />
          </div>
        </details>
      </div>
    </main>
  );
}
