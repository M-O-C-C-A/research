"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Check, ExternalLink, FlaskConical, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeExternalUrl } from "@/lib/urlUtils";

type ProductResearch = FunctionReturnType<typeof api.researchWorkflow.listByDrug>;
type CompanyResearch = FunctionReturnType<typeof api.researchWorkflow.listByCompany>;
type ResearchFinding = ProductResearch["findings"][number] | CompanyResearch["findings"][number];

function formatDate(value?: number) {
  if (!value) return "Not finished";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function labelForKind(kind: ResearchFinding["kind"]) {
  return kind.replaceAll("_", " ");
}

function statusClass(status: ResearchFinding["status"]) {
  if (status === "approved") return "bg-emerald-400/10 text-emerald-200";
  if (status === "rejected") return "bg-zinc-800 text-zinc-400";
  return "bg-amber-400/10 text-amber-200";
}

export function ResearchButton({ target, targetId, className }: { target: "product" | "company"; targetId: string; className?: string }) {
  const [running, setRunning] = useState(false);
  const runProduct = useAction(api.evidenceResearch.runProductResearch);
  const runCompany = useAction(api.evidenceResearch.runCompanyResearch);

  async function run() {
    setRunning(true);
    try {
      if (target === "product") await runProduct({ drugId: targetId as Id<"drugs"> });
      else await runCompany({ companyId: targetId as Id<"companies"> });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void run(); }} disabled={running} className={className ?? "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}>
      {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1.5 h-3.5 w-3.5" />}
      {running ? "Researching" : "Research"}
    </Button>
  );
}

export function ResearchPanel({ target, targetId }: { target: "product" | "company"; targetId: string }) {
  const productData = useQuery(
    api.researchWorkflow.listByDrug,
    target === "product" ? { drugId: targetId as Id<"drugs"> } : "skip"
  );
  const companyData = useQuery(
    api.researchWorkflow.listByCompany,
    target === "company" ? { companyId: targetId as Id<"companies"> } : "skip"
  );
  const [running, setRunning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const runProduct = useAction(api.evidenceResearch.runProductResearch);
  const runCompany = useAction(api.evidenceResearch.runCompanyResearch);
  const approveFinding = useMutation(api.researchWorkflow.approveFinding);
  const rejectFinding = useMutation(api.researchWorkflow.rejectFinding);
  const data = target === "product" ? productData : companyData;

  async function runResearch() {
    setRunning(true);
    try {
      if (target === "product") await runProduct({ drugId: targetId as Id<"drugs"> });
      else await runCompany({ companyId: targetId as Id<"companies"> });
    } finally {
      setRunning(false);
    }
  }

  async function review(id: Id<"researchFindings">, decision: "approve" | "reject") {
    setWorkingId(id);
    try {
      if (decision === "approve") await approveFinding({ id });
      else await rejectFinding({ id });
    } finally {
      setWorkingId(null);
    }
  }

  const latestRun = data?.runs[0];
  const pendingCount = data?.findings.filter((finding) => finding.status === "pending").length ?? 0;

  return (
    <section className="border border-zinc-800 bg-zinc-950" aria-labelledby={`${target}-research`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-300)]">Evidence-first research</p>
          <h2 id={`${target}-research`} className="mt-1 text-lg font-semibold text-white">Research this {target}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">Saudi Arabia, UAE, and Egypt research creates reviewable claims with public sources. It does not change the profile or lead queue until you approve a claim.</p>
        </div>
        <Button onClick={() => void runResearch()} disabled={running} className="gap-2 bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)]">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {running ? "Researching" : `Research ${target}`}
        </Button>
      </div>

      {data === undefined ? (
        <div className="px-5 py-8 text-sm text-zinc-500">Loading research history...</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-800 px-5 py-3 text-xs text-zinc-500">
            <span><strong className="font-semibold text-zinc-200">{pendingCount}</strong> pending review</span>
            <span>Last run: {formatDate(latestRun?.completedAt ?? latestRun?.startedAt)}</span>
            {latestRun?.status === "error" && <span className="text-rose-300">{latestRun.errorMessage}</span>}
          </div>
          {data.findings.length === 0 ? (
            <div className="px-5 py-8 text-sm leading-relaxed text-zinc-500">No research findings yet. Run research to collect publicly sourced, reviewable evidence for this record.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {data.findings.map((finding) => {
                const sourceUrl = normalizeExternalUrl(finding.sourceUrl);
                const isWorking = workingId === finding._id;
                return (
                  <article key={finding._id} className="grid gap-3 px-5 py-4 lg:grid-cols-[10rem_minmax(0,1fr)_12rem]">
                    <div className="flex flex-wrap content-start gap-2">
                      <Badge className="border-0 bg-zinc-800 text-zinc-300 capitalize">{labelForKind(finding.kind)}</Badge>
                      <Badge className={`border-0 capitalize ${statusClass(finding.status)}`}>{finding.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm leading-relaxed text-zinc-200">{finding.claim}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{finding.excerpt}</p>
                      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--brand-300)] hover:text-white">{finding.sourceTitle} <ExternalLink className="h-3 w-3" /></a>}
                      <p className="mt-1 text-xs text-zinc-600">{finding.confidence} confidence · retrieved {formatDate(finding.retrievedAt)}</p>
                    </div>
                    {finding.status === "pending" ? (
                      <div className="flex items-start gap-2 lg:justify-end">
                        <Button size="sm" onClick={() => void review(finding._id, "approve")} disabled={isWorking} className="gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400">
                          {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void review(finding._id, "reject")} disabled={isWorking} className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800">
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-600 lg:justify-end"><RotateCcw className="h-3.5 w-3.5" /> Reviewed {formatDate(finding.reviewedAt)}</div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
