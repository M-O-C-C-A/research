"use node";

import * as XLSX from "xlsx";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  APPROVAL_DATE_HEADERS,
  canonicalizeHeader,
  compactText,
  COUNTRY_HEADERS,
  GENERIC_NAME_HEADERS,
  getRowValue,
  MAH_HEADERS,
  MANUFACTURER_HEADERS,
  normalizeCountry,
  normalizeRegistrationStatus,
  normalizeText,
  ParsedRegistrationRow,
  PRODUCT_NAME_HEADERS,
  REGISTRATION_NUMBER_HEADERS,
  SOURCE_NOTE_HEADERS,
  STATUS_HEADERS,
} from "../src/lib/registrationImports";

type MatchingSnapshot = {
  drugs: Array<{
    _id: Id<"drugs">;
    companyId?: Id<"companies">;
    name: string;
    genericName: string;
    manufacturerCandidates: string[];
    mahCandidates: string[];
  }>;
  companies: Array<{
    _id: Id<"companies">;
    name: string;
  }>;
};

type MatchResult = {
  matchStatus: "matched" | "unmatched" | "ambiguous";
  matchedDrugId?: Id<"drugs">;
  matchedCompanyId?: Id<"companies">;
  validationIssues: string[];
};

function rowHasData(row: Record<string, string>) {
  return Object.values(row).some((value) => value.trim().length > 0);
}

function toCanonicalRow(rawRow: Record<string, unknown>): Record<string, string> {
  const canonicalRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const header = canonicalizeHeader(key);
    if (!header) continue;
    const stringValue =
      value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").trim();
    if (!stringValue && canonicalRow[header]) continue;
    canonicalRow[header] = stringValue;
  }
  return canonicalRow;
}

function parseWorkbookRows(workbook: XLSX.WorkBook): ParsedRegistrationRow[] {
  const parsedRows: ParsedRegistrationRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    rows.forEach((rawRow, index) => {
      const canonicalRow = toCanonicalRow(rawRow);
      if (!rowHasData(canonicalRow)) return;

      const productName = compactText(getRowValue(canonicalRow, PRODUCT_NAME_HEADERS)) ?? "";
      const genericName = compactText(getRowValue(canonicalRow, GENERIC_NAME_HEADERS));
      const manufacturerName = compactText(getRowValue(canonicalRow, MANUFACTURER_HEADERS));
      const mahName = compactText(getRowValue(canonicalRow, MAH_HEADERS));
      const country = normalizeCountry(getRowValue(canonicalRow, COUNTRY_HEADERS)) ?? "";
      const registrationStatus = normalizeRegistrationStatus(
        getRowValue(canonicalRow, STATUS_HEADERS)
      );
      const registrationNumber = compactText(
        getRowValue(canonicalRow, REGISTRATION_NUMBER_HEADERS)
      );
      const approvalDate = compactText(getRowValue(canonicalRow, APPROVAL_DATE_HEADERS));
      const sourceNote = compactText(getRowValue(canonicalRow, SOURCE_NOTE_HEADERS));

      const validationIssues: string[] = [];
      if (!productName) validationIssues.push("Missing product/brand name.");
      if (!country) validationIssues.push("Missing country/market.");

      parsedRows.push({
        productName,
        genericName,
        manufacturerName,
        mahName,
        country,
        registrationStatus,
        registrationNumber,
        approvalDate,
        sourceNote,
        sourceSheet: sheetName,
        sourceRowNumber: index + 2,
        validationIssues,
        rawRow: canonicalRow,
      });
    });
  }

  return parsedRows;
}

function uniqueDrugs<T extends { _id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row._id)) return false;
    seen.add(row._id);
    return true;
  });
}

function matchByEntityName(
  drugs: MatchingSnapshot["drugs"],
  companyNames: string[]
): MatchingSnapshot["drugs"] {
  if (companyNames.length === 0) return drugs;
  return drugs.filter((drug) =>
    [...drug.manufacturerCandidates, ...drug.mahCandidates].some((candidate) =>
      companyNames.includes(normalizeText(candidate))
    )
  );
}

function buildCompanyMatch(
  snapshot: MatchingSnapshot,
  companyNames: string[]
): Id<"companies"> | undefined {
  if (companyNames.length === 0) return undefined;
  const matches = snapshot.companies.filter((company) =>
    companyNames.includes(normalizeText(company.name))
  );
  return matches.length === 1 ? matches[0]._id : undefined;
}

