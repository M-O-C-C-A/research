import { Doc, Id } from "./_generated/dataModel";

export type ProductSourceSystem =
  | "drugs_fda"
  | "openfda_label"
  | "orange_book"
  | "purple_book"
  | "ndc"
  | "ema_central"
  | "eu_national_bfarm";

export type CanonicalProductStatus =
  | "active"
  | "withdrawn"
  | "discontinued"
  | "under_review"
  | "unavailable";

export type ProductApplicationType = "NDA" | "ANDA" | "BLA" | "CAP" | "national";

export type CanonicalProductType =
  | "small_molecule"
  | "biologic"
  | "biosimilar"
  | "generic"
  | "unknown";

export type CanonicalProductLinkRelationship =
  | "same_product"
  | "presentation_variant"
  | "biosimilar_of"
  | "reference_product"
  | "regional_variant";

export type CanonicalEntityRole = "manufacturer" | "mah" | "applicant" | "licensor";

export type EvidenceConfidence = "confirmed" | "likely" | "inferred";

export type NormalizedSourceProductInput = {
  sourceSystem: ProductSourceSystem;
  sourceRecordId: string;
  sourceUrl?: string;
  sourceStatus: CanonicalProductStatus;
  geography: string;
  sourceUpdatedAt?: number;
  sourceSnapshot?: string;
  brandName?: string;
  inn?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  atcCode?: string;
  therapeuticArea?: string;
  applicationType?: ProductApplicationType;
  applicantName?: string;
  mahName?: string;
  manufacturerName?: string;
  approvalDate?: string;
  productType?: CanonicalProductType;
  referenceProductSourceRecordId?: string;
  patentsSummary?: string;
  exclusivitiesSummary?: string;
  packageSummary?: string;
  interchangeability?: string;
  rawSourceUpdatedLabel?: string;
};

export type CanonicalEntityDraft = {
  companyId?: Id<"companies">;
  entityName: string;
  normalizedEntityName: string;
  role: CanonicalEntityRole;
  isPrimary: boolean;
  geography?: string;
  sourceSystem: ProductSourceSystem;
  confidence: EvidenceConfidence;
};

export type CanonicalProductSummary = {
  canonicalKey: string;
  normalizedBrandName: string;
  normalizedInn: string;
  brandName: string;
  inn: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  atcCode?: string;
  therapeuticArea?: string;
  applicationTypes: ProductApplicationType[];
  applicationTypeSummary?: string;
  status: CanonicalProductStatus;
  productType: CanonicalProductType;
  geographies: string[];
  primaryManufacturerName?: string;
  primaryMahName?: string;
  primaryApplicantName?: string;
  approvalDate?: string;
  sourceSystems: ProductSourceSystem[];
  matchConfidence: EvidenceConfidence;
  reviewNeeded: boolean;
};

