"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ProductMarketAnalysisPanel } from "@/components/drugs/ProductMarketAnalysisPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CanonicalProductOpportunityView({
  productId,
}: {
  productId: string;
}) {
  const [running, setRunning] = useState(false);
  const analysis = useQuery(api.productMarketAnalysis.getByCanonicalProduct, {
    canonicalProductId: productId as Id<"canonicalProducts">,
  });
  const runAnalysis = useAction(api.productMarketAnalysis.analyzeCanonicalProductMarkets);

  async function handleRunAnalysis() {
    if (running) return;
    setRunning(true);
    try {
      await runAnalysis({
        canonicalProductId: productId as Id<"canonicalProducts">,
      });
    } finally {
      setRunning(false);
    }
  }

  if (analysis === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full bg-zinc-900" />
        <Skeleton className="h-60 w-full bg-zinc-900" />
      </div>
    );
  }

  if (!analysis || analysis.countries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-8 text-center">
        <h2 className="text-xl font-semibold text-white">No GCC++ product opportunity snapshot yet</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Run the GCC++ market scan first so we can summarize country availability, disease burden,
          market channels, and commercial opportunity for this product.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => void handleRunAnalysis()} disabled={running}>
            {running ? "Analyzing..." : "Run GCC++ market scan"}
          </Button>
          <Link
            href="/gaps"
            className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
          >
            Compare against all opportunities
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Product-specific GCC++ opportunity
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Evaluate the GCC++ launch path before going back to the global shortlist
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              This page stays focused on the current canonical product. Use it to compare country
              size, patient demand, channel shape, and evidence-backed whitespace before opening the
              broader opportunity workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void handleRunAnalysis()} disabled={running}>
              {running ? "Refreshing..." : "Refresh GCC++ scan"}
            </Button>
            <Link
              href="/gaps"
              className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Compare against all opportunities
            </Link>
          </div>
        </div>
      </div>

      <ProductMarketAnalysisPanel analysis={analysis} mode="page" />
    </div>
  );
}
