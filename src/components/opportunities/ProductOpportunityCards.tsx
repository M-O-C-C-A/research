"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductOpportunityCardsProps {
  title: string;
  description: string;
}

export function ProductOpportunityCards({
  title,
  description,
}: ProductOpportunityCardsProps) {
  const opportunities = useQuery(api.canonicalOpportunities.listProductRankings, {
    limit: 12,
  });

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
            Product-Led GCC++ Whitespace
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{description}</p>
        </div>
        <Link
          href="/drugs"
          className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
        >
          Open product directory
        </Link>
      </div>

      {opportunities === undefined && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-60 w-full bg-zinc-900" />
          ))}
        </div>
      )}

      {opportunities && opportunities.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-400">
          No product-led GCC++ whitespace opportunities are ranked yet. Run the fresh external
          GCC++ refresh from a canonical product or from the Products page first.
        </div>
      )}

      {opportunities && opportunities.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {opportunities.map((item) => (
            <Link
              key={item._id}
              href={`/drugs/catalog/${item.canonicalProductId}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-[var(--brand-500)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{item.brandName}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.inn}</p>
                </div>
                <div className="rounded-lg bg-[var(--brand-500)]/12 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand-300)]">
                    Product score
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">{item.rankingScore.toFixed(1)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <StatusPill label={item.confirmationStatus.replaceAll("_", " ")} tone="brand" />
                <StatusPill label={`Need ${item.needLevel}`} tone="emerald" />
                <StatusPill
                  label={
                    item.presenceStatus === "weak_absent"
                      ? "No GCC++ partners found"
                      : "Partner coverage still unconfirmed"
                  }
                  tone="amber"
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Metric label="Target entity" value={item.recommendedPursuitName ?? "Still deriving"} />
                <Metric label="Role" value={item.recommendedPursuitRole.replaceAll("_", " ")} />
                <Metric label="Commercial owner" value={item.commercialOwnerName ?? "—"} />
                <Metric label="Manufacturer" value={item.manufacturerName ?? "—"} />
                <Metric label="Anchor markets absent" value={String(item.anchorAbsenceCount)} />
                <Metric
                  label="Top GCC++ markets"
                  value={item.topMarkets.map((market) => market.country).join(", ") || "Still deriving"}
                />
              </div>

              <div className="mt-5 space-y-2 text-sm text-zinc-400">
                {item.rankingReason && <p>{item.rankingReason}</p>}
                {item.marketSignalsSummary && <p>{item.marketSignalsSummary}</p>}
                {item.presenceReason && <p>{item.presenceReason}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "brand" | "emerald" | "amber";
}) {
  const className =
    tone === "brand"
      ? "border-[var(--brand-500)]/30 bg-[var(--brand-500)]/12 text-[var(--brand-200)]"
      : tone === "emerald"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 uppercase tracking-[0.18em] ${className}`}>
      {label}
    </span>
  );
}
