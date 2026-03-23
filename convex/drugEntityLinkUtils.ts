import { Id } from "./_generated/dataModel";

export type DrugEntityRelationship =
  | "manufacturer"
  | "market_authorization_holder"
  | "licensor"
  | "regional_partner"
  | "distributor";

export type DrugEntityConfidence = "confirmed" | "likely" | "inferred";

export type DrugEntityLinkInput = {
  companyId?: Id<"companies">;
  entityName?: string;
  relationshipType: DrugEntityRelationship;
  jurisdiction?: string;
  isPrimary: boolean;
  notes?: string;
  source?: string;
  url?: string;
  confidence: DrugEntityConfidence;
};

function normalizeEntityName(value?: string) {
  return value?.trim().replace(/\s+/g, " ") || undefined;
}

function linkKey(link: DrugEntityLinkInput) {
  return [
    link.relationshipType,
    link.companyId ?? "",
    normalizeEntityName(link.entityName)?.toLowerCase() ?? "",
    normalizeEntityName(link.jurisdiction)?.toLowerCase() ?? "",
  ].join("::");
}

export function normalizeDrugEntityLinks(links: DrugEntityLinkInput[]) {
  const deduped = new Map<string, DrugEntityLinkInput>();

  for (const link of links) {
    const normalized: DrugEntityLinkInput = {
      ...link,
      entityName: normalizeEntityName(link.entityName),
      jurisdiction: normalizeEntityName(link.jurisdiction),
      notes: normalizeEntityName(link.notes),
      source: normalizeEntityName(link.source),
      url: normalizeEntityName(link.url),
    };

    if (!normalized.companyId && !normalized.entityName) continue;

    const key = linkKey(normalized);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, normalized);
      continue;
    }

    deduped.set(key, {
      ...existing,
      ...normalized,
      isPrimary: existing.isPrimary || normalized.isPrimary,
      confidence:
        existing.confidence === "confirmed" || normalized.confidence === "confirmed"
          ? "confirmed"
          : existing.confidence === "likely" || normalized.confidence === "likely"
            ? "likely"
            : "inferred",
      notes: existing.notes ?? normalized.notes,
      source: existing.source ?? normalized.source,
      url: existing.url ?? normalized.url,
    });
  }

  const byRelationship = new Map<DrugEntityRelationship, DrugEntityLinkInput[]>();
  for (const link of deduped.values()) {
    const current = byRelationship.get(link.relationshipType) ?? [];
    current.push(link);
    byRelationship.set(link.relationshipType, current);
  }

  const normalized: DrugEntityLinkInput[] = [];
  for (const [relationshipType, entries] of byRelationship.entries()) {
    const sorted = entries.sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
      if (!!left.companyId !== !!right.companyId) return left.companyId ? -1 : 1;
      return (left.entityName ?? "").localeCompare(right.entityName ?? "");
    });
    normalized.push(
      ...sorted.map((entry, index) => ({
        ...entry,
        relationshipType,
        isPrimary: index === 0,
      }))
    );
  }

  return normalized;
}
