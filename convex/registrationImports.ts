import {
  internalMutation,
  internalQuery,
  MutationCtx,
  mutation,
  QueryCtx,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import {
  RegistrationImportStatus,
  RegistrationStatus,
} from "../src/lib/registrationImports";

const registrationStatusValidator = v.union(
  v.literal("registered"),
  v.literal("not_found"),
  v.literal("unverified")
);

const importStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("parsed"),
  v.literal("needs_review"),
  v.literal("ready"),
  v.literal("applied"),
  v.literal("failed")
);

const matchStatusValidator = v.union(
  v.literal("matched"),
  v.literal("unmatched"),
  v.literal("ambiguous"),
  v.literal("skipped")
);

const applyStateValidator = v.union(
  v.literal("pending"),
  v.literal("applied"),
  v.literal("skipped")
);

const importRowValidator = v.object({
  productName: v.string(),
  genericName: v.optional(v.string()),
  manufacturerName: v.optional(v.string()),
  mahName: v.optional(v.string()),
  supplierName: v.optional(v.string()),
  country: v.string(),
  registrationStatus: registrationStatusValidator,
  registrationNumber: v.optional(v.string()),
  approvalDate: v.optional(v.string()),
  strength: v.optional(v.string()),
  form: v.optional(v.string()),
  packSize: v.optional(v.string()),
  priceAed: v.optional(v.string()),
  classification: v.optional(v.string()),
  dispensingMode: v.optional(v.string()),
  countryOfOrigin: v.optional(v.string()),
  productKind: v.optional(v.union(v.literal("medicine"), v.literal("device"))),
  matchExplanation: v.optional(v.string()),
  sourceNote: v.optional(v.string()),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  matchStatus: matchStatusValidator,
  applyState: applyStateValidator,
  matchedDrugId: v.optional(v.id("drugs")),
  matchedCompanyId: v.optional(v.id("companies")),
  validationIssues: v.array(v.string()),
  rawRow: v.record(v.string(), v.string()),
});

type ImportRowInput = {
  productName: string;
  genericName?: string;
  manufacturerName?: string;
  mahName?: string;
  supplierName?: string;
  country: string;
  registrationStatus: RegistrationStatus;
  registrationNumber?: string;
  approvalDate?: string;
  strength?: string;
  form?: string;
  packSize?: string;
  priceAed?: string;
  classification?: string;
  dispensingMode?: string;
  countryOfOrigin?: string;
  productKind?: "medicine" | "device";
  matchExplanation?: string;
  sourceNote?: string;
  sourceSheet: string;
  sourceRowNumber: number;
  matchStatus: "matched" | "unmatched" | "ambiguous" | "skipped";
  applyState: "pending" | "applied" | "skipped";
  matchedDrugId?: Id<"drugs">;
  matchedCompanyId?: Id<"companies">;
  validationIssues: string[];
  rawRow: Record<string, string>;
};

type ImportSummary = {
  totalRows: number;
  matchedRows: number;
  unresolvedRows: number;
  ambiguousRows: number;
  skippedRows: number;
  parseErrorCount: number;
};

function buildImportSummary(rows: Array<Doc<"registrationImportRows"> | ImportRowInput>): ImportSummary {
  const totalRows = rows.length;
  const matchedRows = rows.filter((row) => row.matchStatus === "matched").length;
  const ambiguousRows = rows.filter((row) => row.matchStatus === "ambiguous").length;
  const skippedRows = rows.filter((row) => row.matchStatus === "skipped").length;
  const unresolvedRows = rows.filter(
    (row) => row.matchStatus === "unmatched" || row.matchStatus === "ambiguous"
  ).length;
  const parseErrorCount = rows.filter((row) => row.validationIssues.length > 0).length;
  return {
    totalRows,
    matchedRows,
    unresolvedRows,
    ambiguousRows,
    skippedRows,
    parseErrorCount,
  };
}

function deriveImportStatus(summary: ImportSummary): RegistrationImportStatus {
  if (summary.totalRows === 0) return "parsed";
  if (summary.unresolvedRows > 0) return "needs_review";
  return "ready";
}

