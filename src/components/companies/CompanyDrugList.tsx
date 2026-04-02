"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { AddDrugButton } from "@/components/drugs/AddDrugDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pill, ArrowRight } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface CompanyDrugListProps {
  companyId: string;
}

export function CompanyDrugList({ companyId }: CompanyDrugListProps) {
  const drugs = useQuery(api.drugs.listByCompany, {
    companyId: companyId as Id<"companies">,
  });

  if (drugs === undefined) return <TableSkeleton rows={4} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Drug Portfolio{" "}
            {drugs.length > 0 && (
              <span className="text-zinc-500 font-normal text-sm">
                ({drugs.length})
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add or review products from this company, then open a drug to generate a brief or
            inspect the next recommended opportunity.
          </p>
        </div>
        <AddDrugButton companyId={companyId} />
      </div>

      {drugs.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-8 w-8" />}
          title="No drugs added yet"
          description="Add the first product from this company so you can assess market opportunity and decide whether to pursue outreach."
          action={<AddDrugButton companyId={companyId} />}
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500">Product Name</TableHead>
                <TableHead className="text-zinc-500">Generic Name</TableHead>
                <TableHead className="text-zinc-500">Manufacturers</TableHead>
                <TableHead className="text-zinc-500">Therapeutic Area</TableHead>
                <TableHead className="text-zinc-500">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drugs.map((drug) => {
                const additionalManufacturers = Math.max(
                  (drug.manufacturerNames?.length ?? 0) - 1,
                  0
                );

                return (
                  <TableRow
                    key={drug._id}
                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                  >
                    <TableCell>
                      <Link
                        href={`/drugs/${drug._id}`}
                        className="font-medium text-white hover:text-zinc-300 flex items-center gap-2"
                      >
                        {drug.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      <Link
                        href={`/drugs/inn/${encodeURIComponent(drug.genericName)}`}
                        className="hover:text-[var(--brand-300)]"
                      >
                        {drug.genericName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      <div className="flex flex-col gap-1">
                        {drug.primaryManufacturerCompanyId ? (
                          <Link
                            href={`/companies/${drug.primaryManufacturerCompanyId}`}
                            className="hover:text-[var(--brand-300)]"
                          >
                            {drug.primaryManufacturerName}
                          </Link>
                        ) : (
                          <span>{drug.primaryManufacturerName}</span>
                        )}
                        {additionalManufacturers > 0 && (
                          <span className="text-xs text-zinc-500">
                            +{additionalManufacturers} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {drug.therapeuticArea}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_STYLES[drug.approvalStatus] ?? "bg-zinc-800 text-zinc-400"}
                      >
                        {drug.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/drugs/${drug._id}`}>
                        <ArrowRight className="h-4 w-4 text-zinc-600 hover:text-zinc-400" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
