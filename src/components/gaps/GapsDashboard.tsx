"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { THERAPEUTIC_AREAS, MENA_COUNTRIES } from "@/lib/constants";
import {
  Target,
  TrendingUp,
  Zap,
  X,
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  MapPin,
  Star,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PIPELINE_STAGE_BADGES,
  PIPELINE_STAGE_LABELS,
  normalizePipelineStage,
  priorityTierLabel,
} from "@/lib/distributorFit";
import { normalizeExternalUrl } from "@/lib/urlUtils";

export type Gap = {
  _id: Id<"gapOpportunities">;
  therapeuticArea: string;
  indication: string;
  targetCountries: string[];
  gapScore: number;
  gapType?: "regulatory_gap" | "formulary_gap" | "shortage_gap" | "tender_pull" | "channel_whitespace";
  validationStatus?: "confirmed" | "likely" | "insufficient_evidence";
  evidenceSummary?: string;
  verifiedRegisteredCount?: number;
  verifiedMissingCount?: number;
  demandEvidence: string;
  supplyGap: string;
  competitorLandscape: string;
  suggestedDrugClasses: string[];
  tenderSignals?: string;
  whoDiseaseBurden?: string;
  regulatoryFeasibility?: "high" | "medium" | "low";
  linkedCompanyIds?: Id<"companies">[];
  linkedDrugIds?: Id<"drugs">[];
  sources?: { title: string; url: string }[];
  evidenceItems?: Array<{
    claim: string;
    title: string;
    url: string;
    sourceKind:
      | "official_registry"
      | "ema"
      | "government_publication"
      | "tender_portal"
      | "who_or_gbd"
      | "market_report";
    country?: string;
    productOrClass?: string;
    confidence: "confirmed" | "likely" | "inferred";
  }>;
};

const LOG_LEVEL_COLOR: Record<string, string> = {
  info: "text-zinc-400",
  success: "text-emerald-400",
  warning: "text-yellow-400",
  error: "text-red-400",
};

export function GapScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-red-500/20 text-red-300 border border-red-500/30"
      : score >= 6
        ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
        : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-bold tabular-nums ${color}`}
    >
      <Target className="h-3 w-3" />
      {score.toFixed(1)}/10
    </span>
  );
}

export function FeasibilityBadge({ level }: { level?: "high" | "medium" | "low" }) {
  if (!level) return null;
  const styles = {
    high: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    low: "bg-red-500/10 text-red-400 border border-red-500/20",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[level]}`}>
      reg. {level}
    </span>
  );
}

export function formatGapType(value?: Gap["gapType"]) {
  return value ? value.replace(/_/g, " ") : "mixed";
}

