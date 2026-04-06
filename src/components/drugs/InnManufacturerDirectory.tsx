"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Building2 } from "lucide-react";

interface InnManufacturerDirectoryProps {
  genericName: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  under_review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
  discontinued: "bg-zinc-800 text-zinc-400 border-zinc-700",
  unavailable: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

export function InnManufacturerDirectory({ genericName }: InnManufacturerDirectoryProps) {
  const data = useQuery(api.productIntelligence.getCanonicalInnManufacturers, { genericName });

  if (data === undefined) {
    return <TableSkeleton rows={4} />;
  }

  if (data.manufacturers.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title="No manufacturers linked yet"
        description="This INN does not yet have canonical manufacturer links."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs uppercase tracking-wider text-[var(--brand-300)]">INN Manufacturer Directory</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{data.genericName}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          All known manufacturers and linked brand products for this INN.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Manufacturers</p>
          <div className="mt-4 space-y-3">
            {data.manufacturers.map((manufacturer) => (
              <div
                key={`${manufacturer.companyId ?? manufacturer.name}-${manufacturer.brandNames.join("|")}`}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{manufacturer.name}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Brands: {manufacturer.brandNames.join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Brand Products</p>
          <div className="mt-4 space-y-3">
            {data.brandProducts.map((product) => (
              <div
                key={product.canonicalProductId}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/drugs/catalog/${product.canonicalProductId}`}
                      className="text-sm font-semibold text-white hover:text-[var(--brand-300)]"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-sm text-zinc-400">
                      Primary manufacturer: <span>{product.primaryManufacturerName ?? "—"}</span>
                    </p>
                    {product.primaryMahName && (
                      <p className="mt-1 text-xs text-zinc-500">MAH: {product.primaryMahName}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">{product.therapeuticArea}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {product.sourceBadges.map((badge) => (
                        <Badge
                          key={`${product.canonicalProductId}-${badge}`}
                          variant="secondary"
                          className="border-0 bg-[color:var(--brand-surface)] text-[var(--brand-300)]"
                        >
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={STATUS_STYLES[product.status] ?? "bg-zinc-800 text-zinc-400"}
                  >
                    {product.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
