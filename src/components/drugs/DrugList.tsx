"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  Search,
  Pill,
  ArrowRight,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

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
  const [syncMessage, setSyncMessage] = useState<{
    tone: "success" | "error" | "info";
    title: string;
    body: string;
  } | null>(null);

  const products = useQuery(api.productIntelligence.listCanonicalProducts, {
    search: search || undefined,
    therapeuticArea: area || undefined,
  });
  const syncStats = useQuery(api.productIntelligence.syncStats, {});
  const recentJobs = useQuery(api.discoveryJobs.recentStats, {});
  const syncFdaProducts = useAction(api.productIntelligenceActions.syncFdaProducts);
  const syncEmaProducts = useAction(api.productIntelligenceActions.syncEmaCentralProducts);
  const syncBfarmProducts = useAction(api.productIntelligenceActions.syncBfarmProducts);
  const rebuildCanonicalProducts = useAction(
    api.productIntelligenceActions.rebuildCanonicalProductLinks
  );

  const latestImportJob =
    recentJobs?.find((job) =>
      ["product_sync_fda", "product_sync_ema", "product_sync_bfarm"].includes(job.type)
    ) ?? null;
  const latestRebuildJob =
    recentJobs?.find((job) => job.type === "canonical_product_linking") ?? null;
  const latestProductJob = latestImportJob ?? latestRebuildJob;

  const isUpdatingDirectory = syncingSource === "update";

  function getDefaultSyncTerm() {
    return syncSearch || search || undefined;
  }

  async function runSync(
    source: "fda" | "ema" | "bfarm" | "rebuild" | "update"
  ) {
    setSyncingSource(source);
    setSyncMessage({
      tone: "info",
      title:
        source === "update"
          ? "Updating product directory"
          : source === "rebuild"
            ? "Rebuilding product directory"
            : `Running ${source.toUpperCase()} sync`,
      body:
        source === "update"
          ? "Pulling FDA and EMA records, then rebuilding the canonical product graph."
          : "Your product intelligence refresh is in progress.",
    });
    try {
      if (source === "update") {
        const defaultTerm = getDefaultSyncTerm();
        const fdaResult = await syncFdaProducts({
          searchTerm: defaultTerm,
          limit: defaultTerm ? 25 : 50,
        });
        const emaResult = await syncEmaProducts({
          searchTerm: defaultTerm,
          limit: defaultTerm ? 50 : 100,
        });
        const rebuildResult = await rebuildCanonicalProducts({});
        const imported = (fdaResult.upserted ?? 0) + (emaResult.upserted ?? 0);
        if (imported === 0) {
          setSyncMessage({
            tone: "error",
            title: "No products were imported",
            body:
              "The update finished but did not add any FDA or EMA source records. Try a specific product name, or check the latest sync job details below.",
          });
        } else {
          setSyncMessage({
            tone: "success",
            title: "Product directory updated",
            body: `Imported ${imported} source records and rebuilt ${rebuildResult.canonicalProductsCreated} canonical products.`,
          });
        }
      } else if (source === "fda") {
        const result = await syncFdaProducts({
          searchTerm: syncSearch || undefined,
          limit: 25,
        });
        setSyncMessage({
          tone: result.upserted > 0 ? "success" : "error",
          title: result.upserted > 0 ? "FDA sync completed" : "No FDA products imported",
          body:
            result.upserted > 0
              ? `FDA-backed product records were refreshed successfully (${result.upserted} source rows).`
              : "The FDA sync returned zero products for this run.",
        });
      } else if (source === "ema") {
        const result = await syncEmaProducts({
          searchTerm: syncSearch || undefined,
          limit: 50,
        });
        setSyncMessage({
          tone: result.upserted > 0 ? "success" : "error",
          title: result.upserted > 0 ? "EMA sync completed" : "No EMA products imported",
          body:
            result.upserted > 0
              ? `EMA centrally authorised medicine records were refreshed successfully (${result.upserted} source rows).`
              : "The EMA sync returned zero products for this run.",
        });
      } else if (source === "bfarm") {
        await syncBfarmProducts({
          searchTerm: syncSearch || search || "insulin",
        });
        setSyncMessage({
          tone: "success",
          title: "BfArM sync completed",
          body: "The Germany national-register pattern ran successfully.",
        });
      } else {
        const result = await rebuildCanonicalProducts({});
        setSyncMessage({
          tone: "success",
          title: "Canonical graph rebuilt",
          body: `Equivalent products and source links were rebuilt successfully (${result.canonicalProductsCreated} canonical products).`,
        });
      }
    } catch (error) {
      setSyncMessage({
        tone: "error",
        title: "Update failed",
        body:
          error instanceof Error
            ? error.message
            : "The product directory refresh did not complete.",
      });
    } finally {
      setSyncingSource(null);
    }
  }

  const syncMessageStyles = syncMessage
    ? syncMessage.tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
      : syncMessage.tone === "error"
        ? "border-red-500/25 bg-red-500/10 text-red-100"
        : "border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] text-zinc-100"
    : "";

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
              Update the product directory
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pull FDA and EMA product records into the directory, then rebuild the canonical product graph automatically.
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
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => void runSync("update")}
                disabled={syncingSource !== null}
                className="min-w-44"
              >
                {isUpdatingDirectory ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isUpdatingDirectory ? "Updating directory..." : "Update directory"}
              </Button>
              <div className="text-xs text-zinc-500">
                Runs FDA sync, EMA sync, and canonical rebuild in one step.
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Advanced source controls
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runSync("fda")}
                  disabled={syncingSource !== null}
                >
                  <Database className="h-4 w-4" />
                  {syncingSource === "fda" ? "Syncing FDA..." : "Sync FDA only"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runSync("ema")}
                  disabled={syncingSource !== null}
                >
                  <Database className="h-4 w-4" />
                  {syncingSource === "ema" ? "Syncing EMA..." : "Sync EMA only"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runSync("bfarm")}
                  disabled={syncingSource !== null}
                >
                  <Database className="h-4 w-4" />
                  {syncingSource === "bfarm" ? "Checking BfArM..." : "Try BfArM"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runSync("rebuild")}
                  disabled={syncingSource !== null}
                >
                  <RefreshCw className="h-4 w-4" />
                  {syncingSource === "rebuild" ? "Rebuilding..." : "Rebuild graph only"}
                </Button>
              </div>
            </div>
            {syncMessage && (
              <div className={cn("rounded-lg border p-3", syncMessageStyles)}>
                <div className="flex items-start gap-3">
                  {syncMessage.tone === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  ) : syncMessage.tone === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  ) : (
                    <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--brand-300)]" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{syncMessage.title}</p>
                    <p className="mt-1 text-sm opacity-90">{syncMessage.body}</p>
                  </div>
                </div>
              </div>
            )}
            {latestProductJob && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
                <p className="font-medium text-white">
                  Latest sync status:{" "}
                  <span className="text-[var(--brand-300)]">
                    {latestProductJob.status === "running"
                      ? "Running"
                      : latestProductJob.status === "completed"
                        ? "Completed"
                        : "Failed"}
                  </span>
                </p>
                <p className="mt-1 text-zinc-400">
                  {latestProductJob.summary ??
                    latestProductJob.errorMessage ??
                    "The latest job is still running."}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Tip: leave the search box empty for a broader refresh, or enter one product name for a focused update.
                </p>
              </div>
            )}
            {!latestProductJob && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400">
                Click <span className="font-medium text-white">Update directory</span> to bring in FDA and EMA products. You only need the advanced buttons when you want to run one source on its own.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
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