type DbCtx = QueryCtx | MutationCtx;

async function loadImportRows(ctx: DbCtx, importId: Id<"registrationImports">) {
  return await ctx.db
    .query("registrationImportRows")
    .withIndex("by_import", (q) => q.eq("importId", importId))
    .collect();
}

async function syncImportSummary(
  ctx: MutationCtx,
  importId: Id<"registrationImports">,
  patch: Partial<Doc<"registrationImports">> = {}
) {
  const rows = await loadImportRows(ctx, importId);
  const summary = buildImportSummary(rows);
  const appliedRows = rows.filter((row) => row.applyState === "applied").length;
  await ctx.db.patch(importId, {
    totalRows: summary.totalRows,
    matchedRows: summary.matchedRows,
    unresolvedRows: summary.unresolvedRows,
    ambiguousRows: summary.ambiguousRows,
    skippedRows: summary.skippedRows,
    appliedRows,
    parseErrorCount: summary.parseErrorCount,
    status: deriveImportStatus(summary),
    updatedAt: Date.now(),
    ...patch,
  });
}

export const createImport = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    sourceMarket: v.optional(v.string()),
    sourceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("registrationImports", {
      ...args,
      sourceType:
        args.sourceType ??
        ((args.sourceMarket?.trim().toLowerCase() === "uae" ||
          args.fileName.toLowerCase().includes("drugdirectory_products"))
          ? "uae_official_directory"
          : undefined),
      status: "uploaded",
      sheetNames: [],
      totalRows: 0,
      matchedRows: 0,
      unresolvedRows: 0,
      ambiguousRows: 0,
      skippedRows: 0,
      appliedRows: 0,
      parseErrorCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listImports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("registrationImports")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit ?? 20);
  },
});

export const getImportDetail = query({
  args: {
    importId: v.id("registrationImports"),
    rowLimit: v.optional(v.number()),
  },
  handler: async (ctx, { importId, rowLimit }) => {
    const importDoc = await ctx.db.get(importId);
    if (!importDoc) return null;
    const limit = Math.max(0, rowLimit ?? 150);
    if (limit === 0) {
      return { importDoc, rows: [], totalRowCount: importDoc.totalRows };
    }

    const priorityStatuses: Array<Doc<"registrationImportRows">["matchStatus"]> = [
      "ambiguous",
      "unmatched",
      "matched",
      "skipped",
    ];
    const previewRows: Doc<"registrationImportRows">[] = [];

    for (const status of priorityStatuses) {
      const remaining = limit - previewRows.length;
      if (remaining <= 0) break;
      const statusRows = await ctx.db
        .query("registrationImportRows")
        .withIndex("by_import_and_match_status", (q) =>
          q.eq("importId", importId).eq("matchStatus", status)
        )
        .take(remaining);
      previewRows.push(...statusRows);
    }

    const limitedRows = previewRows.sort((left, right) => {
      const priority: Record<Doc<"registrationImportRows">["matchStatus"], number> = {
        ambiguous: 0,
        unmatched: 1,
        matched: 2,
        skipped: 3,
      };
      const matchDelta = priority[left.matchStatus] - priority[right.matchStatus];
      if (matchDelta !== 0) return matchDelta;
      if (left.sourceSheet !== right.sourceSheet) {
        return left.sourceSheet.localeCompare(right.sourceSheet);
      }
      return left.sourceRowNumber - right.sourceRowNumber;
    });

    return { importDoc, rows: limitedRows, totalRowCount: importDoc.totalRows };
  },
});

