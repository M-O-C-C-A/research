/**
 * Backfill the curated MOHAP product workbook through the standard registration import flow.
 *
 * Usage:
 *   npx tsx scripts/backfill-mohap-product-list.ts
 *   npx tsx scripts/backfill-mohap-product-list.ts --prod
 *   npx tsx scripts/backfill-mohap-product-list.ts --file "/abs/path/workbook.xlsx"
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const DEFAULT_WORKBOOK =
  "/Users/mg/Library/CloudStorage/OneDrive-Personal/M.G Data/Maik/4. Projects/1. KEMEDICA 🧬/Resources/Lists/MOHAP/MOHAP_Complete_Product_List.xlsx";

const isProd = process.argv.includes("--prod");
const fileArgIndex = process.argv.findIndex((arg) => arg === "--file");
const workbookPath: string =
  fileArgIndex >= 0 && process.argv[fileArgIndex + 1]
    ? process.argv[fileArgIndex + 1]
    : DEFAULT_WORKBOOK;

const envFile = isProd ? ".env.production.local" : ".env.local";
dotenv.config({ path: path.join(__dirname, "..", envFile) });

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error(`No Convex URL found in ${envFile} (or CONVEX_URL env var).`);
  process.exit(1);
}

if (!fs.existsSync(workbookPath)) {
  console.error(`Workbook not found: ${workbookPath}`);
  process.exit(1);
}

async function uploadWorkbook(client: ConvexHttpClient, filePath: string) {
  const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
  const fileBuffer = fs.readFileSync(filePath);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type":
        filePath.toLowerCase().endsWith(".xlsx")
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/octet-stream",
    },
    body: new Blob([fileBuffer]),
  });

  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as { storageId: string };
}

async function main() {
  const client = new ConvexHttpClient(convexUrl!);
  console.log(`Target: ${isProd ? "PRODUCTION" : "dev"} — ${convexUrl}`);
  console.log(`Workbook: ${workbookPath}`);

  const upload = await uploadWorkbook(client, workbookPath);
  const fileName = path.basename(workbookPath);
  const importId = await client.mutation(api.registrationImports.createImport, {
    storageId: upload.storageId as never,
    fileName,
    sourceMarket: "UAE",
    sourceType: "mohap_uae_complete_product_list",
  });
  console.log(`Created import ${importId}`);

  const parseResult = await client.action(api.registrationImportActions.parseImport, { importId });
  console.log(
    `Parsed ${parseResult.totalRows} rows across ${parseResult.sheetNames.length} sheet(s); ${parseResult.matchedRows} matched, ${parseResult.unresolvedRows} unresolved.`
  );

  if (parseResult.matchedRows === 0) {
    console.log("No matched rows were found; stopping before apply.");
    return;
  }

  await client.mutation(api.registrationImports.requestApply, { importId });
  const applyResult = await client.action(api.registrationImportActions.applyImport, {
    importId,
    batchSize: 50,
  });
  console.log(
    `Applied ${applyResult.appliedCount} matched row(s) across ${applyResult.touchedDrugCount} product(s).`
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
