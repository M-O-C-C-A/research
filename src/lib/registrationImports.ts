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
  productName: string;
  genericName?: string;
  manufacturerName?: string;
  mahName?: string;
  country: string;
  registrationStatus: RegistrationStatus;
  registrationNumber?: string;
  approvalDate?: string;
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

export const GENERIC_NAME_HEADERS = [
  "generic name",
  "inn",
  "active ingredient",
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
