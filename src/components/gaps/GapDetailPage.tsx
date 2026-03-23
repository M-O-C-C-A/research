"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import {
  Gap,
  GapScoreBadge,
  FeasibilityBadge,
  SupplierSearchDialog,
} from "@/components/gaps/GapsDashboard";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  MapPin,
  Search,
  Star,
  Zap,
} from "lucide-react";
import {
  PIPELINE_STAGE_BADGES,
  PIPELINE_STAGE_LABELS,
  normalizePipelineStage,
  priorityTierLabel,
} from "@/lib/distributorFit";

export function GapDetailPage({ gapId }: { gapId: string }) {
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const gap = useQuery(api.gapOpportunities.get, {
    id: gapId as Id<"gapOpportunities">,
  });
  const archiveGap = useMutation(api.gapOpportunities.update);
  const gapMatches = useQuery(
    api.gapCompanyMatches.listByGap,
    gap ? { gapOpportunityId: gap._id, limit: 20 } : "skip"
  );
  const promotedOpportunities = useQuery(
    api.decisionOpportunities.listByGapOpportunity,
    gap ? { gapOpportunityId: gap._id } : "skip"
  );

  if (gap === undefined) {
    return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">Loading gap…</div>;
  }

  if (!gap) return null;

  const typedGap = gap as Gap;
  const supplierCount = typedGap.linkedCompanyIds?.length ?? 0;
  const linkedDrugCount = typedGap.linkedDrugIds?.length ?? 0;

  async function handleArchive() {
    await archiveGap({ id: typedGap._id, status: "archived" });
  }

  return (
    <>
      {showSupplierDialog && (
        <SupplierSearchDialog
          gap={typedGap}
          onClose={() => setShowSupplierDialog(false)}
        />
      )}

      <div className="space-y-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <GapScoreBadge score={typedGap.gapScore} />
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {typedGap.therapeuticArea}
                </span>
                <FeasibilityBadge level={typedGap.regulatoryFeasibility} />
              </div>
              <h2 className="text-2xl font-semibold text-white">{typedGap.indication}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {typedGap.targetCountries.map((country) => (
                  <span
                    key={country}
                    className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                  >
                    {country}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-cyan-600 text-white hover:bg-cyan-500"
                onClick={() => setShowSupplierDialog(true)}
              >
                <Search className="mr-1.5 h-3.5 w-3.5" />
                {supplierCount > 0 ? "Search Again" : "Find Suppliers"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 hover:bg-zinc-800"
                onClick={handleArchive}
              >
                Archive Gap
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Demand Evidence</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{typedGap.demandEvidence}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Supply Gap</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{typedGap.supplyGap}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Competitor Landscape</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{typedGap.competitorLandscape}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Suggested Drug Classes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {typedGap.suggestedDrugClasses.map((cls) => (
                <span
                  key={cls}
                  className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300"
                >
                  {cls}
                </span>
              ))}
            </div>
          </div>
        </section>

        {(typedGap.whoDiseaseBurden || typedGap.tenderSignals) && (
          <section className="grid gap-4 lg:grid-cols-2">
            {typedGap.whoDiseaseBurden && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-xs uppercase tracking-wider text-zinc-500">WHO Disease Burden</p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{typedGap.whoDiseaseBurden}</p>
              </div>
            )}
            {typedGap.tenderSignals && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-500">
                  <Zap className="h-3 w-3 text-cyan-400" />
                  Tender Signals
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {typedGap.tenderSignals}
                </pre>
              </div>
            )}
          </section>
        )}

        {typedGap.sources && typedGap.sources.length > 0 && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Sources</p>
            <div className="mt-3 space-y-2">
              {typedGap.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-cyan-400 underline hover:text-cyan-300"
                >
                  {source.title}
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-500">
                <Building2 className="h-3 w-3" />
                Linked Suppliers
              </p>
              <span className="text-xs text-zinc-500">{supplierCount} linked</span>
            </div>

            {gapMatches === undefined ? (
              <div className="text-sm text-zinc-500">Loading suppliers…</div>
            ) : gapMatches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                No suppliers linked yet.
              </div>
            ) : (
              <div className="space-y-2">
                {gapMatches.map((entry) => {
                  const c = entry.company;
                  if (!c) return null;
                  const stage = normalizePipelineStage(c.bdStatus);
                  const priorityLabel = priorityTierLabel(c.priorityTier);
                  return (
                    <Link
                      key={c._id}
                      href={`/companies/${c._id}`}
                      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-3 transition-colors hover:border-zinc-700"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {(c.distributorFitScore ?? c.bdScore) != null && (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-400">
                              <Star className="h-2.5 w-2.5" />
                              {(c.distributorFitScore ?? c.bdScore)?.toFixed(1)}
                            </span>
                          )}
                          {priorityLabel && (
                            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-xs text-cyan-300">
                              {priorityLabel}
                            </span>
                          )}
                          {c.bdStatus && (
                            <span className={`rounded px-1.5 py-0.5 text-xs ${PIPELINE_STAGE_BADGES[stage] ?? "bg-zinc-700 text-zinc-300"}`}>
                              {PIPELINE_STAGE_LABELS[stage] ?? stage}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm font-medium text-white">{c.name}</p>
                        <p className="text-xs text-zinc-500">{c.country}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{entry.rationale}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wider text-zinc-500">
              <MapPin className="h-3 w-3" />
              Promotion Status
            </p>
            {promotedOpportunities === undefined ? (
              <p className="mt-3 text-sm text-zinc-500">Loading promotion state…</p>
            ) : promotedOpportunities.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-emerald-300">
                  {promotedOpportunities.length} promoted opportunit{promotedOpportunities.length === 1 ? "y" : "ies"} available.
                </p>
                {promotedOpportunities.map((opportunity) => (
                  <Link
                    key={opportunity._id}
                    href={`/opportunities/${opportunity._id}`}
                    className="block text-sm text-cyan-400 underline hover:text-cyan-300"
                  >
                    #{opportunity.rankingPosition ?? "-"} {opportunity.productName}
                  </Link>
                ))}
              </div>
            ) : supplierCount > 0 && linkedDrugCount === 0 ? (
              <p className="mt-3 text-sm text-yellow-300">
                Suppliers were found, but no relevant drugs are linked to this gap yet.
              </p>
            ) : supplierCount > 0 ? (
              <p className="mt-3 text-sm text-yellow-300">
                Products are linked, but confidence is still too weak to promote an opportunity.
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                No promoted opportunities yet. Run supplier discovery first.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
