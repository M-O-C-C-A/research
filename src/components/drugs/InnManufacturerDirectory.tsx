"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Building2, ArrowRight } from "lucide-react";

interface InnManufacturerDirectoryProps {
  genericName: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function InnManufacturerDirectory({ genericName }: InnManufacturerDirectoryProps) {
  const data = useQuery(api.drugs.getInnManufacturers, { genericName });

  if (data === undefined) {
    return <TableSkeleton rows={4} />;
  }

  if (data.manufacturers.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title="No manufacturers linked yet"
        description="This INN does not yet have structured manufacturer links."
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

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Manufacturers</p>
          <div className="mt-4 space-y-3">
            {data.manufacturers.map((manufacturer) => (
              <div
                key={`${manufacturer.companyId ?? manufacturer.name}-${manufacturer.brandNames.join("|")}`}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {manufacturer.companyId ? (
                      <Link
                        href={`/companies/${manufacturer.companyId}`}
                        className="text-sm font-semibold text-white hover:text-[var(--brand-300)]"
                      >
                        {manufacturer.name}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-white">{manufacturer.name}</p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
                      Brands: {manufacturer.brandNames.join(", ")}
                    </p>
                  </div>
                  {manufacturer.companyId && (
                    <Link
                      href={`/companies/${manufacturer.companyId}`}
                      className="inline-flex items-center gap-1 text-xs text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                    >
                      Open company
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Brand Products</p>
          <div className="mt-4 space-y-3">
            {data.brandProducts.map((product) => (
              <div
                key={product.drugId}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/drugs/${product.drugId}`}
                      className="text-sm font-semibold text-white hover:text-[var(--brand-300)]"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-sm text-zinc-400">
                      Primary manufacturer:{" "}
                      {product.primaryManufacturerCompanyId ? (
                        <Link
                          href={`/companies/${product.primaryManufacturerCompanyId}`}
                          className="text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                        >
                          {product.primaryManufacturerName}
                        </Link>
                      ) : (
                        <span>{product.primaryManufacturerName}</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{product.therapeuticArea}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={STATUS_STYLES[product.approvalStatus] ?? "bg-zinc-800 text-zinc-400"}
                  >
                    {product.approvalStatus}
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
