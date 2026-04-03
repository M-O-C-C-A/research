"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
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
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";
import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { THERAPEUTIC_AREAS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Search, Pill, ArrowRight, Database, RefreshCw } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  under_review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  withdrawn: "bg-red-500/15 text-red-400 border-red-500/30",
  discontinued: "bg-zinc-800 text-zinc-400 border-zinc-700",
  unavailable: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

export function DrugList() {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<string>("");
  const [syncSearch, setSyncSearch] = useState("");
  const [syncingSource, setSyncingSource] = useState<string | null>(null);

  const products = useQuery(api.productIntelligence.listCanonicalProducts, {
    search: search || undefined,
    therapeuticArea: area || undefined,
  });
  const syncStats = useQuery(api.productIntelligence.syncStats, {});
  const syncFdaProducts = useAction(api.productIntelligenceActions.syncFdaProducts);
  const syncEmaProducts = useAction(api.productIntelligenceActions.syncEmaCentralProducts);
  const syncBfarmProducts = useAction(api.productIntelligenceActions.syncBfarmProducts);
  const rebuildCanonicalProducts = useAction(
    api.productIntelligenceActions.rebuildCanonicalProductLinks
  );

  async function runSync(
    source: "fda" | "ema" | "bfarm" | "rebuild"
  ) {
    setSyncingSource(source);
    try {
      if (source === "fda") {
        await syncFdaProducts({
          searchTerm: syncSearch || undefined,
          limit: 25,
        });
      } else if (source === "ema") {
        await syncEmaProducts({
          searchTerm: syncSearch || undefined,
          limit: 50,
        });
      } else if (source === "bfarm") {
        await syncBfarmProducts({
          searchTerm: syncSearch || search || "insulin",
        });
      } else {
        await rebuildCanonicalProducts({});
      }
    } finally {
      setSyncingSource(null);
    }
  }

  return (
    <div>
      <GuidedFlowBanner
        hereLabel="Product directory"
        helperText="Use this list to review products, then open the product detail or best-opportunity view to decide what KEMEDICA should pursue next."
      />

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Product Intelligence Sync
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Refresh FDA and EMA product intelligence
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Manual sync brings FDA, EMA, and national-register signals into the canonical product graph.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {syncStats
                ? `${syncStats.canonicalCount} canonical products from ${syncStats.sourceCount} source records`
                : "Loading sync stats..."}
            </p>
          </div>
          <div className="w-full max-w-xl space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={syncSearch}
                onChange={(event) => setSyncSearch(event.target.value)}
                placeholder="Optional search term, e.g. pembrolizumab or Keytruda"
                className="border-zinc-800 bg-zinc-950 pl-9 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runSync("fda")}
                disabled={syncingSource !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--brand-500)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--brand-600)] disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                {syncingSource === "fda" ? "Syncing FDA..." : "Sync FDA"}
              </button>
              <button
                type="button"
                onClick={() => void runSync("ema")}
                disabled={syncingSource !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                {syncingSource === "ema" ? "Syncing EMA..." : "Sync EMA"}
              </button>
              <button
                type="button"
                onClick={() => void runSync("bfarm")}
                disabled={syncingSource !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                {syncingSource === "bfarm" ? "Checking BfArM..." : "Sync BfArM"}
              </button>
              <button
                type="button"
                onClick={() => void runSync("rebuild")}
                disabled={syncingSource !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {syncingSource === "rebuild" ? "Rebuilding..." : "Rebuild canonical graph"}
              </button>
            </div>
          </div>
        </div>
      </div>

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
          Use this page as your product directory. It now reads from the canonical FDA/EU product graph so you can compare brand, INN, source geography, ownership, and regulatory identity before outreach.
        </p>
      </div>

      {products === undefined ? (
        <TableSkeleton rows={6} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-10 w-10" />}
          title={search || area ? "No products found" : "No products yet"}
          description={
            search || area
              ? "Try adjusting your search or filter."
              : "Run an FDA or EMA sync to populate the canonical product directory."
          }
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500">Product Name</TableHead>
                <TableHead className="text-zinc-500">Generic Name</TableHead>
                <TableHead className="text-zinc-500">Manufacturer / MAH</TableHead>
                <TableHead className="text-zinc-500">Application</TableHead>
                <TableHead className="text-zinc-500">Geography</TableHead>
                <TableHead className="text-zinc-500">MAH / Owner</TableHead>
                <TableHead className="text-zinc-500">Therapeutic Area</TableHead>
                <TableHead className="text-zinc-500">Status</TableHead>
                <TableHead className="text-zinc-500">Next Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                return (
                <TableRow
                  key={product._id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell>
                    <Link
                      href={`/drugs/catalog/${product._id}`}
                      className="font-medium text-white hover:text-zinc-300"
                    >
                      {product.brandName}
                    </Link>
                    {product.sourceBadges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {product.sourceBadges.map((badge) => (
                          <Badge
                            key={`${product._id}-${badge}`}
                            variant="secondary"
                            className="border-0 bg-[color:var(--brand-surface)] text-[var(--brand-300)]"
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    <Link
                      href={`/drugs/inn/${encodeURIComponent(product.inn)}`}
                      className="hover:text-[var(--brand-300)]"
                    >
                      {product.inn}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    <div className="flex flex-col gap-1">
                      {product.primaryManufacturerName ? (
                        <span>{product.primaryManufacturerName}</span>
                      ) : (
                        <span>{product.primaryMahName ?? "—"}</span>
                      )}
                      {product.primaryMahName &&
                        product.primaryMahName !== product.primaryManufacturerName && (
                        <span className="text-xs text-zinc-500">
                          MAH: {product.primaryMahName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {product.applicationTypeSummary ?? "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {product.geographies.join(", ")}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {product.primaryMahName ?? product.primaryApplicantName ?? "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {product.therapeuticArea ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_STYLES[product.status] ?? "bg-zinc-800 text-zinc-400"}
                    >
                      {product.status.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/drugs/catalog/${product._id}`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--brand-300)] hover:text-[var(--brand-400)]"
                    >
                      Review product intelligence
                      <ArrowRight className="h-4 w-4" />
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
