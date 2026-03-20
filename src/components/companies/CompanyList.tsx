"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddCompanyDialog } from "./AddCompanyDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/LoadingSkeleton";
import { Search, Building2, Globe, ArrowRight } from "lucide-react";

export function CompanyList() {
  const [search, setSearch] = useState("");
  const companies = useQuery(api.companies.list, { search: search || undefined });

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
          />
        </div>
        <AddCompanyDialog />
      </div>

      {companies === undefined ? (
        <CardGridSkeleton count={6} />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title={search ? "No companies found" : "No companies yet"}
          description={
            search
              ? "Try a different search term."
              : "Add your first European pharma company to get started."
          }
          action={!search ? <AddCompanyDialog /> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Link
              key={company._id}
              href={`/companies/${company._id}`}
              className="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate group-hover:text-zinc-100">
                    {company.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-zinc-500">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {company.country}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5 ml-2" />
              </div>
              {company.description && (
                <p className="text-xs text-zinc-500 line-clamp-2 mb-3">
                  {company.description}
                </p>
              )}
              {company.therapeuticAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {company.therapeuticAreas.slice(0, 3).map((area) => (
                    <Badge
                      key={area}
                      variant="secondary"
                      className="text-xs bg-zinc-800 text-zinc-400 border-0"
                    >
                      {area}
                    </Badge>
                  ))}
                  {company.therapeuticAreas.length > 3 && (
                    <Badge variant="secondary" className="text-xs bg-zinc-800 text-zinc-500 border-0">
                      +{company.therapeuticAreas.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
