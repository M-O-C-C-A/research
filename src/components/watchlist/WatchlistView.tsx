"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Activity, Bell, Eye } from "lucide-react";

function eventClass(severity: string) {
  if (severity === "critical") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (severity === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

export function WatchlistView() {
  const watchlist = useQuery(api.continuousOpportunityEngine.listWatchlist);
  const events = useQuery(api.continuousOpportunityEngine.listChangeEvents, { limit: 30 });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
          Watchlist
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Tracked substances and change events
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          The value of the engine is the diff: approvals, registrations, withdrawals, rights changes, and threshold movement.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--brand-300)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
              Tracked substances
            </h2>
          </div>
          <div className="space-y-3">
            {(watchlist ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                No tracked substances yet. Add tracking from future asset-file actions or manual review.
              </div>
            ) : (
              watchlist?.map((item) => (
                <div key={item._id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="font-medium text-white">{item.productName ?? item.inn}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.companyName ?? "Company not set"}</p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.targetMarkets.map((market) => (
                      <span key={market} className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
                        {market}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--brand-300)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
              Change-event feed
            </h2>
          </div>
          <div className="space-y-3">
            {(events ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                No significant changes detected yet.
              </div>
            ) : (
              events?.map((event) => (
                <div key={event._id} className={`rounded-lg border p-4 ${eventClass(event.severity)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="mt-1 text-sm leading-relaxed opacity-90">{event.summary}</p>
                      <p className="mt-2 text-xs opacity-70">
                        {event.eventType.replaceAll("_", " ")} · {event.sourceRegistry}
                      </p>
                    </div>
                    {event.decisionOpportunityId && (
                      <Link
                        href={`/opportunities/${event.decisionOpportunityId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