export const resolveRowMatch = mutation({
  args: {
    rowId: v.id("registrationImportRows"),
    matchedDrugId: v.optional(v.id("drugs")),
    skip: v.optional(v.boolean()),
  },
  handler: async (ctx, { rowId, matchedDrugId, skip }) => {
    const row = await ctx.db.get(rowId);
    if (!row) throw new Error("Import row not found.");

    const now = Date.now();
    if (skip) {
      await ctx.db.patch(rowId, {
        matchStatus: "skipped",
        applyState: "skipped",
        matchedDrugId: undefined,
        matchedCompanyId: undefined,
        matchExplanation: "Skipped by reviewer.",
        updatedAt: now,
      });
      await syncImportSummary(ctx, row.importId);
      return;
    }

    if (!matchedDrugId) {
      await ctx.db.patch(rowId, {
        matchStatus: "unmatched",
        applyState: "pending",
        matchedDrugId: undefined,
        matchedCompanyId: undefined,
        matchExplanation: "Match cleared for manual review.",
        updatedAt: now,
      });
      await syncImportSummary(ctx, row.importId);
      return;
    }

    const drug = await ctx.db.get(matchedDrugId);
    if (!drug) throw new Error("Drug not found.");

    await ctx.db.patch(rowId, {
      matchStatus: "matched",
      applyState: "pending",
      matchedDrugId,
      matchedCompanyId: drug.companyId,
      matchExplanation: `Matched manually to ${drug.name}.`,
      updatedAt: now,
    });
    await syncImportSummary(ctx, row.importId);
  },
});

export const requestApply = mutation({
  args: { importId: v.id("registrationImports") },
  handler: async (ctx, { importId }) => {
    const importDoc = await ctx.db.get(importId);
    if (!importDoc) throw new Error("Import not found.");

    const rows = await loadImportRows(ctx, importId);
    const unresolvedRows = rows.filter(
      (row) => row.matchStatus === "unmatched" || row.matchStatus === "ambiguous"
    );
    if (unresolvedRows.length > 0) {
      throw new Error("Resolve or skip all unmatched rows before applying.");
    }

    const pendingMatchedRows = rows.filter(
      (row) => row.matchStatus === "matched" && row.applyState === "pending"
    );
    if (pendingMatchedRows.length === 0) {
      throw new Error("There are no matched rows left to apply.");
    }

    await ctx.db.patch(importId, {
      applyRequestedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getMatchingSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [drugs, companies, links, canonicalProducts] = await Promise.all([
      ctx.db.query("drugs").collect(),
      ctx.db.query("companies").collect(),
      ctx.db.query("drugEntityLinks").collect(),
      ctx.db.query("canonicalProducts").collect(),
    ]);

    const companyById = new Map(companies.map((company) => [company._id, company]));
    const linksByDrugId = new Map<Id<"drugs">, Doc<"drugEntityLinks">[]>();
    for (const link of links) {
      const current = linksByDrugId.get(link.drugId) ?? [];
      current.push(link);
      linksByDrugId.set(link.drugId, current);
    }

    return {
      drugs: drugs.map((drug) => {
        const company = drug.companyId ? companyById.get(drug.companyId) : undefined;
        const drugLinks = linksByDrugId.get(drug._id) ?? [];
        const manufacturerCandidates = [
          drug.manufacturerName,
          drug.primaryManufacturerName,
          company?.name,
          ...drugLinks
            .filter((link) => link.relationshipType === "manufacturer")
            .map((link) =>
              link.entityName ?? (link.companyId ? companyById.get(link.companyId)?.name : undefined)
            ),
        ].filter((value): value is string => Boolean(value));
        const mahCandidates = [
          drug.primaryMarketAuthorizationHolderName,
          ...drugLinks
            .filter((link) => link.relationshipType === "market_authorization_holder")
            .map((link) =>
              link.entityName ?? (link.companyId ? companyById.get(link.companyId)?.name : undefined)
            ),
        ].filter((value): value is string => Boolean(value));

        return {
          _id: drug._id,
          companyId: drug.companyId,
          name: drug.name,
          genericName: drug.genericName,
          category: drug.category,
          isDevice: ["medical device", "diagnostic"].includes(
            drug.category?.trim().toLowerCase() ?? ""
          ),
          manufacturerCandidates,
          mahCandidates,
        };
      }),
      companies: companies.map((company) => ({
        _id: company._id,
        name: company.name,
      })),
      canonicalProducts: canonicalProducts.map((product) => ({
        _id: product._id,
        brandName: product.brandName,
        inn: product.inn,
        normalizedBrandName: product.normalizedBrandName ?? "",
        normalizedInn: product.normalizedInn ?? "",
        primaryManufacturerName: product.primaryManufacturerName,
        primaryMahName: product.primaryMahName,
        linkedDrugIds: drugs
          .filter((drug) => drug.canonicalProductId === product._id)
          .map((drug) => drug._id),
      })),
    };
  },
});

export const clearImportRows = internalMutation({
  args: { importId: v.id("registrationImports") },
  handler: async (ctx, { importId }) => {
    const rows = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import", (q) => q.eq("importId", importId))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.patch(importId, {
      totalRows: 0,
      matchedRows: 0,
      unresolvedRows: 0,
      ambiguousRows: 0,
      skippedRows: 0,
      appliedRows: 0,
      parseErrorCount: 0,
      updatedAt: Date.now(),
    });
  },
});

