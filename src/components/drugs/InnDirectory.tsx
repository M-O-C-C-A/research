"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Network, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";

export function InnDirectory() {
  const [search, setSearch] = useState("");
  const inns = useQuery(api.drugs.listInnDirectory, {
    search: search || undefined,
  });

  if (inns === undefined) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search INNs..."
            className="border-zinc-800 bg-zinc-900 pl-9 text-white placeholder:text-zinc-600"
          />
        </div>
      </div>

      {inns.length === 0 ? (
        <EmptyState
          icon={<Network className="h-10 w-10" />}
          title={search ? "No INNs found" : "No INNs yet"}
          description={
            search
              ? "Try a different search term."
              : "Add products first, then this view will group each INN with all linked manufacturers."
          }
        />
      ) : (
        <div className="grid gap-4">
          {inns.map((inn) => (
            <div
              key={inn.genericName}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/drugs/inn/${encodeURIComponent(inn.genericName)}`}
                    className="text-lg font-semibold text-white hover:text-[var(--brand-300)]"
                  >
                    {inn.genericName}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-500">
                    {inn.brandProducts.length} brand product
                    {inn.brandProducts.length !== 1 ? "s" : ""} · {inn.manufacturerCount} manufacturer
                    {inn.manufacturerCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <Link
                  href={`/drugs/inn/${encodeURIComponent(inn.genericName)}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                >
                  View manufacturers
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {inn.manufacturers.slice(0, 6).map((manufacturer) =>
                  manufacturer.companyId ? (
                    <Link
                      key={`${inn.genericName}-${manufacturer.name}`}
                      href={`/companies/${manufacturer.companyId}`}
                    >
                      <Badge className="border-0 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                        {manufacturer.name}
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      key={`${inn.genericName}-${manufacturer.name}`}
                      className="border-0 bg-zinc-800 text-zinc-300"
                    >
                      {manufacturer.name}
                    </Badge>
                  )
                )}
                {inn.manufacturers.length > 6 && (
                  <Badge className="border-0 bg-zinc-800 text-zinc-500">
                    +{inn.manufacturers.length - 6} more
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {inn.brandProducts.slice(0, 4).map((product) => (
                  <Link
                    key={product.drugId}
                    href={`/drugs/${product.drugId}`}
                    className="rounded-full bg-[color:var(--brand-surface)] px-3 py-1 text-xs text-[var(--brand-300)] hover:bg-[color:var(--brand-surface-strong)]"
                  >
                    {product.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
