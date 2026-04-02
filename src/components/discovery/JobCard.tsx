"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { JobLog } from "./JobLog";
import { Badge } from "@/components/ui/badge";
import { Building2, Pill, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDuration(startedAt: number, completedAt?: number): string {
  const end = completedAt ?? Date.now();
  const secs = Math.round((end - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-[color:var(--brand-surface)] text-[var(--brand-300)] border-[color:var(--brand-border)]",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface JobCardProps {
  jobId: Id<"discoveryJobs">;
  defaultExpanded?: boolean;
}

export function JobCard({ jobId, defaultExpanded = false }: JobCardProps) {
  const job = useQuery(api.discoveryJobs.get, { id: jobId });
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!job) return null;

  const isRunning = job.status === "running";

  return (
    <div
      className={cn(
        "rounded-lg border bg-zinc-900 transition-colors",
        isRunning ? "border-[color:var(--brand-border-strong)]" : "border-zinc-800"
      )}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors rounded-lg"
        onClick={() => setExpanded((e) => !e)}
      >
        <div
          className={cn(
            "rounded p-1.5",
            "bg-[color:var(--brand-surface)]"
          )}
        >
          {job.type === "companies" ? (
            <Building2 className="h-4 w-4 text-[var(--brand-300)]" />
          ) : (
            <Pill className="h-4 w-4 text-[var(--brand-300)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {job.type === "companies"
              ? "European Company Discovery"
              : `Drug Discovery — ${job.companyName ?? "Unknown Company"}`}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(job.startedAt)}
            </span>
            {(job.completedAt || isRunning) && (
              <span className="text-xs text-zinc-600">
                {formatDuration(job.startedAt, job.completedAt)}
              </span>
            )}
            {job.newItemsFound !== undefined && (
              <span className="text-xs text-emerald-500">
                +{job.newItemsFound} found
              </span>
            )}
            {job.skippedDuplicates !== undefined &&
              job.skippedDuplicates > 0 && (
                <span className="text-xs text-zinc-600">
                  {job.skippedDuplicates} skipped
                </span>
              )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={`text-xs border ${STATUS_STYLES[job.status]}`}
          >
            {isRunning ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-300)] animate-pulse" />
                running
              </span>
            ) : (
              job.status
            )}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-600" />
          )}
        </div>
      </button>

      {/* Expanded log */}
      {expanded && (
        <div className="px-4 pb-4">
          <JobLog log={job.log} status={job.status} />
          {job.errorMessage && (
            <p className="mt-2 text-xs text-red-400 font-mono">
              {job.errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
