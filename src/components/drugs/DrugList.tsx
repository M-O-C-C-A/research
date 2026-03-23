"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddDrugButton } from "./AddDrugDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { THERAPEUTIC_AREAS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Search, Pill, ArrowRight } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function DrugList() {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<string>("");

  const drugs = useQuery(api.drugs.listEnriched, {
    search: search || undefined,
    therapeuticArea: area || undefined,
  });

  return (
    <div>
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drugs..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
          />
        </div>
        <Select value={area} onValueChange={(v) => setArea(v ?? "")}>
          <SelectTrigger className="w-52 bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="All therapeutic areas" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="" className="text-white hover:bg-zinc-700">
              All therapeutic areas
            </SelectItem>
            {THERAPEUTIC_AREAS.map((a) => (
              <SelectItem key={a} value={a} className="text-white hover:bg-zinc-700">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          href="/drugs/imports"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Import Registrations
        </Link>
        <AddDrugButton />
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-300">
          Use this page to review the products you may want to pursue. Opening a drug lets you
          assess market opportunity, generate a decision brief, and move into the recommended
          opportunity flow.
        </p>
      </div>

      {drugs === undefined ? (
        <TableSkeleton rows={6} />
      ) : drugs.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-10 w-10" />}
          title={search || area ? "No drugs found" : "No drugs yet"}
          description={
            search || area
              ? "Try adjusting your search or filter."
              : "Add a drug to unlock market opportunity review, a decision brief, and the next-step recommendation flow."
          }
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500">Drug Name</TableHead>
                <TableHead className="text-zinc-500">Generic Name</TableHead>
                <TableHead className="text-zinc-500">Manufacturer</TableHead>
                <TableHead className="text-zinc-500">MAH / Owner</TableHead>
                <TableHead className="text-zinc-500">Therapeutic Area</TableHead>
                <TableHead className="text-zinc-500">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drugs.map((drug) => (
                <TableRow
                  key={drug._id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell>
                    <Link
                      href={`/drugs/${drug._id}`}
                      className="font-medium text-white hover:text-zinc-300"
                    >
                      {drug.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {drug.genericName}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {drug.primaryManufacturerName}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {drug.primaryMarketAuthorizationHolderName}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
