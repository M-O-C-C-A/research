"use node";

import * as XLSX from "xlsx";
import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const EMA_SME_BASE_URL = "https://fmapps.ema.europa.eu/SME/reg_companies.php";

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractPageCount(html: string) {
  const match = html.match(/Page\s+\d+\s+of\s+(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function extractCompaniesFromPage(html: string) {
  const rows = [
    ...html.matchAll(/<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi),
  ];
  return rows
    .map((match) => ({
      name: decodeHtml(match[1].replace(/<[^>]+>/g, "")),
      country: decodeHtml(match[2].replace(/<[^>]+>/g, "")),
    }))
    .filter((row) => row.name && row.country);
}

async function fetchEmaPage(page: number) {
  const url = page <= 1 ? EMA_SME_BASE_URL : `${EMA_SME_BASE_URL}?RegisteredCo_page=${page}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`EMA SME page ${page} returned ${response.status}.`);
  }
  return {
    url,
    html: await response.text(),
  };
}

const POST_IMPORT_ENRICH_LIMIT = 3;

async function enrichImportedCompanies(
  ctx: ActionCtx,
  companyIds: Id<"companies">[],
  limit = POST_IMPORT_ENRICH_LIMIT
) {
  const uniqueIds = [...new Set(companyIds)];
  const selected: Id<"companies">[] = [];

  for (const companyId of uniqueIds) {
    if (selected.length >= limit) break;
    const company = await ctx.runQuery(api.companies.get, { id: companyId });
    if (!company || company.researchedAt) continue;
    selected.push(companyId);
  }

  const enrichedCompanyIds: Id<"companies">[] = [];
  const failedCompanyIds: Id<"companies">[] = [];

  for (const companyId of selected) {
    try {
      await ctx.runAction(api.discovery.findDrugsForCompany, { companyId });
      await ctx.runAction(api.research.buildProspectDossier, { companyId });
      enrichedCompanyIds.push(companyId);
    } catch {
      failedCompanyIds.push(companyId);
    }
  }

  return {
    attemptedCount: selected.length,
    enrichedCount: enrichedCompanyIds.length,
    failedCount: failedCompanyIds.length,
    enrichedCompanyIds,
    failedCompanyIds,
  };
}

export const importEmaSmeCompanies = action({
  args: {
    limitPages: v.optional(v.number()),
  },
  handler: async (ctx, { limitPages }) => {
    const firstPage = await fetchEmaPage(1);
    const pageCount = extractPageCount(firstPage.html);
    const maxPages =
      limitPages && limitPages > 0 ? Math.min(limitPages, pageCount) : pageCount;

    const allRows: Array<{ name: string; country: string; sourceUrl: string }> = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const current =
        page === 1
          ? firstPage
          : await fetchEmaPage(page);
      const rows = extractCompaniesFromPage(current.html).map((row) => ({
        ...row,
        sourceUrl: current.url,
      }));
      allRows.push(...rows);
    }

    const uniqueRows = allRows.filter((row, index, rows) => {
      const key = `${row.name.toLowerCase()}::${row.country.toLowerCase()}`;
      return rows.findIndex(
        (candidate) =>
          `${candidate.name.toLowerCase()}::${candidate.country.toLowerCase()}` === key
      ) === index;
    });

    let createdCount = 0;
    let updatedCount = 0;
    const createdIds: Id<"companies">[] = [];
    const updatedIds: Id<"companies">[] = [];
    for (let index = 0; index < uniqueRows.length; index += 100) {
      const batch = uniqueRows.slice(index, index + 100);
      const result: {
        createdCount: number;
        updatedCount: number;
        createdIds: Id<"companies">[];
        updatedIds: Id<"companies">[];
        totalProcessed: number;
      } = await ctx.runMutation(internal.companies.importEmaSmeBatch, { rows: batch });
      createdCount += result.createdCount;
      updatedCount += result.updatedCount;
      createdIds.push(...result.createdIds);
      updatedIds.push(...result.updatedIds);
    }

    const enrichment = await enrichImportedCompanies(ctx, [...createdIds, ...updatedIds]);

    return {
      pageCount: maxPages,
      totalFound: uniqueRows.length,
      createdCount,
      updatedCount,
      enrichment,
      sourceUrl: EMA_SME_BASE_URL,
    };
  },
});

function toStringCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseStarterPackWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const results: Array<{
    name: string;
    country: string;
    source: string;
    sourceUrl: string;
    description?: string;
    bdNotes?: string;
    companySize?: "sme" | "mid" | "large";
  }> = [];

  const euSheet = workbook.Sheets["EU_Starter_200"];
  if (euSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(euSheet, {
      defval: "",
      raw: false,
    });
    for (const row of rows) {
      const name = toStringCell(row["Company name"]);
      const country = toStringCell(row["Country"]);
      const source = toStringCell(row["Source"]) || "EMA Registered Companies";
      const sourceUrl = toStringCell(row["Source URL"]) || EMA_SME_BASE_URL;
      if (!name || !country) continue;
      results.push({
        name,
        country,
        source,
        sourceUrl,
        description: "Imported from the pharma directory starter pack (EU starter roster).",
        bdNotes: "Starter-pack company imported from EU roster for product whitespace review.",
        companySize: "sme",
      });
    }
  }

  const usSheet = workbook.Sheets["US_Applicants_Top100"];
  if (usSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(usSheet, {
      defval: "",
      raw: false,
    });
    for (const row of rows) {
      const name = toStringCell(row["Sponsor / applicant holder"]);
      const sourceUrl = toStringCell(row["Source URL"]);
      const applicationCount = toStringCell(row["Application count"]);
      if (!name) continue;
      results.push({
        name,
        country: "United States",
        source: "FDA Drugs@FDA applicant summary",
        sourceUrl:
          sourceUrl || "https://api.fda.gov/drug/drugsfda.json?count=sponsor_name",
        description:
          "Imported from the pharma directory starter pack (top US applicant holders).",
        bdNotes: applicationCount
          ? `Starter-pack company imported from US applicant roster (${applicationCount} applications).`
          : "Starter-pack company imported from US applicant roster for product whitespace review.",
        companySize: "large",
      });
    }
  }

  return results.filter(
    (row, index, rows) =>
      rows.findIndex(
        (candidate) =>
          `${candidate.name.toLowerCase()}::${candidate.country.toLowerCase()}` ===
          `${row.name.toLowerCase()}::${row.country.toLowerCase()}`
      ) === index
  );
}

export const importPharmaDirectoryStarterPack = action({
  args: {
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, { storageId }) => {
    const blob = await ctx.storage.get(storageId as Id<"_storage">);
    if (!blob) throw new Error("Starter pack workbook could not be loaded from storage.");

    const workbookBuffer = Buffer.from(await blob.arrayBuffer());
    const rows = parseStarterPackWorkbook(workbookBuffer);
    if (rows.length === 0) {
      throw new Error("No importable company rows were found in the starter pack.");
    }

    let createdCount = 0;
    let updatedCount = 0;
    const createdIds: Id<"companies">[] = [];
    const updatedIds: Id<"companies">[] = [];
    for (let index = 0; index < rows.length; index += 100) {
      const batch = rows.slice(index, index + 100);
      const result: {
        createdCount: number;
        updatedCount: number;
        createdIds: Id<"companies">[];
        updatedIds: Id<"companies">[];
        totalProcessed: number;
      } = await ctx.runMutation(internal.companies.importStarterDirectoryBatch, { rows: batch });
      createdCount += result.createdCount;
      updatedCount += result.updatedCount;
      createdIds.push(...result.createdIds);
      updatedIds.push(...result.updatedIds);
    }

    const enrichment = await enrichImportedCompanies(ctx, [...createdIds, ...updatedIds]);

    return {
      totalFound: rows.length,
      createdCount,
      updatedCount,
      enrichment,
    };
  },
});
