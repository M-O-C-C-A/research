"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface DrugDetailProps {
  drugId: string;
}

export function DrugDetail({ drugId }: DrugDetailProps) {
  const drug = useQuery(api.drugs.get, { id: drugId as Id<"drugs"> });
  const company = useQuery(
    api.companies.get,
    drug ? { id: drug.companyId } : "skip"
  );

  if (drug === undefined) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3 mb-6">
        <Skeleton className="h-7 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-1/2 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!drug) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-white">{drug.name}</h2>
            <Badge
              variant="secondary"
              className={STATUS_STYLES[drug.approvalStatus] ?? "bg-zinc-800 text-zinc-400"}
            >
              {drug.approvalStatus}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500">
            {drug.genericName}
            {company && (
              <span>
                {" · "}
                <span className="text-zinc-400">{company.name}</span>
                {" · "}
                {company.country}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Therapeutic Area</p>
          <p className="text-sm text-zinc-300">{drug.therapeuticArea}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Category</p>
          <p className="text-sm text-zinc-300">{drug.category ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Approval Date</p>
          <p className="text-sm text-zinc-300">{drug.approvalDate ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Mechanism</p>
          <p className="text-sm text-zinc-300">{drug.mechanism ?? "—"}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600 uppercase tracking-wider mb-1.5">Indication</p>
        <p className="text-sm text-zinc-300">{drug.indication}</p>
      </div>
    </div>
  );
}
