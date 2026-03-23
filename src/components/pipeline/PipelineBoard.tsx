"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Building2,
  Star,
  Loader2,
  MessageSquare,
  X,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PIPELINE_STAGES,
  normalizePipelineStage,
} from "@/lib/distributorFit";

type BdStatus = (typeof PIPELINE_STAGES)[number]["key"];

const ALL_STAGES = PIPELINE_STAGES.map((stage) => ({
  ...stage,
  dot: stage.color,
  tab: stage.badge.replace("bg-", "text-").replace("/20", "").replace("/10", ""),
}));

const MENA_LABELS: Record<string, string> = {
  none:        "No MENA",
  limited:     "Limited MENA",
  established: "MENA present",
};

const MENA_COLORS: Record<string, string> = {
  none:        "bg-emerald-500/10 text-emerald-400",
  limited:     "bg-yellow-500/10 text-yellow-400",
  established: "bg-red-500/10 text-red-400",
};

// ──────────────────────────────────────────────────────────────
// Inline note form (shown below a row)
// ──────────────────────────────────────────────────────────────
function NoteForm({
  onSave,
  onCancel,
}: {
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2 items-start">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note…"
        className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded p-2 text-white resize-none h-16 focus:outline-none focus:border-zinc-500"
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          className="h-7 text-xs bg-zinc-700 hover:bg-zinc-600"
          onClick={() => { if (text.trim()) onSave(text.trim()); }}
          disabled={!text.trim()}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2 text-zinc-500"
          onClick={onCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Company row
// ──────────────────────────────────────────────────────────────
function CompanyRow({
  company,
  onStageChange,
  onNoteAdded,
  onEnrich,
  isEnriching,
}: {
  company: {
    _id: Id<"companies">;
    name: string;
    country: string;
    bdStatus?: string;
    bdScore?: number;
    distributorFitScore?: number;
    companySize?: string;
    targetSegment?: string;
    menaPresence?: string;
    menaChannelStatus?: string;
    priorityTier?: string;
    contactName?: string;
    therapeuticAreas: string[];
    researchedAt?: number;
  };
  onStageChange: (id: Id<"companies">, status: BdStatus) => void;
  onNoteAdded: (id: Id<"companies">, note: string) => void;
  onEnrich: (id: Id<"companies">) => void;
  isEnriching: boolean;
}) {
  const [showNote, setShowNote] = useState(false);
  const drugs = useQuery(api.drugs.listByCompany, { companyId: company._id });
  const topDrug = drugs?.[0];

  return (
    <div className="border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors">
        {/* BD Score */}
        <div className="w-14 shrink-0 text-right">
          {(company.distributorFitScore ?? company.bdScore) != null ? (
            <span className={`text-sm font-bold flex items-center justify-end gap-0.5 ${(company.distributorFitScore ?? company.bdScore)! >= 7 ? "text-emerald-400" : (company.distributorFitScore ?? company.bdScore)! >= 5 ? "text-yellow-400" : "text-zinc-500"}`}>
              <Star className="h-3 w-3" />
              {(company.distributorFitScore ?? company.bdScore)?.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-zinc-700">—</span>
          )}
        </div>

        {/* Company info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/companies/${company._id}`}
              className="text-sm font-medium text-white hover:text-cyan-400 transition-colors truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {company.name}
            </Link>
            {(company.targetSegment ?? company.companySize) && (
              <span className="text-xs text-zinc-600 uppercase shrink-0">{company.targetSegment ?? company.companySize}</span>
            )}
            {company.priorityTier && (
              <span className="text-xs rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300 shrink-0">
                {company.priorityTier.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-zinc-500">{company.country}</span>
            {(company.menaChannelStatus ?? company.menaPresence) && (
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${MENA_COLORS[company.menaChannelStatus ?? company.menaPresence ?? ""] ?? "bg-zinc-800 text-zinc-400"}`}>
                {MENA_LABELS[company.menaChannelStatus ?? company.menaPresence ?? ""] ?? (company.menaChannelStatus ?? company.menaPresence)}
              </span>
            )}
          </div>
        </div>

        {/* Top drug */}
        <div className="hidden sm:block w-36 shrink-0">
          {topDrug ? (
            <span className="text-xs text-zinc-400 bg-zinc-800 rounded px-2 py-1 truncate block">
              {topDrug.genericName}
              {drugs && drugs.length > 1 && <span className="text-zinc-600"> +{drugs.length - 1}</span>}
            </span>
          ) : (
            <span className="text-xs text-zinc-700">—</span>
          )}
        </div>

        {/* Contact */}
        <div className="hidden md:block w-32 shrink-0">
          <p className="text-xs text-zinc-500 truncate">
            {company.contactName ?? "—"}
          </p>
        </div>

        {/* Stage select */}
        <div className="w-36 shrink-0">
          <Select
            value={normalizePipelineStage(company.bdStatus)}
            onValueChange={(v) => onStageChange(company._id, v as BdStatus)}
          >
            <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700 text-zinc-300 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {ALL_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.dot}`} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!company.researchedAt && (
            <button
              onClick={() => onEnrich(company._id)}
              disabled={isEnriching}
              className="p-1.5 text-amber-600 hover:text-amber-400 transition-colors rounded"
              title="Build full pursuit dossier"
            >
              {isEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-xs">⚡</span>}
            </button>
          )}
          {company.researchedAt && (
            <span className="text-xs text-emerald-600" title={`Researched ${new Date(company.researchedAt).toLocaleDateString()}`}>✓</span>
          )}
          <button
            onClick={() => setShowNote((v) => !v)}
            className="p-1.5 text-zinc-700 hover:text-zinc-400 transition-colors rounded"
            title="Add note"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <Link
            href={`/companies/${company._id}`}
            className="p-1.5 text-zinc-700 hover:text-zinc-400 transition-colors rounded"
            title="Open company"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Inline note form */}
      {showNote && (
        <div className="px-4 pb-3">
          <NoteForm
            onSave={(text) => { onNoteAdded(company._id, text); setShowNote(false); }}
            onCancel={() => setShowNote(false)}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Pipeline Board
// ──────────────────────────────────────────────────────────────
export function PipelineBoard() {
  const [activeStage, setActiveStage] = useState<BdStatus>("screened");
  const [search, setSearch] = useState("");
  const [scoringId, setScoringId] = useState<Id<"companies"> | null>(null);

  const allCompanies = useQuery(api.companies.list, {});
  const pipelineStats = useQuery(api.companies.pipelineStats, {});
  const moveStage = useMutation(api.companies.moveStage);
  const addNote = useMutation(api.bdActivities.create);
  const scoreCompany = useAction(api.discovery.scoreCompanyForBD);
  const buildDossier = useAction(api.research.buildProspectDossier);
  const runQueue = useAction(api.research.runProspectResearchQueue);
  const [enrichingId, setEnrichingId] = useState<Id<"companies"> | null>(null);
  const [isQueueRunning, setIsQueueRunning] = useState(false);

  async function handleEnrichCompany(id: Id<"companies">) {
    setEnrichingId(id);
    try { await buildDossier({ companyId: id }); } finally { setEnrichingId(null); }
  }

  async function handleRunQueue() {
    setIsQueueRunning(true);
    try { await runQueue({ limit: 3 }); } finally { setIsQueueRunning(false); }
  }

  async function handleStageChange(id: Id<"companies">, newStatus: BdStatus) {
    await moveStage({ id, newStatus });
  }

  async function handleNoteAdded(id: Id<"companies">, note: string) {
    await addNote({ companyId: id, type: "note", content: note });
  }

  async function handleScoreAll() {
    if (!allCompanies) return;
    const unscored = allCompanies
      .filter((c) => c.distributorFitScore == null && c.bdScore == null)
      .slice(0, 5);
    for (const c of unscored) {
      setScoringId(c._id);
      try { await scoreCompany({ companyId: c._id }); } catch { /* continue */ }
    }
    setScoringId(null);
  }

  // Filter to active stage + search
  const stageCompanies = (allCompanies ?? []).filter((c) => {
    const stage = normalizePipelineStage(c.bdStatus);
    if (stage !== activeStage) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.therapeuticAreas.some((a) => a.toLowerCase().includes(q))
      );
    }
    return true;
  }).sort(
    (a, b) =>
      (b.distributorFitScore ?? b.bdScore ?? 0) -
      (a.distributorFitScore ?? a.bdScore ?? 0)
  );

  const unscoredCount = (allCompanies ?? []).filter((c) => c.distributorFitScore == null && c.bdScore == null).length;

  if (!allCompanies) {
    return (
      <div className="py-10">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Outreach Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track manufacturers from first review through active outreach and outcome
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unscoredCount > 0 && (
            <Button variant="outline" size="sm" className="border-zinc-700 hover:bg-zinc-800 text-xs" onClick={handleScoreAll} disabled={scoringId != null}>
              {scoringId != null ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Scoring…</> : <>Score {Math.min(unscoredCount, 5)} unscored</>}
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-zinc-700 hover:bg-zinc-800 text-xs" onClick={handleRunQueue} disabled={isQueueRunning}>
            {isQueueRunning ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Enriching…</> : <>⚡ Enrich 3 targets</>}
          </Button>
          <Link href="/companies">
            <Button variant="outline" size="sm" className="border-zinc-700 hover:bg-zinc-800 text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              All Companies
            </Button>
          </Link>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {ALL_STAGES.map((stage) => {
          const count = pipelineStats?.counts[stage.key] ?? 0;
          const isActive = activeStage === stage.key;
          return (
            <button
              key={stage.key}
              onClick={() => setActiveStage(stage.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                isActive
                  ? `${stage.tab} bg-zinc-800`
                  : "text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stage.dot}`} />
              {stage.label}
              <span className={`tabular-nums text-xs ${isActive ? "" : "text-zinc-700"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, country or therapeutic area…"
          className="w-full pl-8 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-800/50">
          <div className="w-14 shrink-0 text-right">
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Score</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Company</span>
          </div>
          <div className="hidden sm:block w-36 shrink-0">
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Top Drug</span>
          </div>
          <div className="hidden md:block w-32 shrink-0">
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Contact</span>
          </div>
          <div className="w-36 shrink-0">
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Stage</span>
          </div>
          <div className="w-16 shrink-0" />
        </div>

        {stageCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-10 w-10 text-zinc-800 mb-3" />
            <p className="text-sm text-zinc-600">
              {search ? "No companies match your search" : `No companies in ${ALL_STAGES.find(s => s.key === activeStage)?.label ?? activeStage}`}
            </p>
            {activeStage === "screened" && !search && (
              <p className="text-xs text-zinc-700 mt-1">
                Run a gap analysis and find suppliers. Shortlisted manufacturers will appear here first.
              </p>
            )}
          </div>
        ) : (
          stageCompanies.map((company) => (
            <CompanyRow
              key={company._id}
              company={company}
              onStageChange={handleStageChange}
              onNoteAdded={handleNoteAdded}
              onEnrich={(id) => handleEnrichCompany(id)}
              isEnriching={enrichingId === company._id}
            />
          ))
        )}
      </div>

      {stageCompanies.length > 0 && (
        <p className="text-xs text-zinc-700 mt-3 text-right">
          {stageCompanies.length} compan{stageCompanies.length !== 1 ? "ies" : "y"} · sorted by distributor fit
        </p>
      )}
    </div>
  );
}