export function ValidationStatusBadge({
  status,
}: {
  status?: Gap["validationStatus"];
}) {
  if (!status) return null;
  const styles = {
    confirmed: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
    likely: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
    insufficient_evidence: "bg-zinc-800 text-zinc-300 border border-zinc-700",
  } as const;
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${styles[status]}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// Supplier Search Dialog (modal overlay)
// ──────────────────────────────────────────────────────────────
export function SupplierSearchDialog({
  gap,
  onClose,
}: {
  gap: Gap;
  onClose: () => void;
}) {
  const [jobId, setJobId] = useState<Id<"discoveryJobs"> | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const findCompaniesForGap = useAction(api.discovery.findCompaniesForGap);
  const job = useQuery(
    api.discoveryJobs.get,
    jobId ? { id: jobId } : "skip"
  );

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job?.log?.length]);

  async function handleLaunch() {
    setIsLaunching(true);
    try {
      const id = await findCompaniesForGap({ gapOpportunityId: gap._id });
      setJobId(id as Id<"discoveryJobs">);
    } catch {
      setIsLaunching(false);
    }
  }

  const isDone = job?.status === "completed" || job?.status === "error";
  const phase: "confirm" | "running" | "done" = !jobId
    ? "confirm"
    : isDone
      ? "done"
      : "running";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={phase !== "running" ? onClose : undefined}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">
              {phase === "confirm" && "Find EU Suppliers"}
              {phase === "running" && "Searching for suppliers…"}
              {phase === "done" &&
                (job?.status === "completed" ? "Search complete" : "Search failed")}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{gap.indication}</p>
          </div>
          {phase !== "running" && (
            <button
              onClick={onClose}
              className="ml-3 shrink-0 p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {phase === "confirm" && (
            <>
              <p className="text-sm text-zinc-300 leading-relaxed">
                KEMEDICA will search for European pharmaceutical companies that
                manufacture drugs matching this gap. The search prioritises SME
                and mid-size manufacturers with{" "}
                <span className="text-white font-medium">no existing MENA presence</span>{" "}
                — the ideal targets for a MENA distribution partnership.
              </p>
              <div className="rounded-lg bg-zinc-800 p-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Indication</p>
                  <p className="text-zinc-200">{gap.indication}</p>
                </div>
                {gap.suggestedDrugClasses.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Drug classes to source</p>
                    <div className="flex flex-wrap gap-1">
                      {gap.suggestedDrugClasses.map((cls) => (
                        <span key={cls} className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-2 py-0.5">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Target markets</p>
                  <p className="text-zinc-300">
                    {gap.targetCountries.slice(0, 6).join(", ")}
                    {gap.targetCountries.length > 6 ? ` +${gap.targetCountries.length - 6} more` : ""}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                <p className="text-xs text-cyan-300 leading-relaxed">
                  All companies found will be added to your registry, assigned a distributor-fit
                  score, and linked to this gap as potential distribution partners.
                </p>
              </div>
            </>
          )}

          {(phase === "running" || phase === "done") && (
            <>
              <div className="flex items-start gap-2.5">
                {phase === "running" && <Loader2 className="h-4 w-4 text-cyan-400 animate-spin shrink-0 mt-0.5" />}
                {phase === "done" && job?.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
                {phase === "done" && job?.status === "error" && <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {phase === "running" && "Researching EU manufacturers — this typically takes 30–90 seconds…"}
                  {phase === "done" && job?.status === "completed" &&
                    `Found ${job.newItemsFound ?? 0} new compan${(job.newItemsFound ?? 0) !== 1 ? "ies" : "y"} (${job.skippedDuplicates ?? 0} already in registry). All linked to this gap.`}
                  {phase === "done" && job?.status === "error" && (job.errorMessage ?? "The search encountered an error.")}
                </p>
              </div>

              {job?.log && job.log.length > 0 && (
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 max-h-52 overflow-y-auto font-mono text-xs space-y-0.5">
                  {job.log.map((entry, i) => (
                    <p key={i} className={LOG_LEVEL_COLOR[entry.level] ?? "text-zinc-400"}>
                      <span className="text-zinc-700 select-none">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}{" "}
                      </span>
                      {entry.message}
                    </p>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}

              {phase === "done" && job?.status === "completed" && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    Close this window — the gap card will now show the linked suppliers.
                    Head to the{" "}
                    <Link href="/pipeline" className="underline hover:text-emerald-200 transition-colors">
                      Pipeline
                    </Link>{" "}
                    to start outreach.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          {phase === "confirm" && (
            <>
              <Button variant="outline" size="sm" className="border-zinc-700 hover:bg-zinc-800" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={handleLaunch} disabled={isLaunching}>
                {isLaunching ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Launching…</> : <><Search className="h-3 w-3 mr-1.5" />Find Suppliers</>}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button variant="outline" size="sm" disabled className="border-zinc-700 text-zinc-500">
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Searching…
            </Button>
          )}
          {phase === "done" && (
            <Button size="sm" className="bg-zinc-700 hover:bg-zinc-600 text-white" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Gap Detail Slide-Over
// ──────────────────────────────────────────────────────────────
export function GapDetailPanel({
  gap,
  onClose,
  onArchive,
}: {
  gap: Gap;
  onClose: () => void;
  onArchive: (id: Id<"gapOpportunities">) => void;
}) {
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const linkedCompanies = useQuery(
    api.companies.listByIds,
    gap.linkedCompanyIds && gap.linkedCompanyIds.length > 0
      ? { ids: gap.linkedCompanyIds }
      : "skip"
  );
  const gapMatches = useQuery(api.gapCompanyMatches.listByGap, {
    gapOpportunityId: gap._id,
    limit: 20,
  });
  const promotedOpportunities = useQuery(api.decisionOpportunities.listByGapOpportunity, {
    gapOpportunityId: gap._id,
  });

  const supplierCount = gap.linkedCompanyIds?.length ?? 0;
  const linkedDrugCount = gap.linkedDrugIds?.length ?? 0;

  return (
    <>
      {showSupplierDialog && (
        <SupplierSearchDialog gap={gap} onClose={() => setShowSupplierDialog(false)} />
      )}

      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        {/* Panel */}
        <div className="relative w-full max-w-xl h-full bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-zinc-800 shrink-0">
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <GapScoreBadge score={gap.gapScore} />
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{gap.therapeuticArea}</span>
                <FeasibilityBadge level={gap.regulatoryFeasibility} />
                <ValidationStatusBadge status={gap.validationStatus} />
                {gap.gapType && (
                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                    {formatGapType(gap.gapType)}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-white leading-snug">{gap.indication}</h2>
            </div>
            <button onClick={onClose} className="shrink-0 p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-6">

              {/* Target countries */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Target Markets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {gap.targetCountries.map((c) => (
                    <span key={c} className="text-xs bg-zinc-800 text-zinc-300 rounded px-2 py-1">{c}</span>
                  ))}
                </div>
              </div>

              {/* Demand evidence */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Demand Evidence</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{gap.demandEvidence}</p>
              </div>

              {(gap.evidenceSummary || gap.verifiedMissingCount != null || gap.verifiedRegisteredCount != null) && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Validation</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {gap.evidenceSummary ?? "Structured evidence captured for this gap."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                    {gap.verifiedMissingCount != null && (
                      <span className="rounded bg-zinc-800 px-2 py-1">
                        {gap.verifiedMissingCount} verified missing
                      </span>
                    )}
                    {gap.verifiedRegisteredCount != null && (
                      <span className="rounded bg-zinc-800 px-2 py-1">
                        {gap.verifiedRegisteredCount} verified registered
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* WHO disease burden */}
              {gap.whoDiseaseBurden && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">WHO Disease Burden</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{gap.whoDiseaseBurden}</p>
                </div>
              )}

              {/* Supply gap */}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Supply Gap</p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {gap.validationStatus === "insufficient_evidence"
                    ? gap.evidenceSummary ?? gap.supplyGap
                    : gap.supplyGap}
                </p>
              </div>

              {/* Competitor landscape */}
              {gap.competitorLandscape && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Competitor Landscape</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{gap.competitorLandscape}</p>
                </div>
              )}

              {/* Tender signals */}
              {gap.tenderSignals && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-cyan-400" /> Tender Signals
                  </p>
                  <pre className="text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                    {gap.tenderSignals}
                  </pre>
                </div>
              )}

              {/* Drug classes */}
              {gap.suggestedDrugClasses.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Drug Classes to Source</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gap.suggestedDrugClasses.map((cls) => (
                      <span key={cls} className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-2 py-1">{cls}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {gap.sources && gap.sources.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Sources</p>
                  <ul className="space-y-1">
                    {gap.sources.map((s, i) => (
                      <li key={i}>
                        {normalizeExternalUrl(s.url) ? (
                          <a href={normalizeExternalUrl(s.url)!} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 underline transition-colors">
                            {s.title}
                          </a>
                        ) : (
                          <span className="text-xs text-zinc-500">{s.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {gap.evidenceItems && gap.evidenceItems.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Evidence Snapshot</p>
                  <div className="space-y-2">
                    {gap.evidenceItems.slice(0, 5).map((item) => (
                      <a
                        key={`${item.url}-${item.claim}`}
                        href={normalizeExternalUrl(item.url) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 hover:border-zinc-700"
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
                </div>
              )}

              {/* ── Linked Suppliers ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Linked Suppliers
                    {supplierCount > 0 && (
                      <span className="ml-1 text-emerald-400 font-bold">{supplierCount}</span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                    onClick={() => setShowSupplierDialog(true)}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    {supplierCount > 0 ? "Search Again" : "Find Suppliers"}
                  </Button>
                </div>

                {supplierCount === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center">
                    <p className="text-sm text-zinc-600">No suppliers linked yet.</p>
                    <p className="text-xs text-zinc-700 mt-1">
                      Click &ldquo;Find Suppliers&rdquo; to discover EU manufacturers for this gap.
                    </p>
                  </div>
                ) : linkedCompanies === undefined ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-14 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(gapMatches ?? linkedCompanies ?? []).map((entry) => {
                      const c = "company" in entry ? entry.company : entry;
                      if (!c) return null;
                      const stage = normalizePipelineStage(c.bdStatus);
                      const priorityLabel = priorityTierLabel(c.priorityTier);

                      return (
                        <Link
                          key={c._id}
                          href={`/companies/${c._id}`}
                          className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {(c.distributorFitScore ?? c.bdScore) != null && (
                                <span className={`text-xs font-bold flex items-center gap-0.5 ${(c.distributorFitScore ?? c.bdScore)! >= 7 ? "text-emerald-400" : (c.distributorFitScore ?? c.bdScore)! >= 5 ? "text-yellow-400" : "text-zinc-500"}`}>
                                  <Star className="h-2.5 w-2.5" />{(c.distributorFitScore ?? c.bdScore)?.toFixed(1)}
                                </span>
                              )}
                              {(c.targetSegment ?? c.companySize) && (
                                <span className="text-xs text-zinc-600 uppercase">{c.targetSegment ?? c.companySize}</span>
                              )}
                              {(c.menaChannelStatus ?? c.menaPresence) && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${(c.menaChannelStatus ?? c.menaPresence) === "none" ? "bg-emerald-500/10 text-emerald-400" : (c.menaChannelStatus ?? c.menaPresence) === "limited" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"}`}>
                                  {(c.menaChannelStatus ?? c.menaPresence) === "none" ? "No MENA" : (c.menaChannelStatus ?? c.menaPresence) === "limited" ? "Limited MENA" : "MENA present"}
                                </span>
                              )}
                              {priorityLabel && (
                                <span className="text-xs rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
                                  {priorityLabel}
                                </span>
                              )}
                              {c.bdStatus && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${PIPELINE_STAGE_BADGES[stage] ?? "bg-zinc-700 text-zinc-300"}`}>
                                  {PIPELINE_STAGE_LABELS[stage] ?? stage}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-white truncate">{c.name}</p>
                            <p className="text-xs text-zinc-500">{c.country}</p>
                            {"rationale" in entry && entry.rationale && (
                              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{entry.rationale}</p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Promotion Status</p>
                {promotedOpportunities === undefined ? (
                  <div className="h-14 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
                ) : promotedOpportunities.length > 0 ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-sm text-emerald-300">
                      {promotedOpportunities.length} promoted decision opportunit{promotedOpportunities.length === 1 ? "y" : "ies"} available for this gap.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {promotedOpportunities.map((opportunity) => (
                        <Link
                          key={opportunity._id}
                          href={`/opportunities/${opportunity._id}`}
                          className="text-xs text-cyan-400 underline hover:text-cyan-300"
                        >
                          #{opportunity.rankingPosition ?? "—"} {opportunity.productName}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : supplierCount > 0 && linkedDrugCount === 0 ? (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                    <p className="text-sm text-yellow-300">
                      Research complete but not promotable yet: suppliers were found, but no relevant drugs are linked to this gap yet.
                    </p>
                  </div>
                ) : supplierCount > 0 ? (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                    <p className="text-sm text-yellow-300">
                      Products are linked, but confidence is still too weak to promote a decision-ready opportunity from this gap.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-sm text-zinc-500">
                      No promoted opportunities yet. Run supplier discovery first, then the system will try to link products and promote opportunities automatically.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer actions */}
          <div className="shrink-0 border-t border-zinc-800 p-4 flex justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
              onClick={() => { onArchive(gap._id); onClose(); }}
            >
              Archive Gap
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 hover:bg-zinc-800"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Gap Opportunity Card (grid item)
// ──────────────────────────────────────────────────────────────
function GapOpportunityCard({
  gap,
  onClick,
  onArchive,
}: {
  gap: Gap;
  onClick: () => void;
  onArchive: (id: Id<"gapOpportunities">) => void;
}) {
  const supplierCount = gap.linkedCompanyIds?.length ?? 0;

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3 cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/60 transition-colors group"
      onClick={onClick}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <GapScoreBadge score={gap.gapScore} />
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{gap.therapeuticArea}</span>
            <FeasibilityBadge level={gap.regulatoryFeasibility} />
            <ValidationStatusBadge status={gap.validationStatus} />
            {gap.gapType && (
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                {formatGapType(gap.gapType)}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-white mt-1 group-hover:text-cyan-300 transition-colors">
            {gap.indication}
          </h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {gap.targetCountries.slice(0, 4).map((c) => (
              <span key={c} className="text-xs text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">{c}</span>
            ))}
            {gap.targetCountries.length > 4 && (
              <span className="text-xs text-zinc-600">+{gap.targetCountries.length - 4} more</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(gap._id); }}
          className="shrink-0 p-1 text-zinc-700 hover:text-zinc-400 transition-colors"
          title="Archive"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Demand evidence */}
      <p className="text-sm text-zinc-400 line-clamp-2">
        {gap.evidenceSummary ?? gap.demandEvidence}
      </p>

      {/* Drug classes */}
      {gap.suggestedDrugClasses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {gap.suggestedDrugClasses.slice(0, 4).map((cls) => (
            <span key={cls} className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-2 py-0.5">{cls}</span>
          ))}
          {gap.suggestedDrugClasses.length > 4 && (
            <span className="text-xs text-zinc-600">+{gap.suggestedDrugClasses.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer: tender signals + supplier count */}
      <div className="flex items-center justify-between pt-1 text-xs text-zinc-600">
        <div className="flex items-center gap-3">
          {(gap.verifiedMissingCount ?? 0) > 0 && (
            <span className="text-emerald-400">{gap.verifiedMissingCount} verified missing</span>
          )}
          {gap.tenderSignals && (
            <span className="flex items-center gap-1 text-cyan-500">
              <Zap className="h-3 w-3" /> Tender signals
            </span>
          )}
        </div>
        {supplierCount > 0 ? (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <Building2 className="h-3 w-3" />
            {supplierCount} supplier{supplierCount !== 1 ? "s" : ""} linked
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-600">
            <Search className="h-3 w-3" /> Find suppliers →
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Dashboard
// ──────────────────────────────────────────────────────────────
export function GapsDashboard() {
  const router = useRouter();
  const [selectedTA, setSelectedTA] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [minScore, setMinScore] = useState<number>(0);
  const [isRunningFlow, setIsRunningFlow] = useState(false);
  const [analysisScope, setAnalysisScope] = useState<"all_areas" | "use_filters">("all_areas");
  const [lastFlowJobId, setLastFlowJobId] = useState<Id<"discoveryJobs"> | null>(null);

  const gaps = useQuery(api.gapOpportunities.list, {
    therapeuticArea: selectedTA || undefined,
    status: "active",
  });
  const flowJob = useQuery(
    api.discoveryJobs.get,
    lastFlowJobId ? { id: lastFlowJobId } : "skip"
  );

  const archiveGap = useMutation(api.gapOpportunities.update);
  const runGapFlow = useAction(api.gapAnalysis.runGapAnalysisFlow);

  const filteredGaps = (gaps ?? []).filter((g) => {
    if (g.gapScore < minScore) return false;
    if (selectedCountry && !g.targetCountries.includes(selectedCountry)) return false;
    return true;
  });

  async function handleAnalyzeFlow() {
    if (isRunningFlow) return;
    setIsRunningFlow(true);
    try {
      const jobId = await runGapFlow({
        mode: analysisScope === "all_areas" ? "all_areas" : "single_area",
        therapeuticArea: analysisScope === "use_filters" ? selectedTA || undefined : undefined,
        country: selectedCountry || undefined,
      });
      setLastFlowJobId(jobId as Id<"discoveryJobs">);
    } finally {
      setIsRunningFlow(false);
    }
  }

  async function handleArchive(id: Id<"gapOpportunities">) {
    await archiveGap({ id, status: "archived" });
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Gap Analysis</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Identify MENA demand gaps and shortlist smaller EU manufacturers that can bridge them
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 mb-6">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Filters</p>
                <p className="mt-1 text-xs text-zinc-600">These only change the visible gap list below.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-[180px]">
                  <label className="block text-xs text-zinc-500 mb-1.5">Filter therapeutic area</label>
                  <Select value={selectedTA} onValueChange={(v) => setSelectedTA(v ?? "")}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-9">
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="">All areas</SelectItem>
                      {THERAPEUTIC_AREAS.map((ta) => (
                        <SelectItem key={ta} value={ta}>{ta}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[160px]">
                  <label className="block text-xs text-zinc-500 mb-1.5">Filter country</label>
                  <Select value={selectedCountry} onValueChange={(v) => setSelectedCountry(v ?? "")}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-9">
                      <SelectValue placeholder="All MENA" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="">All MENA</SelectItem>
                      {MENA_COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Run analysis</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Gap analysis creates research gaps. Promoted opportunities appear after supplier and product linking complete.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="min-w-[180px]">
                  <label className="block text-xs text-zinc-500 mb-1.5">Analysis scope</label>
                  <Select
                    value={analysisScope}
                    onValueChange={(v) =>
                      setAnalysisScope((v as "all_areas" | "use_filters") ?? "all_areas")
                    }
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="all_areas">All therapeutic areas</SelectItem>
                      <SelectItem value="use_filters">Use current filters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[180px]">
                  <label className="block text-xs text-zinc-500 mb-1.5">Analysis countries</label>
                  <div className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-3 flex items-center text-sm text-zinc-300">
                    {selectedCountry || "All MENA"}
                  </div>
                </div>

                <Button
                  onClick={handleAnalyzeFlow}
                  disabled={isRunningFlow || (analysisScope === "use_filters" && !selectedTA)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white h-9 shrink-0"
                >
                  {isRunningFlow ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Running flow…</>
                  ) : (
                    "Analyze Gaps"
                  )}
                </Button>
              </div>

              <p className="text-xs text-zinc-500">
                {analysisScope === "all_areas"
                  ? "Recommended: run all therapeutic areas sequentially."
                  : selectedTA
                    ? `This run will analyze ${selectedTA}${selectedCountry ? ` in ${selectedCountry}` : " using the current country scope"}.`
                    : "Select a therapeutic-area filter to run only the current slice."}
              </p>
            </div>
          </div>

          <div className="mt-4 min-w-[120px]">
            <label className="block text-xs text-zinc-500 mb-1.5">Min Score: {minScore}</label>
            <input
              type="range" min={0} max={9} step={1} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-cyan-500 h-9"
            />
          </div>
        </div>

        {flowJob && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Latest analysis flow</p>
                <p className="mt-1 text-sm text-zinc-300">
                  {flowJob.status === "running"
                    ? "Running end-to-end: gap analysis -> suppliers -> products -> opportunity promotion"
                    : flowJob.summary ?? "Analysis flow finished."}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                flowJob.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : flowJob.status === "error"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-cyan-500/10 text-cyan-300"
              }`}>
                {flowJob.status}
              </span>
            </div>

            {flowJob.log.length > 0 && (
              <div className="mt-4 rounded-lg bg-zinc-950 border border-zinc-800 p-3 max-h-56 overflow-y-auto font-mono text-xs space-y-1">
                {flowJob.log.map((entry, i) => (
                  <p key={i} className={LOG_LEVEL_COLOR[entry.level] ?? "text-zinc-400"}>
                    <span className="text-zinc-700 select-none">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                    </span>
                    {entry.message}
                  </p>
                ))}
              </div>
            )}

            {flowJob.status === "completed" && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
                  Promoted opportunities: {flowJob.newItemsFound ?? 0}
                </span>
                <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
                  Not promotable yet: {flowJob.skippedDuplicates ?? 0}
                </span>
                {(flowJob.newItemsFound ?? 0) > 0 && (
                  <Link
                    href="/gaps#top-opportunities"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View promoted opportunities
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {gaps === undefined ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : filteredGaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Target className="h-12 w-12 text-zinc-700 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No gap opportunities found</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm">
              Select a therapeutic area above and click &ldquo;Analyze Gaps&rdquo; to discover
              where EU drugs could fill MENA market gaps.
            </p>
            <TrendingUp className="h-6 w-6 text-zinc-700" />
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-4">
              {filteredGaps.length} gap{filteredGaps.length !== 1 ? "s" : ""} found
              <span className="ml-2 text-zinc-600">· click any card to see details and find suppliers</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredGaps
                .sort((a, b) => b.gapScore - a.gapScore)
                .map((gap) => (
                  <GapOpportunityCard
                    key={gap._id}
                    gap={gap}
                    onClick={() => router.push(`/gaps/${gap._id}`)}
                    onArchive={handleArchive}
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
