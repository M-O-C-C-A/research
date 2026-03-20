"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ScoreBadge } from "@/components/shared/ScoreBadge";
import { CountryCellEditor } from "./CountryCellEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MENA_COUNTRIES } from "@/lib/constants";
import { Pencil, Plus } from "lucide-react";

const REGULATORY_LABELS: Record<string, string> = {
  not_registered: "Not Registered",
  registered: "Registered",
  pending_registration: "Pending",
  reimbursed: "Registered & Reimbursed",
};

const COMPETITOR_COLORS: Record<string, string> = {
  none: "bg-emerald-500/15 text-emerald-400",
  low: "bg-blue-500/15 text-blue-400",
  medium: "bg-amber-500/15 text-amber-400",
  high: "bg-red-500/15 text-red-400",
};

interface MenaOpportunityGridProps {
  drugId: string;
}

export function MenaOpportunityGrid({ drugId }: MenaOpportunityGridProps) {
  const opportunities = useQuery(api.opportunities.listByDrug, {
    drugId: drugId as Id<"drugs">,
  });
  const [editingCountry, setEditingCountry] = useState<string | null>(null);

  if (opportunities === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const editingOpp = editingCountry
    ? (() => {
        const existing = opportunities.find((o) => o.country === editingCountry);
        return {
          drugId: drugId as Id<"drugs">,
          country: editingCountry,
          opportunityScore: existing?.opportunityScore,
          regulatoryStatus: existing?.regulatoryStatus,
          competitorPresence: existing?.competitorPresence,
          marketSizeEstimate: existing?.marketSizeEstimate,
          notes: existing?.notes,
        };
      })()
    : null;

  return (
    <>
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_140px_100px_100px_60px] text-xs text-zinc-600 uppercase tracking-wider px-4 py-2.5 border-b border-zinc-800 bg-zinc-950">
          <span>Country</span>
          <span>Score</span>
          <span>Regulatory</span>
          <span>Competitors</span>
          <span>Market Size</span>
          <span />
        </div>
        <div className="divide-y divide-zinc-800">
          {MENA_COUNTRIES.map((country) => {
            const opp = opportunities.find((o) => o.country === country);
            const hasData = !!opp;

            return (
              <div
                key={country}
                className="grid grid-cols-[1fr_80px_140px_100px_100px_60px] items-center px-4 py-3 hover:bg-zinc-800/30 transition-colors"
              >
                <span className="text-sm font-medium text-white">{country}</span>
                <span>
                  <ScoreBadge score={opp?.opportunityScore} />
                </span>
                <span className="text-xs text-zinc-400">
                  {opp?.regulatoryStatus
                    ? REGULATORY_LABELS[opp.regulatoryStatus] ?? opp.regulatoryStatus
                    : <span className="text-zinc-700">—</span>}
                </span>
                <span>
                  {opp?.competitorPresence ? (
                    <Badge
                      variant="secondary"
                      className={`text-xs border-0 ${COMPETITOR_COLORS[opp.competitorPresence] ?? "bg-zinc-800 text-zinc-400"}`}
                    >
                      {opp.competitorPresence}
                    </Badge>
                  ) : (
                    <span className="text-xs text-zinc-700">—</span>
                  )}
                </span>
                <span className="text-xs text-zinc-400 truncate pr-2">
                  {opp?.marketSizeEstimate ?? <span className="text-zinc-700">—</span>}
                </span>
                <span className="flex justify-end">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditingCountry(country)}
                    className="h-7 w-7 text-zinc-600 hover:text-white hover:bg-zinc-700"
                  >
                    {hasData ? (
                      <Pencil className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {editingOpp && (
        <CountryCellEditor
          open={!!editingCountry}
          onClose={() => setEditingCountry(null)}
          opportunity={editingOpp}
        />
      )}
    </>
  );
}
