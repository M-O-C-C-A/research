"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { confidenceBadgeClass, entryStrategyLabel, statusBadgeClass } from "@/lib/decisionOpportunities";
import { normalizeExternalUrl } from "@/lib/urlUtils";
import { Button } from "@/components/ui/button";
import { CountryCellEditor } from "@/components/drugs/CountryCellEditor";
import { AlertTriangle, ExternalLink, Mail, Linkedin, Target, ShieldCheck, Clock3, ArrowRight } from "lucide-react";

interface OpportunityDetailViewProps {
  opportunityId: string;
}

export function OpportunityDetailView({ opportunityId }: OpportunityDetailViewProps) {
  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const guidedFlow = useQuery(api.dashboard.getGuidedFlow, {});
  const opportunity = useQuery(api.decisionOpportunities.get, {
    id: opportunityId as Id<"decisionOpportunities">,
  });
  const marketOpportunities = useQuery(
    api.opportunities.listByDrug,
    opportunity ? { drugId: opportunity.drugId } : "skip"
  );

  if (opportunity === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2 bg-zinc-800" />
        <Skeleton className="h-32 w-full bg-zinc-800" />
        <Skeleton className="h-48 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!opportunity) return null;

  type MarketOpportunityRow = NonNullable<typeof marketOpportunities>[number];
  const opportunityByCountry = new Map<string, MarketOpportunityRow>(
    (marketOpportunities ?? []).map((item) => [item.country, item])
  );
  const marketRows = opportunity.focusMarkets.map((country) => {
    const current = opportunityByCountry.get(country);
    return {
      drugId: opportunity.drugId,
      country,
      opportunityScore: current?.commercialOpportunityScore ?? current?.opportunityScore,
      regulatoryStatus: current?.regulatoryStatus,
      competitorPresence: current?.competitorPresence,
      marketSizeEstimate: current?.marketSizeEstimate,
      availabilityStatus: current?.availabilityStatus,
      treatmentVolumeProxy: current?.treatmentVolumeProxy,
      priceCorridor: current?.priceCorridor,
      primaryPriceBenchmark: current?.primaryPriceBenchmark,
      pricingConfidence: current?.pricingConfidence,
      pricePositioning: current?.pricePositioning,
      competitionIntensity: current?.competitionIntensity,
      competitivePriceSummary: current?.competitivePriceSummary,
      euReferenceAnchor: current?.euReferenceAnchor,
      gccRegisteredAnchor: current?.gccRegisteredAnchor,
      tenderBenchmarkAnchor: current?.tenderBenchmarkAnchor,
      priceCorridorBand: current?.priceCorridorBand,
      recommendedPricingBand: current?.recommendedPricingBand,
      priceReferencingRisk: current?.priceReferencingRisk,
      opportunityKind: current?.opportunityKind,
      tenderOpportunity: current?.tenderOpportunity,
      tenderSignalStrength: current?.tenderSignalStrength,
      annualOpportunityRange: current?.annualOpportunityRange,
      estimatedCustomers: current?.estimatedCustomers,
      accessibleShare: current?.accessibleShare,
      physicianAdoptionRate: current?.physicianAdoptionRate,
      accessibleVolumeEstimate: current?.accessibleVolumeEstimate,
      publicPrivateMixSummary: current?.publicPrivateMixSummary,
      physicianAdoptionSummary: current?.physicianAdoptionSummary,
      reimbursementConstraintLevel: current?.reimbursementConstraintLevel,
      tenderBarrierLevel: current?.tenderBarrierLevel,
      entryStrategyRecommendation: current?.entryStrategyRecommendation,
      entryStrategyChannel: current?.entryStrategyChannel,
      entryStrategySequencing: current?.entryStrategySequencing,
      marketAccessRoute: current?.marketAccessRoute,
      notes: current?.notes,
    };
  });
  const activeMarketRow = marketRows.find((row) => row.country === editingCountry) ?? null;

  const outreachReadiness = opportunity.outreachReadiness ?? {
    gapConfirmed: false,
    ownershipConfirmed: false,
    contactConfirmed: false,
    reachableChannelAvailable: false,
    readyToSend: false,
  };
  const outreachBlockers = opportunity.outreachBlockers ?? [
    "This opportunity was created before outreach-readiness checks were added. Rebuild the opportunity engine to populate them.",
  ];
  const outreachPackage = opportunity.outreachPackage ?? {
    shortEmail: opportunity.outreachDraft,
    longEmail: opportunity.outreachDraft,
    linkedinMessage: "Rebuild the opportunity engine to generate a LinkedIn outreach version.",
    callOpening: "Rebuild the opportunity engine to generate a call-opening script.",
    attachmentBrief: "Rebuild the opportunity engine to generate a one-page brief.",
  };
  const currentOpportunityHref = `/opportunities/${opportunityId}`;
  const bannerNextHref =
    guidedFlow?.resumeHref === currentOpportunityHref
      ? `${currentOpportunityHref}#outreach-readiness`
      : undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      {activeMarketRow && (
        <CountryCellEditor
          open={Boolean(activeMarketRow)}
          onClose={() => setEditingCountry(null)}
          opportunity={activeMarketRow}
        />
      )}
      <GuidedFlowBanner
        hereLabel="Best opportunity detail"
        helperText="Use this page to validate the recommendation, clear blockers, and decide whether KEMEDICA is ready to send outreach now."
        nextHref={bannerNextHref}
      />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-400">
                Rank #{opportunity.rankingPosition ?? "—"}
              </span>
              <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClass(opportunity.status)}`}>
                {opportunity.status.replace("_", " ")}
              </span>
              <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${confidenceBadgeClass(opportunity.confidenceLevel)}`}>
                {opportunity.confidenceLevel} confidence
              </span>
              {opportunity.blockedFocusMarkets?.map((market) => (
                <span
                  key={`${opportunity._id}-${market}-registered`}
                  className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200"
                >
                  Already registered in {market}
                </span>
              ))}
            </div>
            <h2 className="text-2xl font-semibold text-white">{opportunity.productName}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {opportunity.genericName} · {opportunity.approachEntityName}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
              {opportunity.commercialRationale}
            </p>
          </div>

          <div className="w-full rounded-xl border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-4 py-3 text-left sm:w-auto sm:text-right">
            <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">Priority Score</p>
            <p className="mt-1 text-3xl font-bold text-white">{opportunity.priorityScore.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">Focus: {opportunity.focusMarkets.join(", ")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Decision Summary
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              The core recommendation in plain language
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              Use this section first if you only need the key takeaways before deciding whether
              to move forward.
            </p>
          </div>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            Track outreach
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Why this is worth pursuing
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {opportunity.commercialRationale}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              What to do next
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {opportunity.howToEnterExplanation}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Who to contact
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {opportunity.contactName ?? opportunity.targetRole}
              {opportunity.contactTitle ? ` · ${opportunity.contactTitle}` : ""}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Contact confidence: {opportunity.contactConfidence}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              What evidence supports this
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {opportunity.confidenceSummary}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Why This Market</p>
          <p className="mt-2 text-sm text-zinc-300">{opportunity.whyThisMarket}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Why Now</p>
          <p className="mt-2 text-sm text-zinc-300">{opportunity.whyNow}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">How To Enter</p>
          <p className="mt-2 text-sm text-zinc-300">
            {entryStrategyLabel(opportunity.entryStrategy)} · {opportunity.entryStrategyRationale}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Who To Contact</p>
          <p className="mt-2 text-sm text-zinc-300">
            {opportunity.contactName ?? opportunity.targetRole}
          </p>
          {opportunity.contactTitle && (
            <p className="mt-1 text-xs text-zinc-500">{opportunity.contactTitle}</p>
          )}
        </div>
      </section>

      {opportunity.companyFootprintStatus &&
        opportunity.companyFootprintStatus !== "clean_whitespace" && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                  Commercial caution
                </p>
                <p className="mt-2 text-sm leading-relaxed text-amber-100">
                  {opportunity.companyFootprintReason ??
                    "The product whitespace is still valid, but the linked company already appears to have some GCC++ representation or portfolio presence."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-100/90">
                  {opportunity.companyFootprintCountries?.map((country) => (
                    <span key={country} className="rounded bg-amber-500/15 px-2 py-1">
                      {country}
                    </span>
                  ))}
                  {(opportunity.companyPortfolioPresenceCount ?? 0) > 0 && (
                    <span className="rounded bg-amber-500/15 px-2 py-1">
                      {opportunity.companyPortfolioPresenceCount} other linked product
                      {(opportunity.companyPortfolioPresenceCount ?? 0) === 1 ? "" : "s"} in GCC++
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

      {marketOpportunities && marketOpportunities.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
                Commercial Market View
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                Pricing, tender pull, and competition in the focus markets
              </h3>
            </div>
            <Link
              href={`/drugs/${opportunity.drugId}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Open product market view
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {marketOpportunities
              .filter((item) => opportunity.focusMarkets.includes(item.country))
              .map((item) => (
                <div
                  key={`${item.drugId}-${item.country}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.country}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.opportunityKind
                          ? item.opportunityKind.replaceAll("_", " ")
                          : "commercial evidence pending"}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {(item.commercialOpportunityScore ?? item.opportunityScore)?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    <p>
                      <span className="text-zinc-500">Pricing band:</span>{" "}
                      {item.recommendedPricingBand ??
                        item.priceCorridorBand ??
                        item.primaryPriceBenchmark ??
                        item.priceCorridor ??
                        "Not yet set"}
                    </p>
                    <p>
                      <span className="text-zinc-500">Tender signal:</span>{" "}
                      {item.tenderSignalStrength ?? "none"}
                    </p>
                    <p>
                      <span className="text-zinc-500">Competition:</span>{" "}
                      {item.competitionIntensity ?? item.competitorPresence ?? "unknown"}
                    </p>
                    {item.competitivePriceSummary && (
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {item.competitivePriceSummary}
                      </p>
                    )}
                    {item.accessibleVolumeEstimate && (
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {item.accessibleVolumeEstimate}
                      </p>
                    )}
                    {(item.entryStrategyChannel || item.entryStrategySequencing) && (
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {item.entryStrategyChannel
                          ? item.entryStrategyChannel.replaceAll("_", " ")
                          : "channel pending"}{" "}
                        ·{" "}
                        {item.entryStrategySequencing
                          ? item.entryStrategySequencing.replaceAll("_", " ")
                          : "sequencing pending"}
                      </p>
                    )}
                    <Link
                      href={`/drugs/${opportunity.drugId}/markets/${encodeURIComponent(item.country)}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-300)] hover:text-white"
                    >
                      Open margin simulator
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      <section
        id="outreach-readiness"
        className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Outreach Readiness
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Can KEMEDICA send a real first-touch now?
            </h3>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm ${
              outreachReadiness.readyToSend
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {outreachReadiness.readyToSend ? "Ready to send" : "Blocked"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Gap confirmed", complete: outreachReadiness.gapConfirmed },
            { label: "Ownership confirmed", complete: outreachReadiness.ownershipConfirmed },
            { label: "Contact confirmed", complete: outreachReadiness.contactConfirmed },
            { label: "Route available", complete: outreachReadiness.reachableChannelAvailable },
          ].map(({ label, complete }) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
              <p className={`mt-2 text-sm font-medium ${complete ? "text-emerald-300" : "text-amber-300"}`}>
                {complete ? "Yes" : "Needs work"}
              </p>
            </div>
          ))}
        </div>

        {outreachBlockers.length > 0 && (
          <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Current blockers
            </p>
            <div className="mt-2 space-y-1 text-sm text-zinc-300">
              {outreachBlockers.map((blocker) => (
                <p key={blocker}>{blocker}</p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {opportunity.companyId && (
            <Link
              href={`/companies/${opportunity.companyId}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
            >
              Add contact on company page
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Button
            variant="outline"
            onClick={() => setEditingCountry(opportunity.focusMarkets[0] ?? null)}
            className="border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] text-[var(--brand-300)] hover:border-[color:var(--brand-500)] hover:bg-[color:var(--brand-surface)] hover:text-white"
          >
            Edit route for {opportunity.focusMarkets[0] ?? "focus market"}
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 space-y-6">
          <details className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6" open>
            <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Decision details and scoring
            </summary>
            <p className="mt-2 text-xs text-zinc-500">
              Use this section when you want to inspect the scoring logic, assumptions, and
              constraints behind the recommendation.
            </p>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Decision Summary
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-zinc-500">Gap Type</p>
                <p className="mt-1 text-sm text-zinc-300">{opportunity.gapType.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Product Identity</p>
                <p className="mt-1 text-sm text-zinc-300">{opportunity.productIdentityStatus}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Regulatory Feasibility</p>
                <p className="mt-1 text-sm text-zinc-300">
                  {opportunity.regulatoryFeasibility} · {opportunity.timelineRange}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Key Constraint</p>
                <p className="mt-1 text-sm text-zinc-300">{opportunity.keyConstraint}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4 border-t border-zinc-800 pt-5">
              <div>
                <p className="text-xs text-zinc-500">Gap Summary</p>
                <p className="mt-1 text-sm text-zinc-300">{opportunity.gapSummary}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Demand Proxy</p>
                <p className="mt-1 text-sm text-zinc-300">{opportunity.demandProxy}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Competitive Pressure</p>
                <p className="mt-1 text-sm text-zinc-300">{opportunity.competitivePressure}</p>
              </div>
            </div>
          </details>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                Outreach Package
              </h3>
              <span className="text-xs text-zinc-500">{opportunity.outreachSubject}</span>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Short email</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-300">
                  {outreachPackage.shortEmail}
                </pre>
              </div>
              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Long email</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-300">
                  {outreachPackage.longEmail}
                </pre>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-zinc-950 p-4">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">LinkedIn message</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {outreachPackage.linkedinMessage}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-950 p-4">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Call opening</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {outreachPackage.callOpening}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Attachment brief</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-300">
                  {outreachPackage.attachmentBrief}
                </pre>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Evidence And Transparency
            </h3>
            <div className="mt-4 space-y-3">
              {opportunity.evidence.length === 0 ? (
                <p className="text-sm text-zinc-500">No structured evidence links yet.</p>
              ) : (
                opportunity.evidence.map((item) => (
                  <a
                    key={item._id}
                    href={normalizeExternalUrl(item.url) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-950"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.claim}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className={`border-0 ${confidenceBadgeClass(item.confidence === "confirmed" ? "high" : item.confidence === "likely" ? "medium" : "low")}`}>
                          {item.evidenceType}
                        </Badge>
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Company And Contact
            </h3>
            <div className="mt-4 space-y-3">
              {(opportunity.companyWebsite || opportunity.companyLinkedinUrl) && (
                <div className="rounded-lg bg-zinc-950 px-4 py-3">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Company</p>
                  <p className="mt-1 text-sm font-medium text-white">{opportunity.approachEntityName}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {opportunity.companyWebsite && (
                      <a
                        href={normalizeExternalUrl(opportunity.companyWebsite) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Website
                      </a>
                    )}
                    {opportunity.companyLinkedinUrl && (
                      <a
                        href={normalizeExternalUrl(opportunity.companyLinkedinUrl) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                      >
                        <Linkedin className="h-3 w-3" />
                        Company LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="rounded-lg bg-zinc-950 px-4 py-3">
                <p className="text-sm font-medium text-white">
                  {opportunity.contactName ?? opportunity.targetRole}
                </p>
                {opportunity.contactTitle && (
                  <p className="mt-1 text-xs text-zinc-500">{opportunity.contactTitle}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {opportunity.contactEmail && (
                    <a href={`mailto:${opportunity.contactEmail}`} className="inline-flex items-center gap-1 text-[var(--brand-300)] hover:text-[var(--brand-400)]">
                      <Mail className="h-3 w-3" />
                      {opportunity.contactEmail}
                    </a>
                  )}
                  {opportunity.contactLinkedinUrl && (
                    <a
                      href={normalizeExternalUrl(opportunity.contactLinkedinUrl) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                    >
                      <Linkedin className="h-3 w-3" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Contact confidence: <span className="text-zinc-300">{opportunity.contactConfidence}</span>
              </p>
              <p className="text-sm text-zinc-300">{opportunity.whyThisPartner}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Score Breakdown
            </h3>
            <div className="mt-4 space-y-3">
              {[
                ["Gap validity", opportunity.scoreBreakdown.gapValidity],
                ["Commercial value", opportunity.scoreBreakdown.commercialValue],
                ["Urgency", opportunity.scoreBreakdown.urgency],
                ["Feasibility", opportunity.scoreBreakdown.feasibility],
                ["Partner reachability", opportunity.scoreBreakdown.partnerReachability],
                ["Evidence confidence", opportunity.scoreBreakdown.evidenceConfidence],
              ].map(([label, score]) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-medium text-white">{Number(score).toFixed(1)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[var(--brand-500)] via-[var(--brand-400)] to-amber-400"
                      style={{ width: `${Math.max(6, Math.min(100, Number(score) * 10))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">{opportunity.scoreExplanation}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Assumptions
            </h3>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <div className="flex items-start gap-2">
                <Target className="mt-0.5 h-4 w-4 text-[var(--brand-300)]" />
                <p>{opportunity.confidenceSummary}</p>
              </div>
              {opportunity.assumptions.map((assumption) => (
                <div key={assumption} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-zinc-500" />
                  <p>{assumption}</p>
                </div>
              ))}
              <div className="flex items-start gap-2 text-zinc-500">
                <Clock3 className="mt-0.5 h-4 w-4" />
                <p>Last promoted {new Date(opportunity.lastPromotedAt).toLocaleDateString("en-GB")}.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
