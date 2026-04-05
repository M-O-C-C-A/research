"use node";

import * as XLSX from "xlsx";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  APPROVAL_DATE_HEADERS,
  classifyImportedProduct,
  canonicalizeHeader,
  CLASSIFICATION_HEADERS,
  compactText,
  COUNTRY_HEADERS,
  COUNTRY_OF_ORIGIN_HEADERS,
  DISPENSING_MODE_HEADERS,
  FORM_HEADERS,
  GENERIC_NAME_HEADERS,
  getRowValue,
  MAH_HEADERS,
  MANUFACTURER_HEADERS,
  normalizeCountry,
  normalizeIngredients,
  normalizeRegistrationStatus,
  normalizeText,
  PACK_SIZE_HEADERS,
  ParsedRegistrationRow,
  PRICE_AED_HEADERS,
  PRODUCT_NAME_HEADERS,
  REGISTRATION_NUMBER_HEADERS,
  SOURCE_NOTE_HEADERS,
  STRENGTH_HEADERS,
  STATUS_HEADERS,
  SUPPLIER_HEADERS,
} from "../src/lib/registrationImports";

type MatchingSnapshot = {
  drugs: Array<{
    _id: Id<"drugs">;
    companyId?: Id<"companies">;
    name: string;
    genericName: string;
    category?: string;
    isDevice?: boolean;
    manufacturerCandidates: string[];
    mahCandidates: string[];
  }>;
  companies: Array<{
    _id: Id<"companies">;
    name: string;
  }>;
  canonicalProducts: Array<{
    _id: Id<"canonicalProducts">;
    brandName: string;
    inn: string;
    normalizedBrandName: string;
    normalizedInn: string;
    primaryManufacturerName?: string;
    primaryMahName?: string;
    linkedDrugIds: Id<"drugs">[];
  }>;
};

