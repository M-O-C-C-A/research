"use node";

import JSZip from "jszip";
import * as XLSX from "xlsx";
import { action, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  buildCanonicalKey,
  CanonicalEntityDraft,
  compactString,
  dedupeStrings,
  inferLinkRelationship,
  mapApplicationType,
  mapProductType,
  mapSourceStatus,
  mergeCanonicalSummary,
  normalizeText,
  NormalizedSourceProductInput,
  parseDateString,
  toCanonicalEntities,
} from "./productIntelligenceHelpers";
import { Doc, Id } from "./_generated/dataModel";

type JobType =
  | "product_sync_fda"
  | "product_sync_ema"
  | "product_sync_bfarm"
  | "canonical_product_linking";

type ProductActionCtx = ActionCtx;
type ProductSourceRow = Doc<"productSources">;
type ProductSnapshot = {
  canonicalKey: string;
  normalizedBrandName?: string;
  normalizedInn?: string;
  brandName: string;
  inn: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  atcCode?: string;
  therapeuticArea?: string;
  applicationTypes?: Array<"NDA" | "ANDA" | "BLA" | "CAP" | "national">;
  applicationTypeSummary?: string;
  status: "active" | "withdrawn" | "discontinued" | "under_review" | "unavailable";
  productType: "small_molecule" | "biologic" | "biosimilar" | "generic" | "unknown";
  geographies: string[];
  primaryManufacturerName?: string;
  primaryMahName?: string;
  primaryApplicantName?: string;
  approvalDate?: string;
  sourceSystems: Array<
    | "drugs_fda"
    | "openfda_label"
    | "orange_book"
    | "purple_book"
    | "ndc"
    | "ema_central"
    | "eu_national_bfarm"
  >;
  matchConfidence: "confirmed" | "likely" | "inferred";
  reviewNeeded?: boolean;
  referenceCanonicalKey?: string;
};
type SourceLinkSnapshot = {
  canonicalKey: string;
  productSourceId: Id<"productSources">;
  relationshipType: "same_product" | "presentation_variant" | "biosimilar_of" | "reference_product" | "regional_variant";
  confidence: "confirmed" | "likely" | "inferred";
  reviewNeeded?: boolean;
};
type DrugLinkSnapshot = {
  drugId: Id<"drugs">;
  canonicalKey?: string;
};

const SOURCE_PAGE_SIZE = 250;
const COMPANY_PAGE_SIZE = 250;
const DRUG_PAGE_SIZE = 250;
const DELETE_BATCH_SIZE = 100;
const INSERT_BATCH_SIZE = 100;
const PATCH_BATCH_SIZE = 100;

function escapeOpenFdaTerm(value: string) {
  return value.replace(/"/g, '\\"');
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function buildOpenFdaSearch(searchTerm?: string) {
  if (!searchTerm?.trim()) return [];
  const escaped = escapeOpenFdaTerm(searchTerm.trim());
  return [
    `products.brand_name:"${escaped}"`,
    `products.active_ingredients.name:"${escaped}"`,
    `sponsor_name:"${escaped}"`,
  ];
}

async function createJob(
  ctx: ProductActionCtx,
  type: JobType
) {
  return await ctx.runMutation(api.discoveryJobs.create, { type });
}

async function appendJobLog(
  ctx: ProductActionCtx,
  jobId: Id<"discoveryJobs">,
  message: string,
  level: "info" | "success" | "warning" | "error" = "info"
) {
  await ctx.runMutation(api.discoveryJobs.appendLog, { id: jobId, message, level });
}

async function completeJob(
  ctx: ProductActionCtx,
  jobId: Id<"discoveryJobs">,
  newItemsFound: number,
  skippedDuplicates: number,
  summary: string
) {
  await ctx.runMutation(api.discoveryJobs.complete, {
    id: jobId,
    newItemsFound,
    skippedDuplicates,
    summary,
  });
}

async function failJob(
  ctx: ProductActionCtx,
  jobId: Id<"discoveryJobs">,
  errorMessage: string
) {
  await ctx.runMutation(api.discoveryJobs.fail, {
    id: jobId,
    errorMessage,
  });
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return await response.text();
}

async function fetchBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function getLatestPurpleBookDownloadUrl(downloadPageHtml: string) {
  const matches = [...downloadPageHtml.matchAll(/https:\/\/www\.accessdata\.fda\.gov\/drugsatfda_docs\/PurpleBook\/[^\s"'<>]+\.csv/gi)];
  if (matches.length === 0) {
    throw new Error("Purple Book CSV download not found");
  }
  return matches[matches.length - 1][0];
}

function parseDelimitedText(buffer: Buffer) {
  const text = buffer.toString("utf8").replace(/\r/g, "");
  const [headerLine, ...lines] = text.split("\n").filter(Boolean);
  const headers = headerLine.split("~").map((column) => column.trim());
  return lines.map((line) => {
    const cells = line.split("~");
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index]?.trim() ?? "";
      return acc;
    }, {});
  });
}

function parseWorkbookRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
}

function findRowValue(row: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const key = entries.find(([entryKey]) => normalizeText(entryKey) === normalizeText(candidate));
    if (!key) continue;
    return compactString(String(key[1]));
  }
  return undefined;
}

