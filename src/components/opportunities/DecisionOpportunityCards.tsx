"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CardGridSkeleton } from "@/components/shared/LoadingSkeleton";
import { normalizeExternalUrl } from "@/lib/urlUtils";
import { AlertTriangle, ArrowRight, Mail, MapPinned, Radar, ShieldCheck } from "lucide-react";
import { confidenceBadgeClass, statusBadgeClass } from "@/lib/decisionOpportunities";

interface DecisionOpportunityCardsProps {
  limit?: number;
  title?: string;
  description?: string;
  opportunities?: Array<{
    _id: string;
    rankingPosition: number | null;
    status: "active" | "archived" | "needs_validation";
    productName: string;
    genericName: string;
    approachEntityName: string;
    manufacturerName?: string | null;
    marketAuthorizationHolderName?: string | null;
    priorityScore: number;
    confidenceLevel: "high" | "medium" | "low";
    focusMarkets: string[];
    blockedFocusMarkets?: string[] | null;
    whyThisMarket: string;
    howToEnterExplanation: string;
    companyWebsite?: string | null;
    companyLinkedinUrl?: string | null;
    contactName: string | null;
    contactTitle: string | null;
    contactEmail?: string | null;
    contactLinkedinUrl?: string | null;
    targetRole: string;
    entryStrategy: string;
    regulatoryFeasibility: string;
    outreachReady: boolean;
    companyFootprintStatus?:
      | "clean_whitespace"
      | "regional_representation_detected"
      | "portfolio_presence_detected"
      | "regional_representation_and_portfolio_presence"
      | "unclear_company_presence";
    companyFootprintReason?: string | null;
    companyFootprintCountries?: string[] | null;
    companyPortfolioPresenceCount?: number | null;
  }>;
}

export function DecisionOpportunityCards({
  title = "Top Decision Opportunities",
  description = "Prioritized product-to-market plays that are close to real outreach.",
  limit = 12,
  opportunities,
}: DecisionOpportunityCardsProps) {
  const loadOpportunities = useAction(api.decisionOpportunities.listSnapshot);
  const [queriedOpportunities, setQueriedOpportunities] = useState<
    DecisionOpportunityCardsProps["opportunities"] | undefined
  >(opportunities);

  useEffect(() => {
    if (opportunities !== undefined) {
      return;
    }

    let cancelled = false;

    const refresh = () => {
      void loadOpportunities({ status: "active", limit }).then((result) => {
        if (!cancelled) {
          setQueriedOpportunities(result);
        }
      });
    };

    refresh();
    window.addEventListener("decision-opportunities:refresh", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("decision-opportunities:refresh", refresh);
    };
  }, [limit, loadOpportunities, opportunities]);

  const visibleOpportunities = opportunities ?? queriedOpportunities;

  function isDifferentEntity(left?: string | null, right?: string | null) {
    if (!left?.trim() || !right?.trim()) return false;
    return left.trim().toLowerCase() !== right.trim().toLowerCase();
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            {title}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        </div>
      </div>

      {visibleOpportunities === undefined ? (
        <CardGridSkeleton count={4} />
      ) : visibleOpportunities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
          <Radar className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No promoted decision opportunities yet. Rebuild the engine from the current research base.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleOpportunities.map((item) => {
            const readyToSend = item.outreachReady;
            const contactLinkedinUrl = normalizeExternalUrl(item.contactLinkedinUrl);
            const primaryBlocker =
              item.blockedFocusMarkets && item.blockedFocusMarkets.length > 0
                ? `Already registered in ${item.blockedFocusMarkets.join(", ")}`
                : readyToSend
                  ? "Ready for outreach"
                  : "Needs validation before outreach";
            const companyName = item.manufacturerName ?? item.approachEntityName;
            const mahName = item.marketAuthorizationHolderName;
            const showMah =
              isDifferentEntity(mahName, companyName) &&
              isDifferentEntity(mahName, item.approachEntityName);
            return (
            <Link
              key={item._id}
              href={`/opportunities/${item._id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.productName}</p>
                  <p className="mt-1 truncate text-xs text-zinc-300">
                    INN: {item.genericName}
                  </p>
                  <p className="truncate text-xs text-zinc-400">Company: {companyName}</p>
                  {showMah && <p className="truncate text-xs text-zinc-400">MAH: {mahName}</p>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{item.priorityScore.toFixed(1)}</p>
                  <p className="text-[11px] text-zinc-300">score</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-400">
                  #{item.rankingPosition ?? "—"}
                </span>
                <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${confidenceBadgeClass(item.confidenceLevel)}`}>
                  {item.confidenceLevel} confidence
                </span>
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-[11px] ${
                    readyToSend
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {readyToSend ? "outreach ready" : "blocked"}
                </span>
                <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${statusBadgeClass(item.status)}`}>
                  {item.status.replace("_", " ")}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs text-zinc-300">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                    What to pursue
                  </p>
                  <p className="mt-1 text-zinc-300">
                    {item.productName} in {item.focusMarkets.join(", ")}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPinned className="mt-0.5 h-3.5 w-3.5 text-[var(--brand-300)]" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Why it matters
                    </p>
                    <p className="mt-1">{item.whyThisMarket}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {readyToSend ? (
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-300" />
                  )}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      What blocks it
                    </p>
                    <p className="mt-1">{primaryBlocker}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3.5 w-3.5 text-[var(--brand-300)]" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Who to contact
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {item.contactName
                        ? `${item.contactName} · ${item.contactTitle ?? item.targetRole}`
                        : item.targetRole}
                    </p>
                    {item.contactEmail && <p className="mt-1 text-zinc-300">{item.contactEmail}</p>}
                    {!item.contactEmail && contactLinkedinUrl && (
                      <p className="mt-1 text-zinc-300">LinkedIn available</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-300)]">
                Review recommendation
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