type MatchResult = {
  matchStatus: "matched" | "unmatched" | "ambiguous";
  matchedDrugId?: Id<"drugs">;
  matchedCompanyId?: Id<"companies">;
  matchExplanation?: string;
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

function parseWorkbookRows(
  workbook: XLSX.WorkBook,
  options?: { defaultCountry?: string; matchExplanationPrefix?: string }
): ParsedRegistrationRow[] {
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
      const genericName = normalizeIngredients(
        getRowValue(canonicalRow, GENERIC_NAME_HEADERS)
      );
      const manufacturerName = compactText(getRowValue(canonicalRow, MANUFACTURER_HEADERS));
      const mahName = compactText(getRowValue(canonicalRow, MAH_HEADERS));
      const supplierName = compactText(getRowValue(canonicalRow, SUPPLIER_HEADERS));
      const strength = compactText(getRowValue(canonicalRow, STRENGTH_HEADERS));
      const form = compactText(getRowValue(canonicalRow, FORM_HEADERS));
      const packSize = compactText(getRowValue(canonicalRow, PACK_SIZE_HEADERS));
      const priceAed = compactText(getRowValue(canonicalRow, PRICE_AED_HEADERS));
      const classification = compactText(getRowValue(canonicalRow, CLASSIFICATION_HEADERS));
      const dispensingMode = compactText(
        getRowValue(canonicalRow, DISPENSING_MODE_HEADERS)
      );
      const countryOfOrigin = compactText(
        getRowValue(canonicalRow, COUNTRY_OF_ORIGIN_HEADERS)
      );
      const country =
        normalizeCountry(getRowValue(canonicalRow, COUNTRY_HEADERS)) ??
        options?.defaultCountry ??
        "";
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
      const productKind = classifyImportedProduct({
        classification,
        form,
        dispensingMode,
      });

      parsedRows.push({
        productName,
        genericName,
        manufacturerName,
        mahName,
        supplierName,
        country,
        registrationStatus,
        registrationNumber,
        approvalDate,
        strength,
        form,
        packSize,
        priceAed,
        classification,
        dispensingMode,
        countryOfOrigin,
        productKind,
        matchExplanation: options?.matchExplanationPrefix,
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

function splitIngredientSignals(value?: string) {
  return new Set(
    normalizeText(value)
      .split(/\s+\+\s+|\s*\/\s*|\s*,\s*|\s*;\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function ingredientSignalsMatch(left?: string, right?: string) {
  const leftNormalized = normalizeText(left);
  const rightNormalized = normalizeText(right);
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;

  const leftParts = splitIngredientSignals(left);
  const rightParts = splitIngredientSignals(right);
  if (leftParts.size === 0 || rightParts.size === 0) return false;

  for (const part of leftParts) {
    if (rightParts.has(part)) return true;
  }
  return false;
}

function canonicalMatchesEntity(
  product: MatchingSnapshot["canonicalProducts"][number],
  companyNames: string[]
) {
  if (companyNames.length === 0) return true;
  const candidates = [
    product.primaryManufacturerName,
    product.primaryMahName,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  return candidates.some((candidate) => companyNames.includes(candidate));
}

function chooseLinkedDrugFromCanonical(args: {
  canonicalProduct: MatchingSnapshot["canonicalProducts"][number];
  eligibleDrugs: MatchingSnapshot["drugs"];
  productName: string;
  genericName: string;
  companyNames: string[];
}) {
  let linkedCandidates = args.eligibleDrugs.filter((drug) =>
    args.canonicalProduct.linkedDrugIds.includes(drug._id)
  );

  if (linkedCandidates.length > 1) {
    const brandExact = linkedCandidates.filter(
      (drug) => normalizeText(drug.name) === args.productName
    );
    if (brandExact.length === 1) linkedCandidates = brandExact;
  }

  if (linkedCandidates.length > 1 && args.genericName) {
    const genericExact = linkedCandidates.filter((drug) =>
      ingredientSignalsMatch(drug.genericName, args.genericName)
    );
    if (genericExact.length === 1) linkedCandidates = genericExact;
  }

  if (linkedCandidates.length > 1 && args.companyNames.length > 0) {
    const narrowed = matchByEntityName(linkedCandidates, args.companyNames);
    if (narrowed.length > 0) linkedCandidates = narrowed;
  }

  return uniqueDrugs(linkedCandidates);
}

function matchViaCanonicalProduct(
  row: ParsedRegistrationRow,
  snapshot: MatchingSnapshot,
  eligibleDrugs: MatchingSnapshot["drugs"],
  companyNames: string[],
  validationIssues: string[]
): MatchResult | null {
  if (row.productKind === "device") return null;

  const productName = normalizeText(row.productName);
  const genericName = normalizeText(row.genericName);
  const canonicalProducts = snapshot.canonicalProducts;

  let canonicalCandidates = canonicalProducts.filter(
    (product) => product.normalizedBrandName === productName
  );

  if (canonicalCandidates.length > 1 && genericName) {
    const narrowed = canonicalCandidates.filter((product) =>
      ingredientSignalsMatch(product.inn, row.genericName)
    );
    if (narrowed.length > 0) canonicalCandidates = narrowed;
  }

  if (canonicalCandidates.length > 1 && companyNames.length > 0) {
    const narrowed = canonicalCandidates.filter((product) =>
      canonicalMatchesEntity(product, companyNames)
    );
    if (narrowed.length > 0) canonicalCandidates = narrowed;
  }

  if (canonicalCandidates.length === 0 && genericName) {
    canonicalCandidates = canonicalProducts.filter((product) =>
      ingredientSignalsMatch(product.inn, row.genericName)
    );
    if (canonicalCandidates.length > 1 && companyNames.length > 0) {
      const narrowed = canonicalCandidates.filter((product) =>
        canonicalMatchesEntity(product, companyNames)
      );
      if (narrowed.length > 0) canonicalCandidates = narrowed;
    }
  }

  canonicalCandidates = [...new Map(canonicalCandidates.map((product) => [product._id, product])).values()];

  if (canonicalCandidates.length === 1) {
    const canonicalProduct = canonicalCandidates[0];
    const linkedDrugCandidates = chooseLinkedDrugFromCanonical({
      canonicalProduct,
      eligibleDrugs,
      productName,
      genericName,
      companyNames,
    });

    if (linkedDrugCandidates.length === 1) {
      return {
        matchStatus: "matched",
        matchedDrugId: linkedDrugCandidates[0]._id,
        matchedCompanyId: linkedDrugCandidates[0].companyId,
        matchExplanation:
          normalizeText(canonicalProduct.brandName) === productName
            ? "Matched through the FDA/EMA canonical product graph on exact brand name."
            : "Matched through the FDA/EMA canonical product graph on INN plus manufacturer context.",
        validationIssues,
      };
    }

    if (linkedDrugCandidates.length > 1) {
      return {
        matchStatus: "ambiguous",
        matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
        matchExplanation:
          "A strong FDA/EMA canonical product match was found, but multiple linked internal products still fit this row.",
        validationIssues: [...validationIssues, "Multiple internal products matched the same canonical product."],
      };
    }

    return {
      matchStatus: "unmatched",
      matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
      matchExplanation:
        "A likely FDA/EMA canonical product match was found, but no linked internal product record is available yet.",
      validationIssues: [...validationIssues, "Canonical FDA/EMA match found but no linked internal product exists yet."],
    };
  }

  if (canonicalCandidates.length > 1) {
    return {
      matchStatus: "ambiguous",
      matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
      matchExplanation:
        "Multiple FDA/EMA canonical products fit this UAE row; review is required.",
      validationIssues: [...validationIssues, "Multiple canonical FDA/EMA products matched this row."],
    };
  }

  return null;
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
  const companyNames = [row.manufacturerName, row.mahName, row.supplierName]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const eligibleDrugs = snapshot.drugs.filter((drug) =>
    row.productKind === "device" ? drug.isDevice : !drug.isDevice
  );

  let brandCandidates = eligibleDrugs.filter(
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
      matchExplanation:
        "Matched on exact brand name" +
        (companyNames.length > 0 ? " with supporting manufacturer/supplier context." : "."),
      validationIssues,
    };
  }
  if (brandCandidates.length > 1) {
    return {
      matchStatus: "ambiguous",
      matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
      matchExplanation: "Multiple products matched the brand name; review required.",
      validationIssues: [...validationIssues, "Multiple drugs matched this product row."],
    };
  }

  if (genericName && companyNames.length > 0) {
    const genericCandidates = uniqueDrugs(
      matchByEntityName(
        eligibleDrugs.filter((drug) => normalizeText(drug.genericName) === genericName),
        companyNames
      )
    );
    if (genericCandidates.length === 1) {
      return {
        matchStatus: "matched",
        matchedDrugId: genericCandidates[0]._id,
        matchedCompanyId: genericCandidates[0].companyId,
        matchExplanation: "Matched conservatively on ingredient/generic plus manufacturer or supplier context.",
        validationIssues,
      };
    }
    if (genericCandidates.length > 1) {
      return {
        matchStatus: "ambiguous",
        matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
        matchExplanation:
          "Ingredient/generic and entity context still match multiple products; review required.",
        validationIssues: [...validationIssues, "Multiple drugs matched by generic name and company."],
      };
    }
  }

  const canonicalMatch = matchViaCanonicalProduct(
    row,
    snapshot,
    eligibleDrugs,
    companyNames,
    validationIssues
  );
  if (canonicalMatch) {
    return canonicalMatch;
  }

  return {
    matchStatus: "unmatched",
    matchedCompanyId: buildCompanyMatch(snapshot, companyNames),
    matchExplanation:
      "No conservative match found from brand, ingredient, manufacturer, and supplier fields.",
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
          fileName: string;
          sourceMarket?: string;
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
      const defaultCountry =
        importDetail.importDoc.sourceMarket === "UAE" ? "UAE" : undefined;
      const parsedRows = parseWorkbookRows(workbook, {
        defaultCountry,
        matchExplanationPrefix:
          defaultCountry === "UAE"
            ? "Parsed from UAE official directory workbook."
            : undefined,
      });
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
          matchExplanation: match.matchExplanation ?? row.matchExplanation,
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
    const touchedDrugIds = new Set<string>();

    for (;;) {
      const result: { appliedCount: number; touchedDrugIds?: string[]; done: boolean } = await ctx.runMutation(
        internal.registrationImports.applyImportBatch,
        {
          importId,
          batchSize,
        }
      );
      appliedCount += result.appliedCount;
      for (const drugId of result.touchedDrugIds ?? []) {
        touchedDrugIds.add(drugId);
      }
      if (result.done) break;
    }

    return { appliedCount, touchedDrugCount: touchedDrugIds.size };
  },
});
