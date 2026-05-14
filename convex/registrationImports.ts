import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

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
  source: v.optional(v.string()),
  sourceRecordId: v.optional(v.string()),
  productName: v.string(),
  genericName: v.optional(v.string()),
  manufacturerName: v.optional(v.string()),
  mahName: v.optional(v.string()),
  supplierName: v.optional(v.string()),
  supplierAddress: v.optional(v.string()),
  country: v.string(),
  registrationStatus: registrationStatusValidator,
  sourceStatus: v.optional(v.string()),
  registrationNumber: v.optional(v.string()),
  approvalDate: v.optional(v.string()),
  strength: v.optional(v.string()),
  form: v.optional(v.string()),
  packSize: v.optional(v.string()),
  priceAed: v.optional(v.string()),
  classification: v.optional(v.string()),
  dispensingMode: v.optional(v.string()),
  countryOfOrigin: v.optional(v.string()),
  bodySystem: v.optional(v.string()),
  therapeuticGroup: v.optional(v.string()),
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

function importCountDeltaForStatus(status: Doc<"registrationImportRows">["matchStatus"]) {
  return {
    matchedRows: status === "matched" ? 1 : 0,
    unresolvedRows: status === "unmatched" || status === "ambiguous" ? 1 : 0,
    ambiguousRows: status === "ambiguous" ? 1 : 0,
    skippedRows: status === "skipped" ? 1 : 0,
  };
}

function deriveImportStatusFromDoc(args: {
  totalRows: number;
  unresolvedRows: number;
  matchedRows: number;
  appliedRows: number;
}) {
  if (args.totalRows === 0) return "parsed" as const;
  if (args.unresolvedRows > 0) return "needs_review" as const;
  if (args.matchedRows > 0 && args.appliedRows >= args.matchedRows) return "applied" as const;
  return "ready" as const;
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
        ((args.fileName.toLowerCase().includes("mohap_complete_product_list") ||
          args.fileName.toLowerCase().includes("mohap complete product list"))
          ? "mohap_uae_complete_product_list"
          : (args.sourceMarket?.trim().toLowerCase() === "uae" ||
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

    return {
      importDoc,
      rows: limitedRows.map((row) => ({
        _id: row._id,
        source: row.source,
        sourceRecordId: row.sourceRecordId,
        productName: row.productName,
        genericName: row.genericName,
        manufacturerName: row.manufacturerName,
        supplierName: row.supplierName,
        country: row.country,
        registrationStatus: row.registrationStatus,
        sourceStatus: row.sourceStatus,
        approvalDate: row.approvalDate,
        strength: row.strength,
        packSize: row.packSize,
        priceAed: row.priceAed,
        productKind: row.productKind,
        matchExplanation: row.matchExplanation,
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.sourceRowNumber,
        matchStatus: row.matchStatus,
        matchedDrugId: row.matchedDrugId,
        validationIssues: row.validationIssues,
      })),
      totalRowCount: importDoc.totalRows,
    };
  },
});

export const getImportDetailSnapshot = action({
  args: {
    importId: v.id("registrationImports"),
    rowLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(api.registrationImports.getImportDetail, args);
  },
});

