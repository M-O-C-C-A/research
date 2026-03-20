"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { ArrowRight } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function RecentDrugs() {
  const drugs = useQuery(api.drugs.listEnriched, {});

  if (drugs === undefined) return <TableSkeleton rows={4} />;

  const recent = drugs.slice(0, 8);

  if (recent.length === 0) {
    return (
      <p className="text-sm text-zinc-600 py-4">
        No drugs added yet.{" "}
        <Link href="/companies" className="text-zinc-400 hover:text-white">
          Start by adding a company.
        </Link>
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-800">
      {recent.map((drug) => (
        <Link
          key={drug._id}
          href={`/drugs/${drug._id}`}
          className="group flex items-center justify-between py-3 hover:text-white transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{drug.name}</p>
            <p className="text-xs text-zinc-500 truncate">
              {drug.genericName} · {drug.companyName}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <Badge
              variant="secondary"
              className={`text-xs border-0 ${STATUS_STYLES[drug.approvalStatus] ?? "bg-zinc-800 text-zinc-400"}`}
            >
              {drug.therapeuticArea}
            </Badge>
            <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
          </div>
        </Link>
      ))}
    </div>
  );
}
