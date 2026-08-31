"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Check, GitMerge, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewQueueView() {
  const items = useQuery(api.continuousOpportunityEngine.listReviewQueue, { status: "open", limit: 50 });
  const resolve = useMutation(api.continuousOpportunityEngine.resolveReviewItem);

  async function resolveAs(id: string, status: "approved" | "rejected" | "merged") {
    await resolve({
      id: id as Id<"reviewQueueItems">,
      status,
      reviewedBy: "KEMEDICA analyst",
      reviewNote: `${status} in review queue`,
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
          Review Queue
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Resolve ambiguous matches and rights evidence
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Items land here when the engine cannot safely resolve a substance, ownership, registration absence, or territory-rights claim.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="space-y-4">
          {items === undefined ? (
            <p className="text-sm text-zinc-500">Loading review queue...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
              No open review items.
            </div>
          ) : (
            items.map((item) => (
              <article key={item._id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-300">
                        {item.itemType.replaceAll("_", " ")}
                      </span>
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
                        {item.status}
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.summary}</p>
                    <p className="mt-3 text-sm text-zinc-400">
                      Proposed action: <span className="text-zinc-200">{item.proposedAction}</span>
                    </p>
                    <a
                      href={item.sourceUrl.startsWith("http") ? item.sourceUrl : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-xs font-medium text-[var(--brand-300)] hover:text-white"
                    >
                      {item.sourceRegistry}
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => resolveAs(item._id, "approved")}>
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolveAs(item._id, "merged")}>
                      <GitMerge className="h-4 w-4" />
                      Merge
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolveAs(item._id, "rejected")}>
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
