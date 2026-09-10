import { v } from "convex/values";
export const salesRowFields = {
  storageId: v.id("_storage"),
  fileHash: v.string(),
  fileName: v.string(),
  sourceSheet: v.string(),
  sourceRow: v.number(),
  molecule: v.string(),
  product: v.string(),
  atc4: v.string(),
  currencyLabel: v.literal("LC (unconfirmed)"),
  volumeBasis: v.literal("Units (definition unconfirmed)"),
  observations: v.array(
    v.object({
      period: v.string(),
      periodKind: v.union(
        v.literal("monthly"),
        v.literal("YTD"),
        v.literal("MAT"),
      ),
      value: v.optional(v.number()),
      units: v.optional(v.number()),
      valueShare: v.optional(v.number()),
      unitShare: v.optional(v.number()),
    }),
  ),
};
export const salesRow = v.object(salesRowFields);
