"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, MapPin } from "lucide-react";

interface CompanyDetailProps {
  companyId: string;
}

export function CompanyDetail({ companyId }: CompanyDetailProps) {
  const company = useQuery(api.companies.get, {
    id: companyId as Id<"companies">,
  });

  if (company === undefined) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3 mb-8">
        <Skeleton className="h-6 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-1/4 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">{company.name}</h2>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {company.country}
            </span>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
          </div>
        </div>
        <Badge
          variant={company.status === "active" ? "default" : "secondary"}
          className={
            company.status === "active"
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : "bg-zinc-800 text-zinc-400"
          }
        >
          {company.status}
        </Badge>
      </div>

      {company.description && (
        <p className="text-sm text-zinc-400 mb-4">{company.description}</p>
      )}

      {company.therapeuticAreas.length > 0 && (
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">
            Therapeutic Areas
          </p>
          <div className="flex flex-wrap gap-2">
            {company.therapeuticAreas.map((area) => (
              <Badge
                key={area}
                variant="secondary"
                className="bg-zinc-800 text-zinc-300 border-0"
              >
                {area}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