export const searchImportRows = query({
  args: {
    importId: v.id("registrationImports"),
    search: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { importId, search, limit }) => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const matches: Doc<"registrationImportRows">[] = [];
    const query = ctx.db
      .query("registrationImportRows")
      .withIndex("by_import", (q) => q.eq("importId", importId));

    for await (const row of query) {
      const matched = [
        row.productName,
        row.genericName,
        row.manufacturerName,
        row.supplierName,
        row.sourceRecordId,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
      if (!matched) continue;
      matches.push(row);
      if (matches.length >= (limit ?? 50)) break;
    }

    return matches.filter((row) =>
        [
          row.productName,
          row.genericName,
          row.manufacturerName,
          row.supplierName,
          row.sourceRecordId,
        ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
      );
  },
});

export const getImportRowBySourceRecordId = query({
  args: {
    importId: v.id("registrationImports"),
    sourceRecordId: v.string(),
  },
  handler: async (ctx, { importId, sourceRecordId }) => {
    return await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import_and_source_record_id", (q) =>
        q.eq("importId", importId).eq("sourceRecordId", sourceRecordId)
      )
      .unique();
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
    const importDoc = await ctx.db.get(row.importId);
    if (!importDoc) throw new Error("Import not found.");

    const now = Date.now();
    const previousCounts = importCountDeltaForStatus(row.matchStatus);
    const nextStatus = skip
      ? ("skipped" as const)
      : matchedDrugId
        ? ("matched" as const)
        : ("unmatched" as const);

    const nextCounts = importCountDeltaForStatus(nextStatus);
    const nextSummary = {
      matchedRows: importDoc.matchedRows - previousCounts.matchedRows + nextCounts.matchedRows,
      unresolvedRows:
        importDoc.unresolvedRows - previousCounts.unresolvedRows + nextCounts.unresolvedRows,
      ambiguousRows:
        importDoc.ambiguousRows - previousCounts.ambiguousRows + nextCounts.ambiguousRows,
      skippedRows: importDoc.skippedRows - previousCounts.skippedRows + nextCounts.skippedRows,
    };

    if (skip) {
      await ctx.db.patch(rowId, {
        matchStatus: "skipped",
        applyState: "skipped",
        matchedDrugId: undefined,
        matchedCompanyId: undefined,
        matchExplanation: "Skipped by reviewer.",
        updatedAt: now,
      });
      await ctx.db.patch(row.importId, {
        ...nextSummary,
        status: deriveImportStatusFromDoc({
          totalRows: importDoc.totalRows,
          appliedRows: importDoc.appliedRows,
          matchedRows: nextSummary.matchedRows,
          unresolvedRows: nextSummary.unresolvedRows,
        }),
        updatedAt: now,
      });
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
      await ctx.db.patch(row.importId, {
        ...nextSummary,
        status: deriveImportStatusFromDoc({
          totalRows: importDoc.totalRows,
          appliedRows: importDoc.appliedRows,
          matchedRows: nextSummary.matchedRows,
          unresolvedRows: nextSummary.unresolvedRows,
        }),
        updatedAt: now,
      });
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
    await ctx.db.patch(row.importId, {
      ...nextSummary,
      status: deriveImportStatusFromDoc({
        totalRows: importDoc.totalRows,
        appliedRows: importDoc.appliedRows,
        matchedRows: nextSummary.matchedRows,
        unresolvedRows: nextSummary.unresolvedRows,
      }),
      updatedAt: now,
    });
  },
});

export const requestApply = mutation({
  args: { importId: v.id("registrationImports") },
  handler: async (ctx, { importId }) => {
    const importDoc = await ctx.db.get(importId);
    if (!importDoc) throw new Error("Import not found.");

    const pendingMatchedRows = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import_and_match_status_and_apply_state", (q) =>
        q.eq("importId", importId).eq("matchStatus", "matched").eq("applyState", "pending")
      )
      .take(1);
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

export const clearImportRowsBatch = internalMutation({
  args: {
    importId: v.id("registrationImports"),
    resetSummary: v.optional(v.boolean()),
  },
  handler: async (ctx, { importId, resetSummary }) => {
    const rows = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import", (q) => q.eq("importId", importId))
      .take(128);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    if (resetSummary) {
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
    }

    return { deletedCount: rows.length, done: rows.length < 128 };
  },
});

export const getCanonicalProductIdsForDrugs = internalQuery({
  args: { drugIds: v.array(v.id("drugs")) },
  handler: async (ctx, { drugIds }) => {
    const canonicalIds = new Set<Id<"canonicalProducts">>();
    for (const drugId of drugIds) {
      const drug = await ctx.db.get(drugId);
      if (drug?.canonicalProductId) {
        canonicalIds.add(drug.canonicalProductId);
      }
    }
    return [...canonicalIds];
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

export const setImportSourceType = internalMutation({
  args: {
    importId: v.id("registrationImports"),
    sourceType: v.string(),
  },
  handler: async (ctx, { importId, sourceType }) => {
    await ctx.db.patch(importId, {
      sourceType,
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
        sourceSystem:
          importDoc.sourceType === "mohap_uae_complete_product_list" ||
          importDoc.sourceType === "uae_official_directory"
            ? ("mohap_uae" as const)
            : undefined,
        sourceTitle:
          importDoc.sourceType === "mohap_uae_complete_product_list"
            ? "MOHAP UAE complete product list"
            : importDoc.fileName,
        sourceRecordId: row.sourceRecordId,
        observedAt: now,
        strength: row.strength,
        form: row.form,
        packSize: row.packSize,
        notes: [
          row.source,
          row.supplierName,
          row.sourceStatus ? `Status: ${row.sourceStatus}` : undefined,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      };

      const existingIndex = drugState.registrations.findIndex((registration) => {
        if (row.sourceRecordId && registration.sourceRecordId) {
          return registration.sourceRecordId === row.sourceRecordId;
        }
        return (
          registration.country === row.country &&
          registration.registrationNumber === row.registrationNumber &&
          registration.strength === row.strength &&
          registration.form === row.form &&
          registration.packSize === row.packSize
        );
      });
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
      const registeredCountries = new Set(
        state.registrations
          .filter((registration) => registration.status === "registered")
          .map((registration) => registration.country)
      );
      await ctx.db.patch(drugId, {
        menaRegistrations: state.registrations,
        menaRegistrationCount: registeredCountries.size,
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
          ? `${row.productName} is listed as registered in UAE${row.sourceRecordId ? ` (MOHAP ${row.sourceRecordId})` : ""}.`
          : `${row.productName} appears in UAE import with status ${row.registrationStatus}${row.sourceRecordId ? ` (MOHAP ${row.sourceRecordId})` : ""}.`;
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
                title:
                  importDoc.sourceType === "mohap_uae_complete_product_list"
                    ? "MOHAP UAE complete product list"
                    : importDoc.fileName,
                url: undefined,
                sourceType: "official_registry",
                confidence: "confirmed",
                sourceSystem: "mohap_uae",
                sourceCategory: "official",
                observedAt: now,
                notes: [row.source, row.supplierName, row.supplierAddress]
                  .filter(Boolean)
                  .join(" · ") || undefined,
                sourceRecordId: row.sourceRecordId,
              },
            ],
      });

      if (row.priceAed && row.registrationStatus === "registered") {
        const numericPrice = Number(String(row.priceAed).replace(/[^0-9.]/g, ""));
        if (Number.isFinite(numericPrice)) {
          const existingPriceRows = await ctx.db
            .query("priceEvidence")
            .withIndex("by_drug_and_country", (q) =>
              q.eq("drugId", row.matchedDrugId!).eq("country", row.country)
            )
            .collect();
          const existingPrice = existingPriceRows.find((priceRow) =>
            row.sourceRecordId
              ? priceRow.sourceRecordId === row.sourceRecordId
              : priceRow.sourceTitle === `${importDoc.fileName} · UAE official directory`
          );
          await ctx.runMutation(api.opportunities.upsertPriceEvidence, {
            id: existingPrice?._id,
            drugId: row.matchedDrugId,
            country: row.country,
            sourceCategory: "official",
            sourceSystem: "mohap_uae",
            priceType: "registered",
            amount: numericPrice,
            currency: "AED",
            presentation:
              [row.productName, row.strength, row.form, row.packSize]
                .filter(Boolean)
                .join(" · ") || undefined,
            unitBasis: row.packSize || undefined,
            observedAt: now,
            sourceTitle:
              importDoc.sourceType === "mohap_uae_complete_product_list"
                ? "MOHAP UAE complete product list"
                : `${importDoc.fileName} · UAE official directory`,
            sourceUrl: undefined,
            sourceRecordId: row.sourceRecordId,
            confidence: "confirmed",
            notes:
              [
                row.dispensingMode,
                row.classification,
                row.sourceRecordId ? `MOHAP Source ID ${row.sourceRecordId}` : undefined,
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
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
