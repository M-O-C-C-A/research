"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";

export function ActionQueueWidget() {
  const loadCockpit = useAction(api.dashboard.getCockpitSnapshot);
  const [cockpit, setCockpit] = useState<
    | {
        actionQueue: Array<{
          id: string;
          title: string;
          description: string;
          actionLabel: string;
          href: string;
        }>;
        insightSummary: {
          promotedActiveCount: number;
          needsValidationCount: number;
          missingContactCount: number;
          unlinkedHighValueGaps: number;
        };
      }
    | undefined
  >();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void loadCockpit({}).then((result) => {
        if (!cancelled) {
          setCockpit(result);
        }
      });
    };

    refresh();
    window.addEventListener("decision-opportunities:refresh", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("decision-opportunities:refresh", refresh);
    };
  }, [loadCockpit]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded bg-[color:var(--brand-surface-strong)] p-1.5">
            <ClipboardList className="h-4 w-4 text-[var(--brand-300)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Next Best Actions
            </h2>
            <p className="text-xs text-zinc-500">
              Smallest steps that move a promoted decision opportunity toward outreach
            </p>
          </div>
        </div>
      </div>

      {cockpit === undefined ? (
        <TableSkeleton rows={4} />
      ) : cockpit.actionQueue.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No urgent follow-ups right now. Promote more opportunities or validate the ones still blocked on identity and contacts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cockpit.actionQueue.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group block rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-300">
                  {item.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {cockpit && (
        <div className="mt-4 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
          {cockpit.insightSummary.promotedActiveCount} active promoted opportunities ·{" "}
          {cockpit.insightSummary.needsValidationCount} need validation ·{" "}
          {cockpit.insightSummary.missingContactCount} missing contact direction ·{" "}
          {cockpit.insightSummary.unlinkedHighValueGaps} high-value gaps still unlinked
        </div>
      )}
    </div>
  );
}