function mapEmaStatus(value?: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("withdrawn") || normalized.includes("refused")) return "withdrawn";
  if (normalized.includes("under evaluation")) return "under_review";
  return "active";
}

function mapEmaProductType(value?: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("biosimilar")) return "biosimilar";
  if (normalized.includes("generic")) return "generic";
  if (normalized.includes("advanced therapy")) return "biologic";
  return "unknown";
}

function mapAtcToTherapeuticArea(atcCode?: string) {
  const prefix = atcCode?.trim().charAt(0).toUpperCase();
  switch (prefix) {
    case "L":
      return "Oncology";
    case "C":
      return "Cardiology";
    case "R":
      return "Respiratory";
    case "A":
      return "Gastroenterology";
    case "N":
      return "Neurology";
    case "J":
      return "Infectious Disease";
    case "B":
      return "Hematology";
    case "H":
      return "Endocrinology";
    default:
      return undefined;
  }
}

async function getOrangeBookMaps() {
  const orangeBookPage = await fetchText(
    "https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files"
  );
  const downloadMatch = orangeBookPage.match(/href="(\/media\/\d+\/download\?attachment)"/i);
  if (!downloadMatch) {
    throw new Error("Orange Book download link not found on FDA page.");
  }
  const zipBuffer = await fetchBuffer(`https://www.fda.gov${downloadMatch[1]}`);
  const zip = await JSZip.loadAsync(zipBuffer);
  const productsFile = zip.file(/Products\.txt$/i)[0];
  const patentsFile = zip.file(/Patent\.txt$/i)[0];
  const exclusivitiesFile = zip.file(/Exclusivity\.txt$/i)[0];
  if (!productsFile || !patentsFile || !exclusivitiesFile) {
    throw new Error("Orange Book files were not found in the downloaded ZIP");
  }

  const [productsRows, patentRows, exclusivityRows] = await Promise.all([
    productsFile.async("nodebuffer").then(parseDelimitedText),
    patentsFile.async("nodebuffer").then(parseDelimitedText),
    exclusivitiesFile.async("nodebuffer").then(parseDelimitedText),
  ]);

  const patentsByApplication = new Map<string, string[]>();
  for (const row of patentRows) {
    const applicationNumber = compactString(row.Appl_No);
    const patentNumber = compactString(row.Patent_No);
    if (!applicationNumber || !patentNumber) continue;
    const existing = patentsByApplication.get(applicationNumber) ?? [];
    existing.push(patentNumber);
    patentsByApplication.set(applicationNumber, existing);
  }

  const exclusivitiesByApplication = new Map<string, string[]>();
  for (const row of exclusivityRows) {
    const applicationNumber = compactString(row.Appl_No);
    const exclusivityCode = compactString(row.Exclusivity_Code);
    if (!applicationNumber || !exclusivityCode) continue;
    const existing = exclusivitiesByApplication.get(applicationNumber) ?? [];
    existing.push(exclusivityCode);
    exclusivitiesByApplication.set(applicationNumber, existing);
  }

  const productsByApplication = new Map<string, Record<string, string>[]>();
  for (const row of productsRows) {
    const applicationNumber = compactString(row.Appl_No);
    if (!applicationNumber) continue;
    const existing = productsByApplication.get(applicationNumber) ?? [];
    existing.push(row);
    productsByApplication.set(applicationNumber, existing);
  }

  return {
    productsByApplication,
    patentsByApplication,
    exclusivitiesByApplication,
  };
}

async function getPurpleBookRows() {
  const downloadPageHtml = await fetchText("https://purplebooksearch.fda.gov/index.cfm?event=downloads");
  const latestCsvUrl = getLatestPurpleBookDownloadUrl(downloadPageHtml);
  const csvBuffer = await fetchBuffer(latestCsvUrl);
  return parseWorkbookRows(csvBuffer);
}

async function getEmaRows() {
  const payload = await fetchJson<
    Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> }
  >(
    "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json"
  );
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  throw new Error("EMA medicine feed returned an unexpected JSON shape.");
}

function normalizedSnapshot(source: NormalizedSourceProductInput) {
  return JSON.stringify({
    brandName: source.brandName,
    inn: source.inn,
    activeIngredient: source.activeIngredient,
    strength: source.strength,
    dosageForm: source.dosageForm,
    route: source.route,
    atcCode: source.atcCode,
    therapeuticArea: source.therapeuticArea,
    applicationType: source.applicationType,
    applicantName: source.applicantName,
    mahName: source.mahName,
    manufacturerName: source.manufacturerName,
    approvalDate: source.approvalDate,
    productType: source.productType,
    referenceProductSourceRecordId: source.referenceProductSourceRecordId,
    patentsSummary: source.patentsSummary,
    exclusivitiesSummary: source.exclusivitiesSummary,
    packageSummary: source.packageSummary,
    interchangeability: source.interchangeability,
  });
}

