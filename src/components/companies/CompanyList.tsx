"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddCompanyDialog } from "./AddCompanyDialog";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { CardGridSkeleton } from "@/components/shared/LoadingSkeleton";
import { Search, Building2, Globe, ArrowRight } from "lucide-react";

export function CompanyList() {
  const [search, setSearch] = useState("");
  const companies = useQuery(api.companies.list, { search: search || undefined });

  return (
    <div>
      <GuidedFlowBanner
        hereLabel="Company directory"
        helperText="Use this list to choose a manufacturer, then either research the company further or connect it to products and opportunities."
      />

      <div className="mt-6 flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
          />
        </div>
        <DiscoverCompaniesButton size="sm" variant="outline" label="Research more" />
        <AddCompanyDialog />
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-300">
          Use this page as your working directory of target manufacturers. A simple flow is:
          choose a company, research it further if needed, find the relevant products, then move
          into the best-opportunity and outreach flow.
        </p>
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
              : "Add your first company so you can connect products, review opportunities, and decide what to pursue next."
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
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(company.distributorFitScore ?? company.bdScore) != null && (
                  <Badge className="border-0 bg-emerald-500/10 text-emerald-300">
                    Fit {(company.distributorFitScore ?? company.bdScore)?.toFixed(1)}/10
                  </Badge>
                )}
                {company.priorityTier && (
                  <Badge className="border-0 bg-[color:var(--brand-surface)] text-[var(--brand-300)]">
                    {company.priorityTier.replace("_", " ")}
                  </Badge>
                )}
                {(company.menaChannelStatus ?? company.menaPresence) && (
                  <Badge className="border-0 bg-zinc-800 text-zinc-300">
                    {(company.menaChannelStatus ?? company.menaPresence) === "none"
                      ? "No MENA channel"
                      : (company.menaChannelStatus ?? company.menaPresence) === "limited"
                        ? "Limited MENA"
                        : "MENA established"}
                  </Badge>
                )}
              </div>
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
