import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireMember } from "./authz";
import { salesRow } from "./salesValidators";
import { normalizeEvidenceText } from "./evidenceEngineV11Policy";
export const ingest = internalMutation({
  args: { rows: v.array(salesRow) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    if (rows.length > 100) throw new Error("Use batches of at most 100 rows");
    let inserted = 0;
    for (const row of rows) {
      const existing = await ctx.db
        .query("egyptSalesRows")
        .withIndex("by_file_hash_and_row", (q) =>
          q.eq("fileHash", row.fileHash).eq("sourceRow", row.sourceRow),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("egyptSalesRows", {
          ...row,
          normalizedMolecule: normalizeEvidenceText(row.molecule),
        });
        inserted++;
      }
    }
    return inserted;
  },
});
export const byMolecule = query({
  args: { molecule: v.string() },
  returns: v.any(),
  handler: async (ctx, { molecule }) => {
    await requireMember(ctx);
    return await ctx.db
      .query("egyptSalesRows")
      .withIndex("by_normalized_molecule", (q) =>
        q.eq("normalizedMolecule", normalizeEvidenceText(molecule)),
      )
      .take(50);
  },
});
