"use client";

import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProductMarketAnalysisPanel } from "@/components/drugs/ProductMarketAnalysisPanel";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  under_review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
  discontinued: "bg-zinc-800 text-zinc-400 border-zinc-700",
  unavailable: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

interface CanonicalProductDetailProps {
  productId: string;
}

export function CanonicalProductDetail({ productId }: CanonicalProductDetailProps) {
  const [analysisState, setAnalysisState] = useState<{
    tone: "success" | "error" | "info";
    title: string;
    body: string;
  } | null>(null);
  const product = useQuery(api.productIntelligence.getCanonicalProduct, {
    id: productId as Id<"canonicalProducts">,
  });
  const existingGaps = useQuery(api.gapOpportunities.listByCanonicalProduct, {
    canonicalProductId: productId as Id<"canonicalProducts">,
  });
  const canonicalOpportunity = useQuery(api.canonicalOpportunities.getByCanonicalProduct, {
    canonicalProductId: productId as Id<"canonicalProducts">,
  });
  const marketAnalysis = useQuery(api.productMarketAnalysis.getByCanonicalProduct, {
    canonicalProductId: productId as Id<"canonicalProducts">,
  });
  const runCanonicalPipeline = useAction(api.canonicalOpportunities.runPipeline);

  async function handleAnalyzeProductGap() {
    setAnalysisState({
      tone: "info",
      title: "Running fresh external GCC++ refresh",
      body: "Refreshing approval truth, anchor-market presence, linked company footprint, and GCC++ ranking for this product.",
    });
    try {
      const result = await runCanonicalPipeline({
        canonicalProductId: productId as Id<"canonicalProducts">,
        syncReferenceSources: false,
        refreshMode: "fresh_external",
      });
      setAnalysisState({
        tone: result.touched > 0 ? "success" : "error",
        title:
          result.touched > 0
            ? "Fresh external opportunity snapshot ready"
            : "No canonical opportunity snapshot captured",
        body:
          result.touched > 0
            ? `Fresh research refreshed this product and marked ${result.ranked} ranked, ${result.blocked} blocked/present, and ${result.ambiguous} ambiguous opportunity states.`
            : "The canonical opportunity pipeline did not update this product.",
      });
    } catch (error) {
      setAnalysisState({
        tone: "error",
        title: "Analysis failed",
        body:
          error instanceof Error
            ? error.message
            : "The product-led gap analysis did not complete.",
      });
    }
  }

  if (product === undefined) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3 mb-6">
        <Skeleton className="h-7 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-1/2 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6">
      <GuidedFlowBanner
        hereLabel="Canonical product detail"
        helperText="Use this page to confirm regulatory identity across FDA and EU sources, compare ownership roles, and then move back into whitespace review or outreach."
      />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-white">{product.brandName}</h2>
              <Badge
                variant="secondary"
                className={STATUS_STYLES[product.status] ?? "bg-zinc-800 text-zinc-400"}
              >
                {product.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              <Link
                href={`/drugs/inn/${encodeURIComponent(product.inn)}`}
                className="hover:text-[var(--brand-300)]"
              >
                {product.inn}
              </Link>
              {product.geographies.length > 0 && <span>{` · ${product.geographies.join(", ")}`}</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.sourceBadges.map((badge) => (
                <Badge
                  key={`${product._id}-${badge}`}
                  variant="secondary"
                  className="border-0 bg-[color:var(--brand-surface)] text-[var(--brand-300)]"
                >
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Button
              type="button"
              onClick={() => void handleAnalyzeProductGap()}
            >
              Run fresh external GCC++ research
            </Button>
            <Link
              href={`/drugs/catalog/${productId}/opportunity`}
              className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Check market opportunity
            </Link>
          </div>
        </div>

        {analysisState && (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm ${
              analysisState.tone === "success"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                : analysisState.tone === "error"
                  ? "border-red-500/25 bg-red-500/10 text-red-100"
                  : "border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] text-zinc-100"
            }`}
          >
            <p className="font-medium">{analysisState.title}</p>
            <p className="mt-1 opacity-90">{analysisState.body}</p>
          </div>
        )}

        {existingGaps && existingGaps.length > 0 && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">
              Existing product-led gaps
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {existingGaps.slice(0, 3).map((gap) => (
                <Link
                  key={gap._id}
                  href={`/gaps/${gap._id}`}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                >
                  {gap.indication}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Application type" value={product.applicationTypeSummary ?? "—"} />
          <Metric label="Approval date" value={product.approvalDate ?? "—"} />
          <Metric label="Manufacturer" value={product.primaryManufacturerName ?? "—"} />
          <Metric label="MAH / applicant" value={product.primaryMahName ?? product.primaryApplicantName ?? "—"} />
          <Metric label="Strength" value={product.strength ?? "—"} />
          <Metric label="Dosage form" value={product.dosageForm ?? "—"} />
          <Metric label="Route" value={product.route ?? "—"} />
          <Metric label="ATC / therapy" value={product.atcCode ?? product.therapeuticArea ?? "—"} />
        </div>

        {canonicalOpportunity && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">
              GCC++ pursuit snapshot
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Pipeline status"
                value={canonicalOpportunity.pipelineStatus.replaceAll("_", " ")}
              />
              <Metric
                label="Commercial owner"
                value={
                  canonicalOpportunity.commercialOwnerEntity?.company?.name ??
                  canonicalOpportunity.commercialOwnerEntity?.entityName ??
                  "—"
                }
              />
              <Metric
                label="Recommended pursuit"
                value={
                  canonicalOpportunity.recommendedPursuitEntity?.company?.name ??
                  canonicalOpportunity.recommendedPursuitEntity?.entityName ??
                  "—"
                }
              />
              <Metric
                label="Ranking score"
                value={
                  canonicalOpportunity.rankingScore != null
                    ? canonicalOpportunity.rankingScore.toFixed(1)
                    : "—"
                }
              />
            </div>
            {canonicalOpportunity.freshResearchRunAt && (
              <p className="mt-3 text-xs text-zinc-500">
                Fresh external research run: {new Date(canonicalOpportunity.freshResearchRunAt).toLocaleString()}
              </p>
            )}
            <div className="mt-3 space-y-1 text-sm text-zinc-400">
              {canonicalOpportunity.confirmationReason && (
                <p>{canonicalOpportunity.confirmationReason}</p>
              )}
              {canonicalOpportunity.presenceReason && (
                <p>{canonicalOpportunity.presenceReason}</p>
              )}
              {canonicalOpportunity.rankingReason && (
                <p>{canonicalOpportunity.rankingReason}</p>
              )}
            </div>
            {canonicalOpportunity.countryResearch && canonicalOpportunity.countryResearch.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {canonicalOpportunity.countryResearch.map((finding) => (
                  <div
                    key={finding.country}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{finding.country}</p>
                      <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                        {finding.sourceCategory ?? "unspecified"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wider text-[var(--brand-300)]">
                      {finding.result.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">{finding.summary}</p>
                    {finding.sourceTitle && (
                      <p className="mt-2 text-xs text-zinc-500">Source: {finding.sourceTitle}</p>
                    )}
                    {finding.skippedReason && (
                      <p className="mt-2 text-xs text-zinc-500">Skipped: {finding.skippedReason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {marketAnalysis && marketAnalysis.countries.length > 0 && (
          <ProductMarketAnalysisPanel analysis={marketAnalysis} />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">Regulatory identity</p>
          <div className="mt-4 space-y-3">
            {product.sources.map((source) => (
              <div
                key={source._id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="border-0 bg-zinc-800 text-zinc-300">
                    {source.sourceSystem.replaceAll("_", " ")}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={STATUS_STYLES[source.sourceStatus] ?? "bg-zinc-800 text-zinc-400"}
                  >
                    {source.sourceStatus.replaceAll("_", " ")}
                  </Badge>
                  {source.applicationType && (
                    <Badge variant="secondary" className="border-0 bg-zinc-800 text-zinc-300">
                      {source.applicationType}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Metric label="Brand" value={source.brandName ?? "—"} />
                  <Metric label="INN" value={source.inn ?? "—"} />
                  <Metric label="Applicant / MAH" value={source.mahName ?? source.applicantName ?? "—"} />
                  <Metric label="Manufacturer" value={source.manufacturerName ?? "—"} />
                  <Metric label="Approval date" value={source.approvalDate ?? "—"} />
                  <Metric label="Geography" value={source.geography} />
                </div>
                {(source.patentsSummary || source.exclusivitiesSummary || source.packageSummary || source.interchangeability) && (
                  <div className="mt-3 space-y-1 text-xs text-zinc-500">
                    {source.patentsSummary && <p>Patents: {source.patentsSummary}</p>}
                    {source.exclusivitiesSummary && <p>Exclusivities: {source.exclusivitiesSummary}</p>}
                    {source.packageSummary && <p>Packages: {source.packageSummary}</p>}
                    {source.interchangeability && <p>Interchangeability: {source.interchangeability}</p>}
                  </div>
                )}
                {source.sourceUrl && (
                  <Link
                    href={source.sourceUrl}
                    target="_blank"
                    className="mt-3 inline-flex text-xs text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                  >
                    Open source
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">Ownership map</p>
            <div className="mt-4 space-y-3">
              {product.entities.map((entity) => (
                <div
                  key={`${entity._id}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="border-0 bg-zinc-800 text-zinc-300">
                      {entity.role}
                    </Badge>
                    {entity.isPrimary && (
                      <Badge variant="secondary" className="border-0 bg-[color:var(--brand-surface)] text-[var(--brand-300)]">
                        primary
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-white">
                    {entity.company?.name ?? entity.entityName}
                  </p>
                  {entity.company && entity.company.name !== entity.entityName && (
                    <p className="mt-1 text-xs text-zinc-500">Registry entity: {entity.entityName}</p>
                  )}
                  {entity.company && (
                    <p className="mt-1 text-xs text-zinc-500">Linked company record</p>
                  )}
                  {entity.geography && <p className="mt-1 text-xs text-zinc-500">{entity.geography}</p>}
                </div>
              ))}
            </div>
          </section>

          {(product.referenceProduct || product.biosimilars.length > 0 || product.relatedByInn.length > 0) && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">Equivalent products</p>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                {product.referenceProduct && (
                  <p>
                    Reference product:{" "}
                    <Link
                      href={`/drugs/catalog/${product.referenceProduct._id}`}
                      className="text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                    >
                      {product.referenceProduct.brandName}
                    </Link>
                  </p>
                )}
                {product.biosimilars.length > 0 && (
                  <p>
                    Biosimilars:{" "}
                    {product.biosimilars.map((item, index) => (
                      <span key={item._id}>
                        {index > 0 && ", "}
                        <Link
                          href={`/drugs/catalog/${item._id}`}
                          className="text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                        >
                          {item.brandName}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                {product.relatedByInn.length > 0 && (
                  <p>
                    Other brands for this INN:{" "}
                    {product.relatedByInn.slice(0, 6).map((item, index) => (
                      <span key={item._id}>
                        {index > 0 && ", "}
                        <Link
                          href={`/drugs/catalog/${item._id}`}
                          className="text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                        >
                          {item.brandName}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </section>
          )}

          {product.linkedDrugs.length > 0 && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">Linked operational products</p>
              <div className="mt-4 space-y-2">
                {product.linkedDrugs.map((drug) => (
                  <Link
                    key={drug._id}
                    href={`/drugs/${drug._id}`}
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                  >
                    {drug.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{value}</p>
    </div>
  );
}
