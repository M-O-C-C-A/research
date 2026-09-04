"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Check, GitMerge, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ReviewQueueView() {
  const items = useQuery(api.continuousOpportunityEngine.listReviewQueue, {
    status: "open",
    limit: 50,
  });
  const evidenceReviews = useQuery(api.evidenceFunnel.list, {
    stage: "needs_evidence",
    queue: "working",
    limit: 20,
  });
  const resolve = useMutation(
    api.continuousOpportunityEngine.resolveReviewItem,
  );

  async function resolveAs(
    id: string,
    status: "approved" | "rejected" | "merged",
  ) {
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
          Items land here when the engine cannot safely resolve a substance,
          ownership, registration absence, or territory-rights claim.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-6 border-b border-zinc-700 pb-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
            Country evidence reviews
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            These v1.1 pursuits still have unresolved G1–G7 evidence.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(evidenceReviews ?? []).filter(Boolean).flatMap((row) =>
              row
                ? row.assessments
                    .filter((assessment) => assessment.criticalReviewOpen)
                    .map((assessment) => (
                      <Link
                        key={assessment._id}
                        href="/opportunities"
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 hover:border-amber-400"
                      >
                        <p className="font-medium text-white">
                          {row.opportunity.productName} · {assessment.country}
                        </p>
                        <p className="mt-1 text-xs text-amber-100">
                          {assessment.blockers[0] ??
                            "Evidence review is still open."}
                        </p>
                      </Link>
                    ))
                : [],
            )}
            {evidenceReviews !== undefined &&
            evidenceReviews.filter(Boolean).length === 0 ? (
              <p className="text-sm text-zinc-500">
                No v1.1 country reviews are waiting.
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-4">
          {items === undefined ? (
            <p className="text-sm text-zinc-500">Loading review queue...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
              No open review items.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item._id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
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
                    <h2 className="mt-3 text-base font-semibold text-white">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                      {item.summary}
                    </p>
                    <p className="mt-3 text-sm text-zinc-400">
                      Proposed action:{" "}
                      <span className="text-zinc-200">
                        {item.proposedAction}
                      </span>
                    </p>
                    <a
                      href={
                        item.sourceUrl.startsWith("http")
                          ? item.sourceUrl
                          : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-xs font-medium text-[var(--brand-300)] hover:text-white"
                    >
                      {item.sourceRegistry}
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAs(item._id, "approved")}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAs(item._id, "merged")}
                    >
                      <GitMerge className="h-4 w-4" />
                      Merge
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAs(item._id, "rejected")}
                    >
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
