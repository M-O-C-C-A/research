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
  EvidenceEnrichmentDialog,
  ValidationStatusBadge,
  formatAnalysisLens,
  formatGapType,
  formatProductGapKind,
} from "@/components/gaps/GapsDashboard";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  AlertTriangle,
  Building2,
  FlaskConical,
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
import { normalizeExternalUrl } from "@/lib/urlUtils";

export function GapDetailPage({ gapId }: { gapId: string }) {
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
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
      {showEnrichDialog && (
        <EvidenceEnrichmentDialog
          gap={typedGap}
          onClose={() => setShowEnrichDialog(false)}
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
                <ValidationStatusBadge status={typedGap.validationStatus} />
                {typedGap.analysisLens && (
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    {formatAnalysisLens(typedGap.analysisLens)}
                  </span>
                )}
                {typedGap.gapType && (
                  <span className="rounded bg-[color:var(--brand-surface)] px-2 py-0.5 text-xs text-[var(--brand-300)]">
                    {formatGapType(typedGap.gapType)}
                  </span>
                )}
                {typedGap.productGapKind && (
                  <span className="rounded border border-[color:var(--brand-border)] px-2 py-0.5 text-xs text-[var(--brand-300)]">
                    {formatProductGapKind(typedGap.productGapKind)}
                  </span>
                )}
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
                className="bg-[color:var(--brand-500)] text-white hover:bg-[color:var(--brand-600)]"
                onClick={() => setShowSupplierDialog(true)}
              >
                <Search className="mr-1.5 h-3.5 w-3.5" />
                {supplierCount > 0 ? "Search Again" : "Find Suppliers"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[color:var(--brand-border)] text-[var(--brand-300)] hover:bg-[color:var(--brand-surface)]"
                onClick={() => setShowEnrichDialog(true)}
              >
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                {typedGap.lastEnrichedAt ? "Re-enrich Evidence" : "Enrich Evidence"}
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
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              {typedGap.validationStatus === "insufficient_evidence"
                ? typedGap.evidenceSummary ?? typedGap.supplyGap
                : typedGap.supplyGap}
            </p>
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
                  className="rounded border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-2 py-1 text-xs text-[var(--brand-300)]"
                >
                  {cls}
                </span>
              ))}
            </div>
          </div>
        </section>

        {(typedGap.analysisLens === "product_led" || typedGap.canonicalProductId) && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Product-Led Context
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              This gap was created from the product angle. The system compared FDA / EMA approval coverage with current target-market presence signals to determine whether the product is absent, differently branded, generic-present, biosimilar-linked, or patent-timed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {typedGap.analysisLens && (
                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  {formatAnalysisLens(typedGap.analysisLens)}
                </span>
              )}
              {typedGap.productGapKind && (
                <span className="rounded border border-[color:var(--brand-border)] px-2 py-1 text-xs text-[var(--brand-300)]">
                  {formatProductGapKind(typedGap.productGapKind)}
                </span>
              )}
            </div>
            {typedGap.canonicalProductId && (
              <Link
                href={`/drugs/catalog/${typedGap.canonicalProductId}`}
                className="mt-4 inline-flex text-sm text-[var(--brand-300)] hover:text-[var(--brand-400)]"
              >
                Open linked product intelligence
              </Link>
            )}
          </section>
        )}

        {(typedGap.evidenceSummary || typedGap.verifiedMissingCount != null || typedGap.verifiedRegisteredCount != null) && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Validation</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              {typedGap.evidenceSummary ?? "Structured evidence captured for this gap."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
              {typedGap.verifiedMissingCount != null && (
                <span className="rounded bg-zinc-800 px-2 py-1">
                  {typedGap.verifiedMissingCount} verified missing
                </span>
              )}
              {typedGap.verifiedRegisteredCount != null && (
                <span className="rounded bg-zinc-800 px-2 py-1">
                  {typedGap.verifiedRegisteredCount} verified registered
                </span>
              )}
            </div>
          </section>
        )}

        {typedGap.companyFootprintStatus &&
          typedGap.companyFootprintStatus !== "clean_whitespace" && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Commercial Caution
              </p>
              <p className="mt-3 text-sm leading-relaxed text-amber-100">
                {typedGap.companyFootprintReason ??
                  "The product still looks like whitespace, but the linked company already shows some GCC++ footprint."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-100/90">
                {typedGap.companyFootprintCountries?.map((country) => (
                  <span key={country} className="rounded bg-amber-500/15 px-2 py-1">
                    {country}
                  </span>
                ))}
                {(typedGap.companyPortfolioPresenceCount ?? 0) > 0 && (
                  <span className="rounded bg-amber-500/15 px-2 py-1">
                    {typedGap.companyPortfolioPresenceCount} other linked product
                    {(typedGap.companyPortfolioPresenceCount ?? 0) === 1 ? "" : "s"} in GCC++
                  </span>
                )}
              </div>
            </section>
          )}

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
                  <Zap className="h-3 w-3 text-[var(--brand-300)]" />
                  Tender Signals
                </p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
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
              {typedGap.sources.map((source, index) => (
                <a
                  key={`${source.url}-${source.title}-${index}`}
                  href={normalizeExternalUrl(source.url) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-[var(--brand-300)] underline hover:text-[var(--brand-400)]"
                >
                  {source.title}
                </a>
              ))}
            </div>
          </section>
        )}

        {typedGap.evidenceItems && typedGap.evidenceItems.length > 0 && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Supporting Evidence</p>
            <div className="mt-3 space-y-3">
              {typedGap.evidenceItems.slice(0, 8).map((item) => (
                <a
                  key={`${item.url}-${item.claim}`}
                  href={normalizeExternalUrl(item.url) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-700"
                >
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5">{item.sourceKind.replace(/_/g, " ")}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5">{item.confidence}</span>
                    {item.country && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{item.country}</span>}
                    {item.productOrClass && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{item.productOrClass}</span>}
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.claim}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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
                            <span className="rounded bg-[color:var(--brand-surface)] px-1.5 py-0.5 text-xs text-[var(--brand-300)]">
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
                        {entry.companyFootprintReason &&
                          entry.companyFootprintStatus !== "clean_whitespace" && (
                            <p className="mt-1 line-clamp-2 text-xs text-amber-300">
                              {entry.companyFootprintReason}
                            </p>
                          )}
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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
                    className="block text-sm text-[var(--brand-300)] underline hover:text-[var(--brand-400)]"
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
