"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeExternalUrl } from "@/lib/urlUtils";

interface MandateReportPanelProps {
  decisionOpportunityId: string;
}

function decisionClass(decision?: string) {
  switch (decision) {
    case "PURSUE":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "VALIDATE":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "HOLD":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "REJECT":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

function field(label: string, value?: string | null) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{value || "UNKNOWN"}</p>
    </div>
  );
}

export function MandateReportPanel({ decisionOpportunityId }: MandateReportPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const reportData = useQuery(api.mandateOpportunityReports.getByDecisionOpportunity, {
    decisionOpportunityId: decisionOpportunityId as Id<"decisionOpportunities">,
  });
  const generate = useAction(api.mandateOpportunityReports.generateForDecisionOpportunity);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      await generate({ decisionOpportunityId: decisionOpportunityId as Id<"decisionOpportunities"> });
    } finally {
      setIsGenerating(false);
    }
  }

  if (reportData === undefined) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
        <p className="text-sm text-zinc-500">Loading mandate report...</p>
      </section>
    );
  }

  if (!reportData) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              KEMEDICA Mandate Report
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Generate the evidence-gated Saudi, Egypt, and UAE opportunity report
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              This report applies the fixed 100-point mandate rubric and will mark missing facts
              as UNKNOWN or UNVALIDATED instead of inferring them.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            {isGenerating ? "Generating" : "Generate report"}
          </Button>
        </div>
      </section>
    );
  }

  const { report, countries, evidence } = reportData;
  const scoreRows = [
    ["Unmet Need", report.scoreBreakdown.unmetNeed, 25],
    ["Market Evidence", report.scoreBreakdown.marketEvidence, 20],
    ["Competitive Gap", report.scoreBreakdown.competitiveGap, 15],
    ["Regulatory Feasibility", report.scoreBreakdown.regulatoryFeasibility, 15],
    ["Commercial Attractiveness", report.scoreBreakdown.commercialAttractiveness, 15],
    ["Partnerability", report.scoreBreakdown.partnerability, 10],
  ] as const;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            KEMEDICA Mandate Report
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-white">Evidence-gated opportunity decision</h3>
            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${decisionClass(report.decision)}`}>
              {report.decision}
            </span>
            <span className="text-sm font-semibold text-white">{report.totalScore.toFixed(1)}/100</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{report.thesis}</p>
        </div>
        <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
          <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {report.opportunityTypes.map((type) => (
          <Badge key={type} className="border border-zinc-700 bg-zinc-950 text-zinc-300">
            {type.replaceAll("_", " ")}
          </Badge>
        ))}
        {report.discoveryDirections.map((direction) => (
          <Badge key={direction} className="border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] text-[var(--brand-300)]">
            {direction.replaceAll("_", " ")}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Product</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("INN", report.inn)}
              {field("Brand", report.brand)}
              {field("Indication", report.indication)}
              {field("Strength/Form", report.strengthForm)}
              {field("Route", report.route)}
              {field("MAH", report.mah)}
              {field("Manufacturer", report.manufacturer)}
              {field("EU regulatory status", report.euRegulatoryStatus)}
            </div>
          </div>

          <div className="grid gap-4">
            {countries.map((country) => (
              <details key={country._id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4" open={country.country === "Saudi Arabia"}>
                <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                  {country.country} · {country.absenceStatus === "VERIFIED_ABSENT" ? "verified absent" : "status unknown unless proven"}
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {field("Registration", country.registration)}
                  {field("Availability", country.availability)}
                  {field("Shortage", country.shortage)}
                  {field("Anticipated shortage", country.anticipatedShortage)}
                  {field("Incentive list", country.incentiveList)}
                  {field("Competition", country.competition)}
                  {field("Demand evidence", country.demandEvidence)}
                  {field("Procurement evidence", country.procurementEvidence)}
                  {field("Regulatory path", country.regulatoryPath)}
                  {field("Commercial potential", country.commercialPotential)}
                </div>
                {country.unknowns.length > 0 && (
                  <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Unknowns</p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-300">
                      {country.unknowns.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                )}
              </details>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Score</h4>
            <div className="mt-4 space-y-3">
              {scoreRows.map(([label, value, max]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-medium text-white">
                      {value.toFixed(1)}/{max}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-[color:var(--brand-400)]"
                      style={{ width: `${Math.max(4, Math.min(100, (value / max) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Manufacturer Fit</h4>
            <div className="mt-4 space-y-3">
              {field("Company", report.manufacturerFitCompany)}
              {field("MENA presence", report.manufacturerFitMenaPresence)}
              {field("Existing partners", report.manufacturerFitExistingPartners)}
              {field("Relevant contact", report.manufacturerFitRelevantContact)}
              <p className="text-sm leading-relaxed text-zinc-300">{report.manufacturerFitRationale}</p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Economics</h4>
            <div className="mt-4 grid gap-3">
              {field("Addressable patients", report.estimatedAddressablePatients)}
              {field("Potential units", report.potentialUnits)}
              {field("Price evidence", report.priceEvidence)}
              {field("Revenue range", report.potentialRevenueRange)}
              {field("Expected margin", report.expectedMarginRange)}
              {field("Confidence", report.economicsConfidence)}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Decision</h4>
            <div className="mt-3 flex items-start gap-2">
              {report.decision === "PURSUE" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
              )}
              <p className="text-sm leading-relaxed text-zinc-300">{report.nextAction}</p>
            </div>
            {report.rejectionReason && (
              <p className="mt-3 text-sm text-red-300">{report.rejectionReason}</p>
            )}
          </div>
        </div>
      </div>

      <details className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Evidence
        </summary>
        <div className="mt-4 grid gap-3">
          {evidence.length === 0 ? (
            <p className="text-sm text-zinc-500">No material evidence claims are stored yet.</p>
          ) : (
            evidence.map((item) => (
              <a
                key={item._id}
                href={normalizeExternalUrl(item.url) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{item.claim}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.sourceTier} · {item.sourceType} · retrieved {item.retrievalDate}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.excerpt}</p>
                  </div>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                </div>
              </a>
            ))
          )}
        </div>
      </details>
    </section>
  );
}
