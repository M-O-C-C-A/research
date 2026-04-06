"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { uploadFileToConvex } from "@/lib/convexUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Upload } from "lucide-react";

const EMPTY_IMPORTS: Array<{
  _id: Id<"registrationImports">;
  fileName: string;
  sourceMarket?: string;
  sourceType?: string;
  status: string;
  totalRows: number;
  matchedRows: number;
  unresolvedRows: number;
  appliedRows?: number;
  parseErrorCount?: number;
  sheetNames?: string[];
  lastError?: string;
}> = [];

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-zinc-700/40 text-zinc-200 border-zinc-600/70",
  parsed: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  needs_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  applied: "bg-[color:var(--brand-surface)] text-[var(--brand-300)] border-[color:var(--brand-border)]",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function RegistrationImportWorkspace() {
  const STAGED_ROW_LIMIT = 25;
  const [sourceMarket, setSourceMarket] = useState("");
  const [selectedImportId, setSelectedImportId] = useState<Id<"registrationImports"> | null>(
    null
  );
  const [resolvingRowId, setResolvingRowId] = useState<Id<"registrationImportRows"> | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAppliedSummary, setLastAppliedSummary] = useState<{
    appliedCount: number;
    touchedDrugCount: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createImport = useMutation(api.registrationImports.createImport);
  const requestApply = useMutation(api.registrationImports.requestApply);
  const resolveRowMatch = useMutation(api.registrationImports.resolveRowMatch);
  const parseImport = useAction(api.registrationImportActions.parseImport);
  const applyImport = useAction(api.registrationImportActions.applyImport);

  const importsQuery = useQuery(api.registrationImports.listImports, { limit: 10 });
  const detail = useQuery(
    api.registrationImports.getImportDetail,
    selectedImportId ? { importId: selectedImportId, rowLimit: STAGED_ROW_LIMIT } : "skip"
  );
  const drugs =
    useQuery(
      api.drugs.listMatchingOptions,
      selectedImportId
        ? {
            limit: 250,
          }
        : "skip"
    ) ?? [];
  const imports = importsQuery ?? EMPTY_IMPORTS;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const isWorkbook =
        file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
      if (!isWorkbook) {
        throw new Error("Please upload an Excel workbook (.xlsx or .xls).");
      }

      const inferredSourceMarket =
        sourceMarket.trim() ||
        (file.name.toLowerCase().includes("drugdirectory_products") ? "UAE" : "");
      const lowerFileName = file.name.toLowerCase();
      const { storageId } = await uploadFileToConvex(file, generateUploadUrl);
      const importId = await createImport({
        storageId: storageId as Id<"_storage">,
        fileName: file.name,
        sourceMarket: inferredSourceMarket || undefined,
        sourceType:
          lowerFileName.includes("mohap_complete_product_list") ||
          lowerFileName.includes("mohap complete product list")
            ? "mohap_uae_complete_product_list"
            : inferredSourceMarket === "UAE"
              ? "uae_official_directory"
              : undefined,
      });
      setSelectedImportId(importId);
      const result = await parseImport({ importId });
      if (!sourceMarket.trim() && inferredSourceMarket) {
        setSourceMarket(inferredSourceMarket);
      }
      setMessage(
        `Parsed ${result.totalRows} rows from ${result.sheetNames.length} sheet${
          result.sheetNames.length === 1 ? "" : "s"
        }.`
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The workbook could not be imported."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveRow(rowId: Id<"registrationImportRows">, value: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (value === "__skip") {
        await resolveRowMatch({ rowId, skip: true });
        setMessage("Row skipped from apply.");
      } else {
        await resolveRowMatch({
          rowId,
          matchedDrugId: value as Id<"drugs">,
        });
        setMessage("Row linked to drug.");
      }
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "The row could not be updated."
      );
    } finally {
      setResolvingRowId(null);
      setBusy(false);
    }
  }

  async function handleApplyImport() {
    if (!selectedImportId || !selectedImport) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await requestApply({ importId: selectedImportId });
      const result = await applyImport({ importId: selectedImportId, batchSize: 25 });
      setLastAppliedSummary({
        appliedCount: result.appliedCount,
        touchedDrugCount: result.touchedDrugCount,
      });
      setMessage(
        `Applied ${result.appliedCount} matched row${result.appliedCount === 1 ? "" : "s"} across ${result.touchedDrugCount} product${result.touchedDrugCount === 1 ? "" : "s"}.`
      );
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "The import could not be applied."
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedImport =
    detail?.importDoc ?? imports.find((item) => item._id === selectedImportId) ?? null;
  const selectedImportSheetNames = selectedImport?.sheetNames ?? [];
  const selectedImportAppliedRows = selectedImport?.appliedRows ?? 0;
  const selectedImportParseErrorCount = selectedImport?.parseErrorCount ?? 0;
  const hasPendingMatchedRows = selectedImport
    ? selectedImport.matchedRows > selectedImportAppliedRows
    : false;
  const likelyWarningReason =
    selectedImport?.sourceType === "uae_official_directory" && selectedImportParseErrorCount > 0
      ? "Most warnings in this UAE file come from rows that need market confirmation or cleaner parsing, not from failed uploads."
      : selectedImportParseErrorCount > 0
        ? "Warnings usually mean the row is missing a field the matcher needs, not that the file is broken."
        : null;
  const applyBlockedReason = !selectedImport
    ? "Select an import first."
    : !hasPendingMatchedRows
        ? "There are no matched rows left to apply."
        : selectedImport.status === "uploaded"
          ? "Parse the workbook before applying."
          : selectedImport.status === "failed"
            ? "This import failed and cannot be applied."
            : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-sm font-medium text-zinc-100">Upload workbook</p>
            <p className="mt-1 text-sm text-zinc-500">Supported: `.xlsx`, `.xls`</p>
            <Input
              value={sourceMarket}
              onChange={(event) => setSourceMarket(event.target.value)}
              placeholder="Optional source market"
              className="mt-3 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-600"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={handleFileChange}
              disabled={busy}
            />
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {busy ? "Working..." : "Upload and Parse"}
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-100">Recent imports</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => selectedImportId && setSelectedImportId(selectedImportId)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {imports.length === 0 ? (
                <p className="text-sm text-zinc-500">No imports yet.</p>
              ) : (
                imports.map((item) => (
                  <div
                    key={item._id}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedImportId === item._id
                        ? "border-zinc-600 bg-zinc-800"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-zinc-100">
                        {item.fileName}
                      </span>
                      <Badge className={STATUS_STYLES[item.status] ?? STATUS_STYLES.uploaded}>
                        {item.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.totalRows} rows • {item.matchedRows} matched • {item.unresolvedRows} unresolved
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setSelectedImportId(item._id)}
                    >
                      Open import review
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {message && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {selectedImport ? (
            <>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {selectedImport.fileName}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={STATUS_STYLES[selectedImport.status] ?? STATUS_STYLES.uploaded}
                      >
                        {selectedImport.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {selectedImportSheetNames.length > 0
                        ? selectedImportSheetNames.join(", ")
                        : "No sheets parsed yet"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {selectedImport.sourceType === "uae_official_directory"
                        ? "Official UAE directory import"
                        : selectedImport.sourceType === "mohap_uae_complete_product_list"
                          ? "MOHAP UAE complete product list"
                          : selectedImport.sourceMarket
                            ? `${selectedImport.sourceMarket} registration import`
                            : "General registration import"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleApplyImport}
                    disabled={busy || Boolean(applyBlockedReason)}
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Apply Matched Rows
                  </Button>
                </div>

                {applyBlockedReason && (
                  <p className="mt-3 text-sm text-amber-300">{applyBlockedReason}</p>
                )}

                {selectedImport.unresolvedRows > 0 && hasPendingMatchedRows ? (
                  <p className="mt-3 text-sm text-zinc-400">
                    Applying now will write the matched rows and leave unresolved rows staged for later review.
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Total</p>
                    <p className="mt-1 text-xl font-semibold text-white">{selectedImport.totalRows}</p>
                    <p className="mt-1 text-xs text-zinc-500">Rows parsed from this workbook.</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Matched automatically
                    </p>
                    <p className="mt-1 text-xl font-semibold text-emerald-300">{selectedImport.matchedRows}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Rows confidently linked to a product already in the system.
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Needs review</p>
                    <p className="mt-1 text-xl font-semibold text-amber-300">{selectedImport.unresolvedRows}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Rows that still need a match or should be skipped manually.
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Applied</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--brand-300)]">{selectedImportAppliedRows}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Rows already written into UAE market evidence.
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Validation warnings
                    </p>
                    <p className="mt-1 text-xl font-semibold text-red-300">{selectedImportParseErrorCount}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Rows with missing or unclear fields that need review.
                    </p>
                  </div>
                </div>

                {likelyWarningReason && (
                  <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <p className="font-medium text-amber-200">About the warnings</p>
                    <p className="mt-1">{likelyWarningReason}</p>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Parser coverage</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Brand, ingredients, manufacturer, supplier, price, form, pack size, and UAE status.
                      {selectedImport.sourceType === "mohap_uae_complete_product_list"
                        ? " MOHAP provenance like Source ID and registration date is preserved."
                        : null}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Match policy</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Conservative brand-first matching with ingredient plus manufacturer fallback.
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Devices</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Device-like rows are flagged and kept separate from the synced medicine graph.
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">After apply</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Refresh gaps and product market views so UAE presence affects whitespace scoring.
                    </p>
                  </div>
                </div>

                {lastAppliedSummary && (
                  <div className="mt-4 rounded-lg border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-300)]">
                      UAE apply summary
                    </p>
                    <p className="mt-2 text-sm text-zinc-100">
                      Applied {lastAppliedSummary.appliedCount} UAE row
                      {lastAppliedSummary.appliedCount === 1 ? "" : "s"} and confirmed market
                      evidence on {lastAppliedSummary.touchedDrugCount} matched product
                      {lastAppliedSummary.touchedDrugCount === 1 ? "" : "s"}.
                    </p>
                    <p className="mt-2 text-sm text-zinc-300">
                      Next step: review touched products or rerun gap and opportunity workflows so
                      UAE registrations reduce false whitespace.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => (window.location.href = "/drugs")}
                      >
                        Review products
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => (window.location.href = "/gaps")}
                      >
                        Refresh gap workflow
                      </Button>
                    </div>
                  </div>
                )}

                {selectedImport.lastError && (
                  <p className="mt-4 text-sm text-red-300">{selectedImport.lastError}</p>
                )}
              </div>

              <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-100">Staged rows</h4>
                    <p className="text-sm text-zinc-500">
                      Review unresolved matches and skip anything you do not want to apply.
                    </p>
                  </div>
                  {detail && detail.totalRowCount > detail.rows.length ? (
                    <p className="text-xs text-zinc-500">
                      Showing {detail.rows.length} of {detail.totalRowCount} rows
                    </p>
                  ) : null}
                </div>

                <div className="max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-500">Product</TableHead>
                        <TableHead className="text-zinc-500">Type</TableHead>
                        <TableHead className="text-zinc-500">Country</TableHead>
                        <TableHead className="text-zinc-500">Status</TableHead>
                        <TableHead className="text-zinc-500">Provenance</TableHead>
                        <TableHead className="text-zinc-500">Match</TableHead>
                        <TableHead className="text-zinc-500">Resolve</TableHead>
                        <TableHead className="text-zinc-500">Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail?.rows.length ? (
                        detail.rows.map((row) => {
                          const linkedDrug = drugs.find((drug) => drug._id === row.matchedDrugId);
                          return (
                            <TableRow
                              key={row._id}
                              className="border-zinc-800 hover:bg-zinc-800/40"
                            >
                              <TableCell className="whitespace-normal">
                                <div className="font-medium text-white">{row.productName}</div>
                                <div className="text-xs text-zinc-500">
                                  {[
                                    row.genericName,
                                    row.manufacturerName,
                                    row.supplierName,
                                    row.strength,
                                    row.packSize,
                                  ]
                                    .filter(Boolean)
                                    .join(" • ") || "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    row.productKind === "device"
                                      ? "bg-[color:var(--brand-surface)] text-[var(--brand-300)]"
                                      : "bg-zinc-800 text-zinc-300"
                                  }
                                >
                                  {row.productKind === "device" ? "Device" : "Medicine"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-zinc-300">{row.country}</TableCell>
                              <TableCell className="text-zinc-300">
                                {row.registrationStatus.replaceAll("_", " ")}
                                {row.priceAed ? (
                                  <div className="mt-1 text-xs text-zinc-500">AED {row.priceAed}</div>
                                ) : null}
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs text-zinc-500">
                                {[
                                  row.source,
                                  row.sourceRecordId ? `ID ${row.sourceRecordId}` : undefined,
                                  row.sourceStatus,
                                  row.approvalDate,
                                  row.supplierName,
                                  row.genericName,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    row.matchStatus === "matched"
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : row.matchStatus === "skipped"
                                        ? "bg-zinc-700/40 text-zinc-200"
                                        : "bg-amber-500/15 text-amber-300"
                                  }
                                >
                                  {row.matchStatus.replaceAll("_", " ")}
                                </Badge>
                                <div className="mt-1 text-xs text-zinc-500">
                                  {linkedDrug?.name ?? "No linked drug yet"}
                                </div>
                                {row.matchExplanation && (
                                  <div className="mt-1 text-xs text-zinc-500">
                                    {row.matchExplanation}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[20rem] whitespace-normal">
                                {resolvingRowId === row._id ? (
                                  <Select
                                    value={row.matchedDrugId ?? "__none"}
                                    onValueChange={(value) => {
                                      if (value === "__none") return;
                                      void handleResolveRow(row._id, value);
                                    }}
                                  >
                                    <SelectTrigger className="w-full min-w-0 border-zinc-700 bg-zinc-900 text-white">
                                      <SelectValue placeholder="Link a drug or skip" />
                                    </SelectTrigger>
                                    <SelectContent
                                      align="start"
                                      className="max-h-80 w-[min(28rem,calc(100vw-3rem))] min-w-[20rem] border-zinc-700 bg-zinc-900"
                                    >
                                      <SelectItem value="__none" className="text-zinc-400">
                                        Keep current selection
                                      </SelectItem>
                                      <SelectItem value="__skip" className="text-zinc-300">
                                        Skip this row
                                      </SelectItem>
                                      {drugs.map((drug) => (
                                        <SelectItem
                                          key={drug._id}
                                          value={drug._id}
                                          className="text-white"
                                          title={`${drug.name} • ${drug.genericName}`}
                                        >
                                          {drug.name} • {drug.genericName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setResolvingRowId(row._id)}
                                    className="w-full justify-start"
                                  >
                                    {row.matchStatus === "matched" ? "Change match" : "Resolve row"}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-normal text-xs text-zinc-500">
                                {row.validationIssues.length > 0
                                  ? row.validationIssues.join(" ")
                                  : "No issues"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow className="border-zinc-800">
                          <TableCell colSpan={8} className="py-8 text-center text-zinc-500">
                            {selectedImport.status === "uploaded"
                              ? "Upload and parse a workbook to see staged rows."
                              : "No staged rows available."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
              {imports.length > 0
                ? "Select an import from the left to load the review workspace."
                : "Upload a workbook to create the first registration import."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
