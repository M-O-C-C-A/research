"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { normalizeExternalUrl } from "@/lib/urlUtils";
import { ArrowRight, ExternalLink, Globe2, Linkedin, Mail, Sparkles, Target } from "lucide-react";
import { CardGridSkeleton } from "@/components/shared/LoadingSkeleton";
import { confidenceBadgeClass, statusBadgeClass } from "@/lib/decisionOpportunities";

export function PriorityMatchesWidget() {
  const cockpit = useQuery(api.dashboard.getCockpit, {});

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded bg-emerald-500/10 p-1.5">
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Decision-Ready Opportunities
            </h2>
            <p className="text-xs text-zinc-500">
              Ranked opportunities that already connect product, market, route, and contact direction
            </p>
          </div>
        </div>
      </div>

      {cockpit === undefined ? (
        <CardGridSkeleton count={4} />
      ) : cockpit.priorityMatches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No promoted opportunities yet. Rebuild the engine from your current gap and manufacturer research.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cockpit.priorityMatches.map((match) => {
            const websiteUrl = normalizeExternalUrl(match.companyWebsite);
            const companyLinkedinUrl = normalizeExternalUrl(match.companyLinkedinUrl);
            const contactLinkedinUrl = normalizeExternalUrl(match.contactLinkedinUrl);
            return (
              <Link
                key={match.id}
                href={match.href}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-950"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{match.productName}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {match.genericName} · {match.companyName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{match.priorityScore.toFixed(1)}</p>
                    <p className="text-[11px] text-zinc-500">rank #{match.rankingPosition ?? "—"}</p>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] ${statusBadgeClass(match.status)}`}>
                    {match.status.replace("_", " ")}
                  </span>
                  <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] ${confidenceBadgeClass(match.confidenceLevel)}`}>
                    {match.confidenceLevel} confidence
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {match.focusMarkets.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center rounded bg-[color:var(--brand-surface)] px-2 py-1 text-[11px] text-[var(--brand-300)]"
                    >
                      <Globe2 className="mr-1 h-3 w-3" />
                      {country}
                    </span>
                  ))}
                </div>

                <div className="space-y-2 text-xs text-zinc-400">
                  <p>{match.whyThisMarket}</p>
                  <p>{match.howToEnter}</p>
                  <div className="flex flex-wrap gap-3 text-zinc-300">
                    {websiteUrl && (
                      <p className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3 text-[var(--brand-300)]" />
                        Website
                      </p>
                    )}
                    {companyLinkedinUrl && (
                      <p className="inline-flex items-center gap-1">
                        <Linkedin className="h-3 w-3 text-[var(--brand-300)]" />
                        Company LinkedIn
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-zinc-300">
                    <p className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3 text-[var(--brand-300)]" />
                      {match.contactName ?? match.targetRole}
                    </p>
                    {match.contactEmail && <p>{match.contactEmail}</p>}
                    {contactLinkedinUrl && (
                      <p className="inline-flex items-center gap-1">
                        <Linkedin className="h-3 w-3 text-[var(--brand-300)]" />
                        LinkedIn
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                  Open opportunity
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