export const insertImportRowsChunk = internalMutation({
  args: {
    importId: v.id("registrationImports"),
    rows: v.array(importRowValidator),
  },
  handler: async (ctx, { importId, rows }) => {
    const now = Date.now();
    for (const row of rows) {
      await ctx.db.insert("registrationImportRows", {
        importId,
        ...row,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const finalizeParsedImport = internalMutation({
  args: {
    importId: v.id("registrationImports"),
    sheetNames: v.array(v.string()),
    status: importStatusValidator,
    summary: v.object({
      totalRows: v.number(),
      matchedRows: v.number(),
      unresolvedRows: v.number(),
      ambiguousRows: v.number(),
      skippedRows: v.number(),
      parseErrorCount: v.number(),
    }),
  },
  handler: async (ctx, { importId, sheetNames, status, summary }) => {
    await ctx.db.patch(importId, {
      sheetNames,
      status,
      parsedAt: Date.now(),
      totalRows: summary.totalRows,
      matchedRows: summary.matchedRows,
      unresolvedRows: summary.unresolvedRows,
      ambiguousRows: summary.ambiguousRows,
      skippedRows: summary.skippedRows,
      parseErrorCount: summary.parseErrorCount,
      appliedRows: 0,
      lastError: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markImportFailed = internalMutation({
  args: {
    importId: v.id("registrationImports"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { importId, errorMessage }) => {
    await ctx.db.patch(importId, {
      status: "failed",
      lastError: errorMessage,
      updatedAt: Date.now(),
    });
  },
});

export const applyImportBatch = internalMutation({
  args: {
    importId: v.id("registrationImports"),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { importId, batchSize }) => {
    const importDoc = await ctx.db.get(importId);
    if (!importDoc) throw new Error("Import not found.");

    const rows = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import_and_match_status_and_apply_state", (q) =>
        q.eq("importId", importId).eq("matchStatus", "matched").eq("applyState", "pending")
      )
      .take(batchSize ?? 25);

    if (rows.length === 0) {
      return { appliedCount: 0, done: true };
    }

    const now = Date.now();
    const drugPatchState = new Map<
      Id<"drugs">,
      {
        registrations: NonNullable<Doc<"drugs">["menaRegistrations"]>;
      }
    >();
    const touchedDrugIds = new Set<Id<"drugs">>();

    for (const row of rows) {
      if (!row.matchedDrugId) continue;
      touchedDrugIds.add(row.matchedDrugId);
      let drugState = drugPatchState.get(row.matchedDrugId);
      if (!drugState) {
        const drug = await ctx.db.get(row.matchedDrugId);
        if (!drug) continue;
        drugState = { registrations: [...(drug.menaRegistrations ?? [])] };
        drugPatchState.set(row.matchedDrugId, drugState);
      }

      const nextRegistration = {
        country: row.country,
        status: row.registrationStatus,
        registrationNumber: row.registrationNumber,
        source: `Manual import · ${importDoc.fileName}${importDoc.sourceMarket ? ` · ${importDoc.sourceMarket}` : ""}`,
        verifiedAt: now,
      };

      const existingIndex = drugState.registrations.findIndex(
        (registration) => registration.country === row.country
      );
      if (existingIndex >= 0) {
        drugState.registrations[existingIndex] = {
          ...drugState.registrations[existingIndex],
          ...nextRegistration,
        };
      } else {
        drugState.registrations.push(nextRegistration);
      }
    }

    for (const [drugId, state] of drugPatchState) {
      await ctx.db.patch(drugId, {
        menaRegistrations: state.registrations,
        menaRegistrationCount: state.registrations.filter(
          (registration) => registration.status === "registered"
        ).length,
      });
    }

    for (const row of rows) {
      if (!row.matchedDrugId) continue;
      const existingOpportunity = await ctx.db
        .query("opportunities")
        .withIndex("by_drug_and_country", (q) =>
          q.eq("drugId", row.matchedDrugId!).eq("country", row.country)
        )
        .unique();
      const existingEvidence = existingOpportunity?.evidenceItems ?? [];
      const uaeEvidenceClaim =
        row.registrationStatus === "registered"
          ? `${row.productName} is listed as registered in UAE official directory.`
          : `${row.productName} appears in UAE import with status ${row.registrationStatus}.`;
      const derivedRegulatoryStatus =
        row.registrationStatus === "registered"
          ? "registered"
          : row.registrationStatus === "not_found"
            ? "not_registered"
            : "pending_registration";
      const derivedAvailabilityStatus =
        row.registrationStatus === "registered"
          ? "formally_registered"
          : row.registrationStatus === "not_found"
            ? "not_found"
            : "unverified";
      await ctx.runMutation(api.opportunities.upsert, {
        drugId: row.matchedDrugId,
        country: row.country,
        regulatoryStatus:
          row.registrationStatus === "registered"
            ? "registered"
            : existingOpportunity?.regulatoryStatus ?? derivedRegulatoryStatus,
        availabilityStatus:
          row.registrationStatus === "registered"
            ? "formally_registered"
            : existingOpportunity?.availabilityStatus ?? derivedAvailabilityStatus,
        matchedBrandName: row.productName,
        matchedGenericName: row.genericName ?? existingOpportunity?.matchedGenericName,
        marketAccessNotes:
          existingOpportunity?.marketAccessNotes ??
          row.dispensingMode ??
          undefined,
        evidenceItems: existingEvidence.some((item) => item.claim === uaeEvidenceClaim)
          ? existingEvidence
          : [
              ...existingEvidence,
              {
                claim: uaeEvidenceClaim,
                title: importDoc.fileName,
                url: undefined,
                sourceType: "official_registry",
                confidence: "confirmed",
              },
            ],
      });

      if (row.priceAed && row.registrationStatus === "registered") {
        const numericPrice = Number(String(row.priceAed).replace(/[^0-9.]/g, ""));
        if (Number.isFinite(numericPrice)) {
          await ctx.runMutation(api.opportunities.upsertPriceEvidence, {
            drugId: row.matchedDrugId,
            country: row.country,
            sourceCategory: "official",
            sourceSystem: "mohap_uae",
            priceType: "registered",
            amount: numericPrice,
            currency: "AED",
            presentation: [row.strength, row.form, row.packSize].filter(Boolean).join(" · ") || undefined,
            unitBasis: row.packSize || undefined,
            observedAt: now,
            sourceTitle: `${importDoc.fileName} · UAE official directory`,
            sourceUrl: undefined,
            confidence: "confirmed",
            notes: row.dispensingMode || row.classification || undefined,
          });
        }
      }
    }

    for (const row of rows) {
      await ctx.db.patch(row._id, {
        applyState: "applied",
        appliedAt: now,
        updatedAt: now,
      });
    }

    const remainingRows = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import_and_match_status_and_apply_state", (q) =>
        q.eq("importId", importId).eq("matchStatus", "matched").eq("applyState", "pending")
      )
      .take(1);

    await ctx.db.patch(importId, {
      appliedRows: importDoc.appliedRows + rows.length,
      status: remainingRows.length === 0 ? "applied" : "ready",
      appliedAt: remainingRows.length === 0 ? now : importDoc.appliedAt,
      updatedAt: now,
    });

    return {
      appliedCount: rows.length,
      touchedDrugIds: [...touchedDrugIds],
      done: remainingRows.length === 0,
    };
  },
});
