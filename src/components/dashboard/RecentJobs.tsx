"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Building2, Pill, ArrowRight } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  running: "bg-[color:var(--brand-surface)] text-[var(--brand-300)] border-[color:var(--brand-border)]",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
};

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

export function RecentJobs() {
  const jobs = useQuery(api.discoveryJobs.recentStats, {});

  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Recent Discovery Runs
        </h2>
        <Link
          href="/discovery"
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-zinc-800">
        {jobs.map((job) => (
          <Link
            key={job._id}
            href={`/discovery?job=${job._id}`}
            className="group flex items-center gap-3 py-2.5 hover:text-white transition-colors"
          >
            <div
              className="rounded p-1 shrink-0 bg-[color:var(--brand-surface)]"
            >
              {job.type === "companies" ? (
                <Building2 className="h-3.5 w-3.5 text-[var(--brand-300)]" />
              ) : (
                <Pill className="h-3.5 w-3.5 text-[var(--brand-300)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">
                {job.type === "companies"
                  ? "Company scan"
                  : job.companyName ?? "Drug scan"}
              </p>
              <p className="text-xs text-zinc-600">{timeAgo(job.startedAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {job.newItemsFound !== undefined && (
                <span className="text-xs text-emerald-500">
                  +{job.newItemsFound}
                </span>
              )}
              <Badge
                variant="secondary"
                className={`text-xs border px-1.5 py-0 ${STATUS_STYLES[job.status]}`}
              >
                {job.status === "running" ? (
                  <span className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-[var(--brand-300)] animate-pulse" />
                    live
                  </span>
                ) : (
                  job.status
                )}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
