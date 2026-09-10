"use node";
import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseEgyptSalesRow } from "./egyptSalesPolicy";
export const importWorkbook = action({
  args: { storageId: v.id("_storage"), fileName: v.string() },
  returns: v.object({
    parsed: v.number(),
    inserted: v.number(),
    fileHash: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ parsed: number; inserted: number; fileHash: string }> => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("Workbook missing");
    const buffer = Buffer.from(await blob.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    // Dense cells avoid the large object overhead of this 75-column workbook.
    const book = XLSX.read(buffer, {
      type: "buffer",
      dense: true,
      cellText: false,
      cellHTML: false,
      sheets: ["Egypt Combined Data"],
    });
    const sheet = book.Sheets["Egypt Combined Data"];
    if (!sheet || !sheet["!ref"])
      throw new Error(
        "Expected Egypt Combined Data sheet; this is commercial sales evidence, not a registry",
      );
    const bounds = XLSX.utils.decode_range(sheet["!ref"]);
    const headers = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      range: { s: { r: 0, c: 0 }, e: { r: 0, c: bounds.e.c } },
      defval: "",
    })[0];
    let inserted = 0;
    let parsedCount = 0;
    // Convert and persist only one bounded batch, not all 25,000 wide records at once.
    for (let start = 1; start <= bounds.e.r; start += 100) {
      const rows = XLSX.utils
        .sheet_to_json<Record<string, unknown>>(sheet, {
          header: headers,
          defval: null,
          blankrows: true,
          range: {
            s: { r: start, c: 0 },
            e: { r: Math.min(start + 99, bounds.e.r), c: bounds.e.c },
          },
        })
        .flatMap((row, i) => {
          const parsed = parseEgyptSalesRow(row);
          return parsed
            ? [
                {
                  ...parsed,
                  ...args,
                  fileHash,
                  sourceSheet: "Egypt Combined Data",
                  sourceRow: start + i + 1,
                  currencyLabel: "LC (unconfirmed)" as const,
                  volumeBasis: "Units (definition unconfirmed)" as const,
                },
              ]
            : [];
        });
      parsedCount += rows.length;
      inserted += await ctx.runMutation(internal.egyptSales.ingest, { rows });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return { parsed: parsedCount, inserted, fileHash };
  },
});