export function normalizeText(value?: string | null) {
  return value
    ?.toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

export function compactString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseDateString(value?: string | null) {
  const trimmed = compactString(value);
  if (!trimmed) return undefined;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

export function parseDateToTimestamp(value?: string | null) {
  const iso = parseDateString(value);
  if (!iso) return undefined;
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

export function pickEarliestDate(values: Array<string | undefined>) {
  const valid = values.filter((value): value is string => !!parseDateToTimestamp(value));
  if (valid.length === 0) return undefined;
  return valid.sort((left, right) => {
    return (parseDateToTimestamp(left) ?? 0) - (parseDateToTimestamp(right) ?? 0);
  })[0];
}

export function dedupeStrings(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const compact = compactString(value);
    if (!compact) continue;
    const normalized = normalizeText(compact);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(compact);
  }
  return result;
}

export function mapSourceStatus(value?: string | null): CanonicalProductStatus {
  const normalized = normalizeText(value);
  if (!normalized) return "active";
  if (normalized.includes("withdraw")) return "withdrawn";
  if (normalized.includes("discontinued")) return "discontinued";
  if (normalized.includes("review") || normalized.includes("pending") || normalized.includes("under evaluation")) {
    return "under_review";
  }
  if (normalized.includes("unavailable") || normalized.includes("not available")) {
    return "unavailable";
  }
  return "active";
}

export function mapApplicationType(value?: string | null): ProductApplicationType | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  if (normalized.includes("anda")) return "ANDA";
  if (normalized.includes("bla")) return "BLA";
  if (normalized.includes("cap") || normalized.includes("central")) return "CAP";
  if (normalized.includes("national")) return "national";
  if (normalized.includes("nda")) return "NDA";
  return undefined;
}

export function mapProductType(value?: string | null): CanonicalProductType {
  const normalized = normalizeText(value);
  if (normalized.includes("biosimilar")) return "biosimilar";
  if (normalized.includes("biologic") || normalized.includes("biological") || normalized.includes("vaccine") || normalized.includes("gene therapy")) {
    return "biologic";
  }
  if (normalized.includes("generic") || normalized.includes("anda")) return "generic";
  if (normalized.includes("small molecule") || normalized.includes("drug")) return "small_molecule";
  return "unknown";
}

export function buildCanonicalKey(input: {
  inn?: string;
  brandName?: string;
  strength?: string;
  dosageForm?: string;
  route?: string;
  productType?: CanonicalProductType;
}) {
  const primaryName = normalizeText(input.inn) || normalizeText(input.brandName) || "unknown";
  const strength = normalizeText(input.strength) || "na";
  const dosageForm = normalizeText(input.dosageForm) || "na";
  const route = normalizeText(input.route) || "na";
  const productType = input.productType ?? "unknown";
  return [primaryName, strength, dosageForm, route, productType].join("|");
}

export function inferLinkRelationship(
  source: NormalizedSourceProductInput
): CanonicalProductLinkRelationship {
  if (source.productType === "biosimilar" && source.referenceProductSourceRecordId) {
    return "biosimilar_of";
  }
  return "same_product";
}

export function summarizeSourceSystems(systems: ProductSourceSystem[]) {
  return dedupeStrings(
    systems.map((system) => {
      switch (system) {
        case "drugs_fda":
        case "openfda_label":
        case "orange_book":
        case "purple_book":
        case "ndc":
          return "FDA";
        case "ema_central":
          return "EMA";
        case "eu_national_bfarm":
          return "BfArM";
      }
    })
  );
}

export function toCanonicalEntities(
  source: NormalizedSourceProductInput,
  companyIdByName: Map<string, Id<"companies">>
): CanonicalEntityDraft[] {
  const drafts: CanonicalEntityDraft[] = [];

  const candidates: Array<{
    value?: string;
    role: CanonicalEntityRole;
    isPrimary: boolean;
  }> = [
    { value: source.manufacturerName, role: "manufacturer", isPrimary: true },
    { value: source.mahName, role: "mah", isPrimary: true },
    { value: source.applicantName, role: "applicant", isPrimary: true },
  ];

  for (const candidate of candidates) {
    const entityName = compactString(candidate.value);
    if (!entityName) continue;
    const normalizedEntityName = normalizeText(entityName);
    drafts.push({
      companyId: companyIdByName.get(normalizedEntityName),
      entityName,
      normalizedEntityName,
      role: candidate.role,
      isPrimary: candidate.isPrimary,
      geography: source.geography,
      sourceSystem: source.sourceSystem,
      confidence: "likely",
    });
  }

  return drafts;
}

export function mergeCanonicalSummary(
  sources: Array<Doc<"productSources">>,
  entities: CanonicalEntityDraft[]
): CanonicalProductSummary {
  const brandName =
    compactString(
      sources.find((source) => compactString(source.brandName))?.brandName
    ) ??
    compactString(sources[0]?.brandName) ??
    compactString(sources[0]?.inn) ??
    "Unnamed product";
  const inn =
    compactString(
      sources.find((source) => compactString(source.inn))?.inn
    ) ??
    compactString(sources[0]?.activeIngredient) ??
    compactString(sources[0]?.brandName) ??
    "Unknown INN";
  const productType =
    sources.find((source) => source.productType && source.productType !== "unknown")?.productType ??
    sources[0]?.productType ??
    "unknown";
  const applicationTypes = dedupeStrings(
    sources.map((source) => source.applicationType)
  ) as ProductApplicationType[];
  const manufacturer = entities.find((entity) => entity.role === "manufacturer" && entity.isPrimary);
  const mah = entities.find((entity) => entity.role === "mah" && entity.isPrimary);
  const applicant = entities.find((entity) => entity.role === "applicant" && entity.isPrimary);
  const statusPriority: CanonicalProductStatus[] = [
    "active",
    "under_review",
    "withdrawn",
    "discontinued",
    "unavailable",
  ];
  const statuses = dedupeStrings(sources.map((source) => source.sourceStatus)) as CanonicalProductStatus[];
  const status =
    statusPriority.find((candidate) => statuses.includes(candidate)) ?? "active";

  return {
    canonicalKey: buildCanonicalKey({
      inn,
      brandName,
      strength: sources[0]?.strength,
      dosageForm: sources[0]?.dosageForm,
      route: sources[0]?.route,
      productType,
    }),
    normalizedBrandName: normalizeText(brandName),
    normalizedInn: normalizeText(inn),
    brandName,
    inn,
    activeIngredient:
      compactString(sources.find((source) => source.activeIngredient)?.activeIngredient) ??
      compactString(sources[0]?.activeIngredient),
    strength:
      compactString(sources.find((source) => source.strength)?.strength) ??
      compactString(sources[0]?.strength),
    dosageForm:
      compactString(sources.find((source) => source.dosageForm)?.dosageForm) ??
      compactString(sources[0]?.dosageForm),
    route:
      compactString(sources.find((source) => source.route)?.route) ??
      compactString(sources[0]?.route),
    atcCode:
      compactString(sources.find((source) => source.atcCode)?.atcCode) ??
      compactString(sources[0]?.atcCode),
    therapeuticArea:
      compactString(sources.find((source) => source.therapeuticArea)?.therapeuticArea) ??
      compactString(sources[0]?.therapeuticArea),
    applicationTypes,
    applicationTypeSummary: applicationTypes.join(", ") || undefined,
    status,
    productType,
    geographies: dedupeStrings(sources.map((source) => source.geography)),
    primaryManufacturerName: manufacturer?.entityName,
    primaryMahName: mah?.entityName,
    primaryApplicantName: applicant?.entityName,
    approvalDate: pickEarliestDate(sources.map((source) => source.approvalDate)),
    sourceSystems: [...new Set(sources.map((source) => source.sourceSystem))],
    matchConfidence:
      sources.some((source) => source.sourceSystem === "ema_central" || source.sourceSystem === "drugs_fda")
        ? "confirmed"
        : "likely",
    reviewNeeded: sources.some(
      (source) => !source.inn || (!source.brandName && !source.activeIngredient)
    ),
  };
}
