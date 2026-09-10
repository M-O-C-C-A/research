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
    const book = XLSX.read(buffer, { type: "buffer" });
    const sheet = book.Sheets["Egypt Combined Data"];
    if (!sheet)
      throw new Error(
        "Expected Egypt Combined Data sheet; this is commercial sales evidence, not a registry",
      );
    const rows = XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
      .flatMap((row, i) => {
        const parsed = parseEgyptSalesRow(row);
        return parsed
          ? [
              {
                ...parsed,
                ...args,
                fileHash,
                sourceSheet: "Egypt Combined Data",
                sourceRow: i + 2,
                currencyLabel: "LC (unconfirmed)" as const,
                volumeBasis: "Units (definition unconfirmed)" as const,
              },
            ]
          : [];
      });
    let inserted = 0;
    for (let offset = 0; offset < rows.length; offset += 100) {
      inserted += await ctx.runMutation(internal.egyptSales.ingest, {
        rows: rows.slice(offset, offset + 100),
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return { parsed: rows.length, inserted, fileHash };
  },
});
