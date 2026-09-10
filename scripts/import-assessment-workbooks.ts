import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const dir = process.argv[2];
  if (!dir)
    throw new Error(
      "Usage: tsx scripts/import-assessment-workbooks.ts ATTACHMENT_DIR [--apply]",
    );
  const url =
    process.env.ASSESSMENT_CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url)
    throw new Error(
      "Configure ASSESSMENT_CONVEX_URL or NEXT_PUBLIC_CONVEX_URL",
    );
  const client = new ConvexHttpClient(url);
  const outputDir = `outputs/assessment-v12-${new URL(url).hostname}`;
  await mkdir(outputDir, { recursive: true });
  const files = [
    "1-pharma_directory_starter_pack.xlsx",
    "2-MOHAP_Complete_Product_List.xlsx",
    "3-MOHAP-Registered-Medical-Products-Directory.xlsx",
    "4-Egypt_Combined_Data_Mar-30-2026.xlsx",
  ];
  console.log(
    JSON.stringify({
      target: url,
      files,
      apply: process.argv.includes("--apply"),
    }),
  );
  if (!process.argv.includes("--apply")) return;
  const logId = await client.action(api.sourceAccess.run, {});
  const access = await client.query(api.sourceAccess.latest, {});
  await writeFile(
    join(outputDir, "source-access.json"),
    JSON.stringify(access, null, 2),
  );
  console.log(
    JSON.stringify({
      sourceAccessLog: logId,
      statuses: access?.entries.map((e) => ({
        name: e.name,
        status: e.status,
      })),
    }),
  );
  for (let i = 0; i < files.length; i++) {
    const checkpoint = join(outputDir, `${i + 1}-import.json`);
    if (existsSync(checkpoint)) {
      const saved = JSON.parse(await readFile(checkpoint, "utf8"));
      const expectedRows = i === 1 ? 16973 : i === 2 ? 14445 : undefined;
      if (!expectedRows || (saved.result?.totalRows === expectedRows && saved.coverage === "accepted")) { console.log(`${files[i]}: existing verified checkpoint; skipped`); continue; }
    }
    const fileName = basename(files[i]);
    const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: await readFile(join(dir, files[i])),
    });
    if (!response.ok) throw new Error(`Upload ${fileName}: ${response.status}`);
    const { storageId } = (await response.json()) as {
      storageId: Id<"_storage">;
    };
    if (i === 0) {
      const result = await client.action(
        api.companyImportActions.importPharmaDirectoryStarterPack,
        { storageId, fileName, enrich: false },
      );
      await writeFile(
        checkpoint,
        JSON.stringify({ storageId, result }, null, 2),
      );
      console.log(JSON.stringify({ fileName, result }));
    } else if (i === 3) {
      const result = await client.action(api.egyptSalesImport.importWorkbook, {
        storageId,
        fileName,
      });
      await writeFile(
        checkpoint,
        JSON.stringify({ storageId, result }, null, 2),
      );
      console.log(JSON.stringify({ fileName, result }));
    } else {
      const sourceType =
        i === 1
          ? "mohap_uae_complete_product_list"
          : "uae_supplementary_directory";
      const recent = await client.query(api.registrationImports.listImports, {
        limit: 50,
      });
      const previous = recent.find(
        (item) => item.fileName === fileName && item.sourceType === sourceType,
      );
      const importId =
        previous?._id ??
        (await client.mutation(api.registrationImports.createImport, {
          storageId,
          fileName,
          sourceMarket: "UAE",
          sourceType,
        }));
      // Staged, source-preserving import. Do not apply inferred company/MAH matches.
      const result = await client.action(
        api.registrationImportActions.parseImport,
        { importId },
      );
      let detail = await client.query(api.registrationImports.getImportDetail, { importId, rowLimit: 1 });
      const expectedRows = i === 1 ? 16973 : 14445;
      if (result.totalRows !== expectedRows) throw new Error(`Expected ${expectedRows} source rows, parsed ${result.totalRows}; review coverage before acceptance`);
      if (detail?.importDoc.coverageHealth === "needs_review") {
        await client.mutation(api.registrationImports.approveInitialSnapshot, { importId, reviewNote: `User-supplied ${fileName}; verified ${expectedRows} product rows against the source sheet. ${i === 1 ? "Primary complete UAE comparison snapshot" : "Supplementary supplier evidence, never a replacement for the complete primary snapshot"}. Snapshot content date is not supplied; upload/check date is recorded separately from product registration dates.` });
        detail = await client.query(api.registrationImports.getImportDetail, { importId, rowLimit: 1 });
      }
      await writeFile(
        checkpoint,
        JSON.stringify(
          {
            storageId,
            importId,
            result,
            coverage: detail?.importDoc.coverageHealth,
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          fileName,
          importId,
          result,
          coverage: detail?.importDoc.coverageHealth,
        }),
      );
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
