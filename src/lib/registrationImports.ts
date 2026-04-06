export const REGISTRATION_IMPORT_STATUSES = [
  "uploaded",
  "parsed",
  "needs_review",
  "ready",
  "applied",
  "failed",
] as const;

export const REGISTRATION_IMPORT_MATCH_STATUSES = [
  "matched",
  "unmatched",
  "ambiguous",
  "skipped",
] as const;

export const REGISTRATION_IMPORT_APPLY_STATES = [
  "pending",
  "applied",
  "skipped",
] as const;

export type RegistrationImportStatus =
  (typeof REGISTRATION_IMPORT_STATUSES)[number];
export type RegistrationImportMatchStatus =
  (typeof REGISTRATION_IMPORT_MATCH_STATUSES)[number];
export type RegistrationImportApplyState =
  (typeof REGISTRATION_IMPORT_APPLY_STATES)[number];
export type RegistrationStatus = "registered" | "not_found" | "unverified";

export interface ParsedRegistrationRow {
  source?: string;
  sourceRecordId?: string;
  productName: string;
  genericName?: string;
  manufacturerName?: string;
  mahName?: string;
  supplierName?: string;
  supplierAddress?: string;
  country: string;
  registrationStatus: RegistrationStatus;
  sourceStatus?: string;
  registrationNumber?: string;
  approvalDate?: string;
  strength?: string;
  form?: string;
  packSize?: string;
  priceAed?: string;
  classification?: string;
  dispensingMode?: string;
  countryOfOrigin?: string;
  bodySystem?: string;
  therapeuticGroup?: string;
  productKind?: "medicine" | "device";
  matchExplanation?: string;
  sourceNote?: string;
  sourceSheet: string;
  sourceRowNumber: number;
  validationIssues: string[];
  rawRow: Record<string, string>;
}

const COUNTRY_ALIASES: Record<string, string> = {
  uae: "UAE",
  "u a e": "UAE",
  "u.a.e": "UAE",
  "united arab emirates": "UAE",
  ksa: "Saudi Arabia",
  saudi: "Saudi Arabia",
  "saudi arabia": "Saudi Arabia",
  "state of qatar": "Qatar",
};

const REGISTERED_ALIASES = new Set([
  "registered",
  "approved",
  "marketed",
  "available",
  "listed",
  "active",
  "active ingredient",
  "yes",
  "y",
  "true",
]);

const NOT_FOUND_ALIASES = new Set([
  "not found",
  "not registered",
  "unregistered",
  "no",
  "n",
  "false",
  "absent",
  "missing",
]);

const UNVERIFIED_ALIASES = new Set([
  "unknown",
  "pending",
  "unverified",
  "tbc",
  "na",
  "n/a",
  "",
]);

export const PRODUCT_NAME_HEADERS = [
  "product name",
  "brand name",
  "brand",
  "product",
  "trade name",
] as const;

export const SOURCE_HEADERS = ["source"] as const;
export const SOURCE_RECORD_ID_HEADERS = [
  "source id",
  "source record id",
  "record id",
] as const;

export const GENERIC_NAME_HEADERS = [
  "generic name",
  "inn",
  "active ingredient",
  "ingredients",
  "molecule",
  "generic",
] as const;

export const MANUFACTURER_HEADERS = [
  "manufacturer",
  "company",
  "manufacturer name",
  "marketing company",
] as const;

export const MAH_HEADERS = [
  "mah",
  "market authorization holder",
  "marketing authorization holder",
  "license holder",
  "commercial owner",
  "supplier name",
] as const;

export const SUPPLIER_HEADERS = [
  "supplier name",
  "supplier",
  "local supplier",
  "local distributor",
] as const;

export const SUPPLIER_ADDRESS_HEADERS = [
  "supplier address",
  "local supplier address",
] as const;

export const COUNTRY_HEADERS = [
  "country",
  "market",
  "jurisdiction",
  "territory",
] as const;

export const STATUS_HEADERS = [
  "status",
  "registration status",
  "approval status",
  "market status",
] as const;

export const REGISTRATION_NUMBER_HEADERS = [
  "registration number",
  "license number",
  "approval number",
  "registration no",
] as const;

export const APPROVAL_DATE_HEADERS = [
  "approval date",
  "registration date",
  "date approved",
] as const;

export const STRENGTH_HEADERS = ["strength"] as const;
export const FORM_HEADERS = ["form", "dosage form"] as const;
export const PACK_SIZE_HEADERS = ["pack size", "presentation", "pack"] as const;
export const PRICE_AED_HEADERS = ["price aed", "price (aed)", "uae price"] as const;
export const CLASSIFICATION_HEADERS = ["classification"] as const;
export const DISPENSING_MODE_HEADERS = ["dispensing mode"] as const;
export const COUNTRY_OF_ORIGIN_HEADERS = [
  "country of origin",
  "origin country",
] as const;

export const BODY_SYSTEM_HEADERS = ["body system"] as const;
export const THERAPEUTIC_GROUP_HEADERS = [
  "therapeutic group",
  "therapeutic class",
] as const;

export const SOURCE_NOTE_HEADERS = [
  "notes",
  "source",
  "comment",
  "remarks",
] as const;

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeCountry(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const normalized = normalizeText(trimmed);
  return COUNTRY_ALIASES[normalized] ?? trimmed;
}

export function normalizeRegistrationStatus(
  value: string | null | undefined
): RegistrationStatus {
  const normalized = normalizeText(value);
  if (REGISTERED_ALIASES.has(normalized)) return "registered";
  if (NOT_FOUND_ALIASES.has(normalized)) return "not_found";
  if (UNVERIFIED_ALIASES.has(normalized)) return "unverified";
  return "unverified";
}

export function normalizeIngredients(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parts = trimmed
    .split("!")
    .map((part) =>
      part
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return [...new Set(parts)].join(" + ");
}

export function classifyImportedProduct(args: {
  classification?: string;
  form?: string;
  dispensingMode?: string;
}): "medicine" | "device" {
  const haystack = [args.classification, args.form, args.dispensingMode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    haystack.includes("device") ||
    haystack.includes("diagnostic") ||
    haystack.includes("kit") ||
    haystack.includes("consumable")
  ) {
    return "device";
  }
  return "medicine";
}

export function stringifyCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function canonicalizeHeader(value: string): string {
  return normalizeText(value);
}

export function getRowValue(
  row: Record<string, string>,
  candidates: readonly string[]
): string | undefined {
  for (const candidate of candidates) {
    const value = row[canonicalizeHeader(candidate)];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}