async function rebuildCanonicalGraph(
  ctx: ProductActionCtx,
  jobId: Id<"discoveryJobs">
) {
  await appendJobLog(ctx, jobId, "Loading source products and existing companies...");
  const sourceRows: ProductSourceRow[] = [];
  let sourceCursor: string | null = null;
  while (true) {
    const result: {
      page: ProductSourceRow[];
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(internal.productIntelligence.listProductSourcesPage, {
      paginationOpts: {
        cursor: sourceCursor,
        numItems: SOURCE_PAGE_SIZE,
      },
    });
    sourceRows.push(...result.page);
    if (result.isDone) break;
    sourceCursor = result.continueCursor;
  }

  const companies: Array<{ _id: Id<"companies">; name: string }> = [];
  let companyCursor: string | null = null;
  while (true) {
    const result: {
      page: Array<{ _id: Id<"companies">; name: string }>;
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(internal.companies.listProductIntelligencePage, {
      paginationOpts: {
        cursor: companyCursor,
        numItems: COMPANY_PAGE_SIZE,
      },
    });
    companies.push(...result.page);
    if (result.isDone) break;
    companyCursor = result.continueCursor;
  }

  const drugs: Array<{
    _id: Id<"drugs">;
    name: string;
    genericName: string;
    canonicalProductId?: Id<"canonicalProducts">;
  }> = [];
  let drugCursor: string | null = null;
  while (true) {
    const result: {
      page: Array<{
        _id: Id<"drugs">;
        name: string;
        genericName: string;
        canonicalProductId?: Id<"canonicalProducts">;
      }>;
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(internal.drugs.listProductIntelligencePage, {
      paginationOpts: {
        cursor: drugCursor,
        numItems: DRUG_PAGE_SIZE,
      },
    });
    drugs.push(...result.page);
    if (result.isDone) break;
    drugCursor = result.continueCursor;
  }

  const companyIdByName = new Map<string, Id<"companies">>();
  for (const company of companies) {
    companyIdByName.set(normalizeText(company.name), company._id);
  }

  const grouped = new Map<string, NormalizedSourceProductInput[]>();
  for (const source of sourceRows) {
    const key = buildCanonicalKey({
      inn: source.inn,
      brandName: source.brandName,
      strength: source.strength,
      dosageForm: source.dosageForm,
      route: source.route,
      productType: source.productType,
    });
    const current = grouped.get(key) ?? [];
    current.push({
      sourceSystem: source.sourceSystem,
      sourceRecordId: source.sourceRecordId,
      sourceUrl: source.sourceUrl,
      sourceStatus: source.sourceStatus,
      geography: source.geography,
      sourceUpdatedAt: source.sourceUpdatedAt,
      sourceSnapshot: source.sourceSnapshot,
      brandName: source.brandName,
      inn: source.inn,
      activeIngredient: source.activeIngredient,
      strength: source.strength,
      dosageForm: source.dosageForm,
      route: source.route,
      atcCode: source.atcCode,
      therapeuticArea: source.therapeuticArea,
      applicationType: source.applicationType,
      applicantName: source.applicantName,
      mahName: source.mahName,
      manufacturerName: source.manufacturerName,
      approvalDate: source.approvalDate,
      productType: source.productType,
      referenceProductSourceRecordId: source.referenceProductSourceRecordId,
      patentsSummary: source.patentsSummary,
      exclusivitiesSummary: source.exclusivitiesSummary,
      packageSummary: source.packageSummary,
      interchangeability: source.interchangeability,
      rawSourceUpdatedLabel: source.rawSourceUpdatedLabel,
    });
    grouped.set(key, current);
  }

  const sourceIdBySystemAndRecord = new Map<string, Id<"productSources">>();
  const sourceRowBySystemAndRecord = new Map<string, ProductSourceRow>();
  for (const source of sourceRows) {
    const key = `${source.sourceSystem}:${source.sourceRecordId}`;
    sourceIdBySystemAndRecord.set(key, source._id);
    sourceRowBySystemAndRecord.set(key, source);
  }

  const sourceKeyBySystemAndRecord = new Map<string, string>();
  for (const [canonicalKey, items] of grouped.entries()) {
    for (const item of items) {
      sourceKeyBySystemAndRecord.set(`${item.sourceSystem}:${item.sourceRecordId}`, canonicalKey);
    }
  }

  const sourceKeyByNormalizedName = new Map<string, string>();
  for (const source of sourceRows) {
    const candidateName = source.brandName ?? source.inn ?? source.activeIngredient ?? "";
    const normalizedName = normalizeText(candidateName);
    const canonicalKey = sourceKeyBySystemAndRecord.get(
      `${source.sourceSystem}:${source.sourceRecordId}`
    );
    if (!normalizedName || !canonicalKey || sourceKeyByNormalizedName.has(normalizedName)) continue;
    sourceKeyByNormalizedName.set(normalizedName, canonicalKey);
  }

  const products: ProductSnapshot[] = [];
  const sourceLinks: SourceLinkSnapshot[] = [];
  const entities: Array<CanonicalEntityDraft & { canonicalKey: string }> = [];

  for (const [canonicalKey, items] of grouped.entries()) {
    const sourceDocs = items
      .map((item) => sourceRowBySystemAndRecord.get(`${item.sourceSystem}:${item.sourceRecordId}`))
      .filter((source): source is ProductSourceRow => !!source);
    const entityDrafts = dedupeEntityDrafts(
      items.flatMap((item) => toCanonicalEntities(item, companyIdByName))
    );
    const summary = mergeCanonicalSummary(sourceDocs, entityDrafts);

    const referenceCanonicalKey = items
      .map((item) => {
        const direct = item.referenceProductSourceRecordId
          ? sourceKeyBySystemAndRecord.get(
              `${item.sourceSystem}:${item.referenceProductSourceRecordId}`
            )
          : undefined;
        if (direct) return direct;
        return item.referenceProductSourceRecordId
          ? sourceKeyByNormalizedName.get(normalizeText(item.referenceProductSourceRecordId))
          : undefined;
      })
      .find(Boolean);

    products.push({
      ...summary,
      canonicalKey,
      referenceCanonicalKey,
    });

    for (const item of items) {
      const sourceId = sourceIdBySystemAndRecord.get(`${item.sourceSystem}:${item.sourceRecordId}`);
      if (!sourceId) continue;
      sourceLinks.push({
        canonicalKey,
        productSourceId: sourceId,
        relationshipType: inferLinkRelationship(item),
        confidence: summary.matchConfidence,
        reviewNeeded: summary.reviewNeeded,
      });
    }

    for (const entity of entityDrafts) {
      entities.push({
        ...entity,
        canonicalKey,
      });
    }
  }

  const drugLinks: DrugLinkSnapshot[] = drugs.map((drug) => {
    const exactByBrand = [...grouped.keys()].find((key) =>
      key.startsWith(`${normalizeText(drug.genericName) || normalizeText(drug.name)}|`)
    );
    const brandMatch = products.find(
      (product) => product.normalizedBrandName === normalizeText(drug.name)
    );
    const innMatch = products.find(
      (product) => product.normalizedInn === normalizeText(drug.genericName)
    );
    return {
      drugId: drug._id,
      canonicalKey:
        brandMatch?.canonicalKey ??
        exactByBrand ??
        innMatch?.canonicalKey,
    };
  });

  await appendJobLog(
    ctx,
    jobId,
    `Rebuilding ${products.length} canonical products from ${sourceRows.length} source rows...`
  );
  await appendJobLog(ctx, jobId, "Clearing previous canonical graph in batches...");
  for (const table of [
    "canonicalProductLinks",
    "canonicalProductEntities",
    "canonicalProducts",
  ] as const) {
    let deleted = 0;
    while (true) {
      const result: { deleted: number; done: boolean } = await ctx.runMutation(
        internal.productIntelligence.clearCanonicalGraphBatch,
        {
          table,
          limit: DELETE_BATCH_SIZE,
        }
      );
      deleted += result.deleted;
      if (result.done) break;
    }
    if (deleted > 0) {
      await appendJobLog(ctx, jobId, `Cleared ${deleted} rows from ${table}.`);
    }
  }

  const canonicalIdByKey = new Map<string, Id<"canonicalProducts">>();
  const productInsertRows = products.map((product) => ({
    canonicalKey: product.canonicalKey,
    normalizedBrandName: product.normalizedBrandName,
    normalizedInn: product.normalizedInn,
    brandName: product.brandName,
    inn: product.inn,
    activeIngredient: product.activeIngredient,
    strength: product.strength,
    dosageForm: product.dosageForm,
    route: product.route,
    atcCode: product.atcCode,
    therapeuticArea: product.therapeuticArea,
    applicationTypes: product.applicationTypes,
    applicationTypeSummary: product.applicationTypeSummary,
    status: product.status,
    productType: product.productType,
    geographies: product.geographies,
    primaryManufacturerName: product.primaryManufacturerName,
    primaryMahName: product.primaryMahName,
    primaryApplicantName: product.primaryApplicantName,
    approvalDate: product.approvalDate,
    sourceSystems: product.sourceSystems,
    matchConfidence: product.matchConfidence,
    reviewNeeded: product.reviewNeeded,
  }));
  for (const [index, batch] of chunk(productInsertRows, INSERT_BATCH_SIZE).entries()) {
    const inserted: Array<{
      canonicalKey: string;
      canonicalProductId: Id<"canonicalProducts">;
    }> = await ctx.runMutation(internal.productIntelligence.insertCanonicalProductsBatch, {
      products: batch,
    });
    for (const row of inserted) {
      canonicalIdByKey.set(row.canonicalKey, row.canonicalProductId);
    }
    await appendJobLog(
      ctx,
      jobId,
      `Inserted canonical product batch ${index + 1}/${Math.max(1, Math.ceil(products.length / INSERT_BATCH_SIZE))}.`
    );
  }

  const referencePatches = products
    .filter((product) => !!product.referenceCanonicalKey)
    .flatMap((product) => {
      const canonicalProductId = canonicalIdByKey.get(product.canonicalKey);
      const referenceCanonicalProductId = product.referenceCanonicalKey
        ? canonicalIdByKey.get(product.referenceCanonicalKey)
        : undefined;
      if (!canonicalProductId || !referenceCanonicalProductId) return [];
      return [{ canonicalProductId, referenceCanonicalProductId }];
    });
  for (const batch of chunk(referencePatches, PATCH_BATCH_SIZE)) {
    await ctx.runMutation(internal.productIntelligence.patchCanonicalProductReferencesBatch, {
      references: batch,
    });
  }

  const resolvedSourceLinks = sourceLinks.flatMap((link) => {
    const canonicalProductId = canonicalIdByKey.get(link.canonicalKey);
    if (!canonicalProductId) return [];
    return [{ ...link, canonicalProductId }];
  });
  const sourceLinkInsertRows = resolvedSourceLinks.map((link) => ({
    canonicalProductId: link.canonicalProductId,
    productSourceId: link.productSourceId,
    relationshipType: link.relationshipType,
    confidence: link.confidence,
    reviewNeeded: link.reviewNeeded,
  }));
  for (const batch of chunk(sourceLinkInsertRows, INSERT_BATCH_SIZE)) {
    await ctx.runMutation(internal.productIntelligence.insertCanonicalSourceLinksBatch, {
      sourceLinks: batch,
    });
  }

  const resolvedEntities = entities.flatMap((entity) => {
    const canonicalProductId = canonicalIdByKey.get(entity.canonicalKey);
    if (!canonicalProductId) return [];
    return [{ ...entity, canonicalProductId }];
  });
  const entityInsertRows = resolvedEntities.map((entity) => ({
    canonicalProductId: entity.canonicalProductId,
    companyId: entity.companyId,
    entityName: entity.entityName,
    normalizedEntityName: entity.normalizedEntityName,
    role: entity.role,
    isPrimary: entity.isPrimary,
    geography: entity.geography,
    sourceSystem: entity.sourceSystem,
    confidence: entity.confidence,
  }));
  for (const batch of chunk(entityInsertRows, INSERT_BATCH_SIZE)) {
    await ctx.runMutation(internal.productIntelligence.insertCanonicalEntitiesBatch, {
      entities: batch,
    });
  }

  let drugsLinked = 0;
  const resolvedDrugLinks = drugLinks.map((link) => ({
    drugId: link.drugId,
    canonicalProductId: link.canonicalKey
      ? canonicalIdByKey.get(link.canonicalKey)
      : undefined,
  }));
  for (const batch of chunk(resolvedDrugLinks, PATCH_BATCH_SIZE)) {
    const result: { linked: number; unlinked: number } = await ctx.runMutation(
      internal.productIntelligence.relinkDrugsBatch,
      { drugLinks: batch }
    );
    drugsLinked += result.linked;
  }

  return {
    canonicalProductsCreated: products.length,
    sourceLinksCreated: resolvedSourceLinks.length,
    entitiesCreated: resolvedEntities.length,
    drugsLinked,
  };
}

function dedupeEntityDrafts(drafts: CanonicalEntityDraft[]) {
  const seen = new Set<string>();
  const result: CanonicalEntityDraft[] = [];
  for (const draft of drafts) {
    const key = [
      draft.normalizedEntityName,
      draft.role,
      draft.geography ?? "",
      draft.sourceSystem,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(draft);
  }
  return result;
}

export const rebuildCanonicalProductLinks = action({
  args: {},
  handler: async (ctx) => {
    const jobId = await createJob(ctx, "canonical_product_linking");
    try {
      const result = await rebuildCanonicalGraph(ctx, jobId);
      await completeJob(
        ctx,
        jobId,
        result.canonicalProductsCreated,
        0,
        `Canonical product graph rebuilt from ${result.sourceLinksCreated} source links and ${result.entitiesCreated} entity records.`
      );
      return {
        jobId,
        status: "completed" as const,
        ...result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown rebuild failure";
      await failJob(ctx, jobId, message);
      throw new Error(message);
    }
  },
});

export const syncFdaProducts = action({
  args: {
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchTerm, limit = 25 }) => {
    const jobId = await createJob(ctx, "product_sync_fda");
    try {
      await appendJobLog(ctx, jobId, "Fetching Drugs@FDA records...");
      const queries = buildOpenFdaSearch(searchTerm);
      const dedupedRecords = new Map<string, Record<string, unknown>>();
      if (queries.length === 0) {
        const drugsFdaUrl = new URL("https://api.fda.gov/drug/drugsfda.json");
        drugsFdaUrl.searchParams.set("limit", String(Math.min(limit, 50)));
        const drugsFdaData = await fetchJson<{
          results: Array<Record<string, unknown>>;
        }>(drugsFdaUrl.toString());
        for (const record of drugsFdaData.results ?? []) {
          const key =
            compactString(String(record.application_number ?? "")) ??
            crypto.randomUUID();
          dedupedRecords.set(key, record);
        }
      } else {
        for (const query of queries) {
          const drugsFdaUrl = new URL("https://api.fda.gov/drug/drugsfda.json");
          drugsFdaUrl.searchParams.set("search", query);
          drugsFdaUrl.searchParams.set("limit", String(Math.min(limit, 50)));
          const drugsFdaData = await fetchJson<{
            results: Array<Record<string, unknown>>;
          }>(drugsFdaUrl.toString()).catch(() => ({ results: [] }));
          for (const record of drugsFdaData.results ?? []) {
            const key =
              compactString(String(record.application_number ?? "")) ??
              crypto.randomUUID();
            dedupedRecords.set(key, record);
          }
        }
      }

      let orangeBook = {
        productsByApplication: new Map<string, Record<string, string>[]>(),
        patentsByApplication: new Map<string, string[]>(),
        exclusivitiesByApplication: new Map<string, string[]>(),
      };
      try {
        orangeBook = await getOrangeBookMaps();
      } catch (error) {
        await appendJobLog(
          ctx,
          jobId,
          `Orange Book enrichment unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
          "warning"
        );
      }

      let purpleBookRows: Record<string, unknown>[] = [];
      try {
        purpleBookRows = await getPurpleBookRows();
      } catch (error) {
        await appendJobLog(
          ctx,
          jobId,
          `Purple Book enrichment unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
          "warning"
        );
      }
      let upserted = 0;

      for (const record of dedupedRecords.values()) {
        const applicationNumber = compactString(String(record.application_number ?? ""));
        const sponsorName = compactString(String(record.sponsor_name ?? ""));
        const products = Array.isArray(record.products) ? record.products as Array<Record<string, unknown>> : [];
        const submissions = Array.isArray(record.submissions) ? record.submissions as Array<Record<string, unknown>> : [];
        const originalSubmission = submissions
          .map((submission) => compactString(String(submission.submission_status_date ?? "")))
          .filter(Boolean)
          .sort()[0];

        for (const product of products) {
          const brandName = compactString(String(product.brand_name ?? ""));
          const inn = compactString(String(product.generic_name ?? ""));
          const dosageForm = compactString(String(product.dosage_form ?? ""));
          const route = compactString(String(product.route ?? ""));
          const strength = compactString(String(product.strength ?? ""));
          const orangeProducts = applicationNumber
            ? orangeBook.productsByApplication.get(applicationNumber) ?? []
            : [];
          const orangeProduct = orangeProducts.find((item) => {
            const tradeName = compactString(item.Trade_Name);
            return tradeName && normalizeText(tradeName) === normalizeText(brandName);
          }) ?? orangeProducts[0];
          const purpleRow = purpleBookRows.find((row) => {
            const proprietary = findRowValue(row, ["Proprietary Name", "Proprietary_Name"]);
            const proper = findRowValue(row, ["Proper Name", "Proper_Name", "Nonproprietary Name"]);
            return (
              (!!brandName && normalizeText(proprietary) === normalizeText(brandName)) ||
              (!!inn && normalizeText(proper) === normalizeText(inn))
            );
          });

          const source: NormalizedSourceProductInput = {
            sourceSystem: "drugs_fda",
            sourceRecordId: `${applicationNumber ?? "unknown"}:${compactString(String(product.product_number ?? "")) ?? brandName ?? inn ?? "product"}`,
            sourceUrl: applicationNumber
              ? `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${applicationNumber}`
              : undefined,
            sourceStatus: mapSourceStatus(String(product.marketing_status ?? product.product_type ?? "active")),
            geography: "US",
            sourceUpdatedAt: undefined,
            sourceSnapshot: undefined,
            brandName,
            inn,
            activeIngredient: inn,
            strength: strength ?? compactString(orangeProduct?.Strength),
            dosageForm: dosageForm ?? compactString(orangeProduct?.["Dosage_Form"]),
            route: route ?? compactString(orangeProduct?.Route),
            atcCode: undefined,
            therapeuticArea: undefined,
            applicationType:
              mapApplicationType(compactString(orangeProduct?.Appl_Type)) ??
              mapApplicationType(applicationNumber),
            applicantName: sponsorName,
            mahName: sponsorName,
            manufacturerName: sponsorName,
            approvalDate: parseDateString(originalSubmission) ?? parseDateString(orangeProduct?.Approval_Date),
            productType:
              purpleRow
                ? mapProductType(findRowValue(purpleRow, ["Biosimilar", "Interchangeable", "Product Type"]))
                : mapProductType(String(product.product_type ?? "")),
            referenceProductSourceRecordId: purpleRow
              ? findRowValue(purpleRow, ["Reference Product Proper Name", "Reference Product Proprietary Name"])
              : undefined,
            patentsSummary: applicationNumber
              ? dedupeStrings(orangeBook.patentsByApplication.get(applicationNumber) ?? []).join(", ") || undefined
              : undefined,
            exclusivitiesSummary: applicationNumber
              ? dedupeStrings(orangeBook.exclusivitiesByApplication.get(applicationNumber) ?? []).join(", ") || undefined
              : undefined,
            packageSummary: undefined,
            interchangeability: purpleRow
              ? findRowValue(purpleRow, ["Interchangeable", "Interchangeability"])
              : undefined,
            rawSourceUpdatedLabel: undefined,
          };

          source.sourceSnapshot = normalizedSnapshot(source);
          await ctx.runMutation(api.productIntelligence.upsertProductSource, source);
          upserted += 1;
        }
      }

      if (searchTerm?.trim()) {
        await appendJobLog(ctx, jobId, "Fetching supplemental openFDA label and NDC records...");
        const escaped = escapeOpenFdaTerm(searchTerm.trim());
        const [labelData, ndcData] = await Promise.all([
          fetchJson<{ results: Array<Record<string, unknown>> }>(
            `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${escaped}"&limit=${Math.min(limit, 10)}`
          ).catch(() => ({ results: [] })),
          fetchJson<{ results: Array<Record<string, unknown>> }>(
            `https://api.fda.gov/drug/ndc.json?search=brand_name:"${escaped}"&limit=${Math.min(limit, 10)}`
          ).catch(() => ({ results: [] })),
        ]);

        for (const row of labelData.results ?? []) {
          const openfda = (row.openfda ?? {}) as Record<string, unknown>;
          const source: NormalizedSourceProductInput = {
            sourceSystem: "openfda_label",
            sourceRecordId:
              compactString(String((openfda.spl_set_id as string[] | undefined)?.[0] ?? "")) ??
              compactString(String(row.id ?? "")) ??
              crypto.randomUUID(),
            sourceUrl: compactString(String((row as Record<string, unknown>).set_id ?? "")),
            sourceStatus: "active",
            geography: "US",
            brandName: compactString(String((openfda.brand_name as string[] | undefined)?.[0] ?? "")),
            inn: compactString(String((openfda.generic_name as string[] | undefined)?.[0] ?? "")),
            activeIngredient: compactString(String((openfda.substance_name as string[] | undefined)?.join(", ") ?? "")),
            dosageForm: compactString(String((row.dosage_form as string[] | undefined)?.[0] ?? "")),
            route: compactString(String((openfda.route as string[] | undefined)?.[0] ?? "")),
            manufacturerName: compactString(String((openfda.manufacturer_name as string[] | undefined)?.[0] ?? "")),
            sourceSnapshot: undefined,
          };
          source.sourceSnapshot = normalizedSnapshot(source);
          await ctx.runMutation(api.productIntelligence.upsertProductSource, source);
          upserted += 1;
        }

        for (const row of ndcData.results ?? []) {
          const source: NormalizedSourceProductInput = {
            sourceSystem: "ndc",
            sourceRecordId: compactString(String(row.product_id ?? row.product_ndc ?? "")) ?? crypto.randomUUID(),
            sourceUrl: compactString(String(row.product_ndc ?? "")),
            sourceStatus: mapSourceStatus(String(row.marketing_category ?? "")),
            geography: "US",
            brandName: compactString(String(row.brand_name ?? "")),
            inn: compactString(String(row.generic_name ?? "")),
            activeIngredient: compactString(String(row.generic_name ?? "")),
            strength: compactString(
              Array.isArray(row.active_ingredients)
                ? (row.active_ingredients as Array<Record<string, unknown>>)
                    .map((ingredient) => `${ingredient.name ?? ""} ${ingredient.strength ?? ""}`.trim())
                    .filter(Boolean)
                    .join(", ")
                : ""
            ),
            dosageForm: compactString(String(row.dosage_form ?? "")),
            route: Array.isArray(row.route) ? compactString((row.route as string[]).join(", ")) : compactString(String(row.route ?? "")),
            applicationType: mapApplicationType(String(row.application_number ?? "")),
            applicantName: compactString(String(row.labeler_name ?? "")),
            mahName: compactString(String(row.labeler_name ?? "")),
            manufacturerName: compactString(String(row.labeler_name ?? "")),
            approvalDate: parseDateString(String(row.marketing_start_date ?? "")),
            packageSummary: Array.isArray(row.packaging)
              ? (row.packaging as Array<Record<string, unknown>>)
                  .map((pkg) => compactString(String(pkg.description ?? "")))
                  .filter(Boolean)
                  .join("; ")
              : undefined,
            productType: mapProductType(String(row.product_type ?? "")),
            sourceSnapshot: undefined,
          };
          source.sourceSnapshot = normalizedSnapshot(source);
          await ctx.runMutation(api.productIntelligence.upsertProductSource, source);
          upserted += 1;
        }
      }

      await appendJobLog(ctx, jobId, `Upserted ${upserted} FDA source records. Rebuilding canonical products...`);
      const rebuildResult: {
        jobId: Id<"discoveryJobs">;
      } = await ctx.runAction(api.productIntelligenceActions.rebuildCanonicalProductLinks, {});
      await appendJobLog(
        ctx,
        jobId,
        `Canonical rebuild triggered via job ${rebuildResult.jobId}.`,
        "success"
      );
      await completeJob(
        ctx,
        jobId,
        upserted,
        0,
        `FDA sync complete — ${upserted} source records added or refreshed.`
      );
      return {
        jobId,
        status: "completed" as const,
        upserted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown FDA sync failure";
      await failJob(ctx, jobId, message);
      throw new Error(message);
    }
  },
});

export const syncEmaCentralProducts = action({
  args: {
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchTerm, limit = 50 }) => {
    const jobId = await createJob(ctx, "product_sync_ema");
    try {
      await appendJobLog(ctx, jobId, "Fetching EMA centrally authorised medicine data...");
      const rows = await getEmaRows();
      const filtered = rows
        .filter((row) => normalizeText(String(row.category ?? "")) === "human")
        .filter((row) => {
          if (!searchTerm?.trim()) return true;
          const term = normalizeText(searchTerm);
          const haystack = [
            String(row.name_of_medicine ?? ""),
            String(row.international_non_proprietary_name_common_name ?? ""),
            String(row.active_substance ?? ""),
            String(row.marketing_authorisation_developer_applicant_holder ?? ""),
          ]
            .map(normalizeText)
            .join(" ");
          return haystack.includes(term);
        })
        .slice(0, limit);

      let upserted = 0;
      for (const row of filtered) {
        const source: NormalizedSourceProductInput = {
          sourceSystem: "ema_central",
          sourceRecordId:
            compactString(String(row.ema_product_number ?? "")) ??
            compactString(String(row.name_of_medicine ?? "")) ??
            crypto.randomUUID(),
          sourceUrl: compactString(String(row.medicine_url ?? "")),
          sourceStatus: mapEmaStatus(String(row.medicine_status ?? row.opinion_status ?? "")),
          geography: "EU",
          sourceUpdatedAt: undefined,
          sourceSnapshot: undefined,
          brandName: compactString(String(row.name_of_medicine ?? "")),
          inn: compactString(
            String(
              row.international_non_proprietary_name_common_name ??
                row.active_substance ??
                ""
            )
          ),
          activeIngredient: compactString(String(row.active_substance ?? "")),
          atcCode: compactString(String(row.atc_code_human ?? "")),
          therapeuticArea:
            compactString(String(row.therapeutic_area_mesh ?? "")) ??
            mapAtcToTherapeuticArea(compactString(String(row.atc_code_human ?? ""))),
          applicationType: "CAP",
          applicantName: compactString(
            String(row.marketing_authorisation_developer_applicant_holder ?? "")
          ),
          mahName: compactString(
            String(row.marketing_authorisation_developer_applicant_holder ?? "")
          ),
          manufacturerName: compactString(
            String(row.marketing_authorisation_developer_applicant_holder ?? "")
          ),
          approvalDate: parseDateString(String(row.european_commission_decision_date ?? "")),
          productType: mapEmaProductType(
            [
              row.advanced_therapy,
              row.biosimilar,
              row.generic,
              row["generic or hybrid"],
            ]
              .filter(Boolean)
              .join(" ")
          ),
          rawSourceUpdatedLabel: compactString(String(row.last_updated_date ?? "")),
        };
        source.sourceSnapshot = normalizedSnapshot(source);
        await ctx.runMutation(api.productIntelligence.upsertProductSource, source);
        upserted += 1;
      }

      await appendJobLog(ctx, jobId, `Upserted ${upserted} EMA source records. Rebuilding canonical products...`);
      const rebuildResult: {
        jobId: Id<"discoveryJobs">;
      } = await ctx.runAction(api.productIntelligenceActions.rebuildCanonicalProductLinks, {});
      await appendJobLog(
        ctx,
        jobId,
        `Canonical rebuild triggered via job ${rebuildResult.jobId}.`,
        "success"
      );
      await completeJob(
        ctx,
        jobId,
        upserted,
        0,
        `EMA sync complete — ${upserted} centrally authorised products added or refreshed.`
      );
      return {
        jobId,
        status: "completed" as const,
        upserted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown EMA sync failure";
      await failJob(ctx, jobId, message);
      throw new Error(message);
    }
  },
});

export const syncBfarmProducts = action({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, { searchTerm }) => {
    const jobId = await createJob(ctx, "product_sync_bfarm");
    try {
      await appendJobLog(ctx, jobId, `Checking BfArM AMIce availability for "${searchTerm}"...`);
      const response = await fetch(
        "https://portal.dimdi.de/amguifree/?accessid=amis_off_am_ppv&lang=de"
      );
      if (!response.ok) {
        throw new Error(`BfArM AMIce is currently unavailable (${response.status}).`);
      }

      const source: NormalizedSourceProductInput = {
        sourceSystem: "eu_national_bfarm",
        sourceRecordId: `bfarm-manual-${normalizeText(searchTerm)}`,
        sourceUrl: `https://portal.dimdi.de/amguifree/?accessid=amis_off_am_ppv&lang=de`,
        sourceStatus: "active",
        geography: "Germany",
        brandName: searchTerm,
        inn: searchTerm,
        applicationType: "national",
        sourceSnapshot: normalizedSnapshot({
          sourceSystem: "eu_national_bfarm",
          sourceRecordId: `bfarm-manual-${normalizeText(searchTerm)}`,
          sourceUrl: `https://portal.dimdi.de/amguifree/?accessid=amis_off_am_ppv&lang=de`,
          sourceStatus: "active",
          geography: "Germany",
          brandName: searchTerm,
          inn: searchTerm,
          applicationType: "national",
        }),
      };
      await ctx.runMutation(api.productIntelligence.upsertProductSource, source);
      const rebuildResult: {
        jobId: Id<"discoveryJobs">;
      } = await ctx.runAction(api.productIntelligenceActions.rebuildCanonicalProductLinks, {});
      await appendJobLog(
        ctx,
        jobId,
        `Canonical rebuild triggered via job ${rebuildResult.jobId}.`,
        "success"
      );
      await completeJob(
        ctx,
        jobId,
        1,
        0,
        `BfArM integration pattern executed for "${searchTerm}".`
      );
      return {
        jobId,
        status: "completed" as const,
        upserted: 1,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown BfArM sync failure";
      await failJob(ctx, jobId, message);
      throw new Error(message);
    }
  },
});