function matchParsedRow(
  row: ParsedRegistrationRow,
  snapshot: MatchingSnapshot
): MatchResult {
  const validationIssues = [...row.validationIssues];
  if (validationIssues.length > 0) {
    return {
      matchStatus: "unmatched",
      validationIssues,
    };
  }

  const productName = normalizeText(row.productName);
  const genericName = normalizeText(row.genericName);
  const companyNames = [row.manufacturerName, row.mahName]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  let brandCandidates = snapshot.drugs.filter(
    (drug) => normalizeText(drug.name) === productName
  );
  if (genericName) {
    const narrowed = brandCandidates.filter(
      (drug) => normalizeText(drug.genericName) === genericName
    );
    if (narrowed.length > 0) brandCandidates = narrowed;
  }
  if (brandCandidates.length > 1 && companyNames.length > 0) {
    const narrowed = matchByEntityName(brandCandidates, companyNames);
    if (narrowed.length > 0) brandCandidates = narrowed;
  }

  brandCandidates = uniqueDrugs(brandCandidates);
  if (brandCandidates.length === 1) {
    return {
      matchStatus: "matched",
      matchedDrugId: brandCandidates[0]._id,
      matchedCompanyId: brandCandidates[0].companyId,
      validationIssues,
    };
  }
  if (brandCandidates.length > 1) {
    return {
      matchStatus: "ambiguous",
      matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
      validationIssues: [...validationIssues, "Multiple drugs matched this product row."],
    };
  }

  if (genericName && companyNames.length > 0) {
    const genericCandidates = uniqueDrugs(
      matchByEntityName(
        snapshot.drugs.filter((drug) => normalizeText(drug.genericName) === genericName),
        companyNames
      )
    );
    if (genericCandidates.length === 1) {
      return {
        matchStatus: "matched",
        matchedDrugId: genericCandidates[0]._id,
        matchedCompanyId: genericCandidates[0].companyId,
        validationIssues,
      };
    }
    if (genericCandidates.length > 1) {
      return {
        matchStatus: "ambiguous",
        matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
        validationIssues: [...validationIssues, "Multiple drugs matched by generic name and company."],
      };
    }
  }

  return {
    matchStatus: "unmatched",
    matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
    validationIssues: [...validationIssues, "No matching drug found in the database."],
  };
}

function summarizeRows(
  rows: Array<{
    matchStatus: "matched" | "unmatched" | "ambiguous" | "skipped";
    validationIssues: string[];
  }>
) {
  return {
    totalRows: rows.length,
    matchedRows: rows.filter((row) => row.matchStatus === "matched").length,
    unresolvedRows: rows.filter(
      (row) => row.matchStatus === "unmatched" || row.matchStatus === "ambiguous"
    ).length,
    ambiguousRows: rows.filter((row) => row.matchStatus === "ambiguous").length,
    skippedRows: rows.filter((row) => row.matchStatus === "skipped").length,
    parseErrorCount: rows.filter((row) => row.validationIssues.length > 0).length,
  };
}

export const parseImport = action({
  args: { importId: v.id("registrationImports") },
  handler: async (ctx, { importId }) => {
    try {
      const importDetail: {
        importDoc: {
          storageId: Id<"_storage">;
          status: string;
        };
      } | null = await ctx.runQuery(api.registrationImports.getImportDetail, {
        importId,
        rowLimit: 0,
      });

      if (!importDetail) throw new Error("Import not found.");

      const blob = await ctx.storage.get(importDetail.importDoc.storageId);
      if (!blob) throw new Error("Uploaded workbook could not be loaded from storage.");

      const workbookBuffer = Buffer.from(await blob.arrayBuffer());
      const workbook = XLSX.read(workbookBuffer, { type: "buffer" });
      const parsedRows = parseWorkbookRows(workbook);
      const snapshot: MatchingSnapshot = await ctx.runQuery(
        internal.registrationImports.getMatchingSnapshot,
        {}
      );

      const stagedRows = parsedRows.map((row) => {
        const match = matchParsedRow(row, snapshot);
        return {
          ...row,
          matchStatus: match.matchStatus,
          applyState: "pending" as const,
          matchedDrugId: match.matchedDrugId,
          matchedCompanyId: match.matchedCompanyId,
          validationIssues: match.validationIssues,
        };
      });

      await ctx.runMutation(internal.registrationImports.clearImportRows, { importId });
      for (let index = 0; index < stagedRows.length; index += 100) {
        await ctx.runMutation(internal.registrationImports.insertImportRowsChunk, {
          importId,
          rows: stagedRows.slice(index, index + 100),
        });
      }

      const summary = summarizeRows(stagedRows);
      const status =
        summary.totalRows === 0
          ? "parsed"
          : summary.unresolvedRows > 0
            ? "needs_review"
            : "ready";

      await ctx.runMutation(internal.registrationImports.finalizeParsedImport, {
        importId,
        sheetNames: workbook.SheetNames,
        status,
        summary,
      });

      return {
        status,
        sheetNames: workbook.SheetNames,
        ...summary,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The workbook could not be parsed.";
      await ctx.runMutation(internal.registrationImports.markImportFailed, {
        importId,
        errorMessage: message,
      });
      throw error;
    }
  },
});

export const applyImport = action({
  args: {
    importId: v.id("registrationImports"),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { importId, batchSize }) => {
    let appliedCount = 0;

    for (;;) {
      const result: { appliedCount: number; done: boolean } = await ctx.runMutation(
        internal.registrationImports.applyImportBatch,
        {
          importId,
          batchSize,
        }
      );
      appliedCount += result.appliedCount;
      if (result.done) break;
    }

    return { appliedCount };
  },
});
