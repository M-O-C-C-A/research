import type { Doc } from "./_generated/dataModel";
import {
  normalizeEvidenceText,
  normalizeDosageForm,
  normalizeStrength,
} from "./evidenceEngineV11Policy";

export const DOSAGE_FORMS = [
  "TABLET",
  "CAPSULE",
  "INJECTION",
  "INFUSION",
  "ORAL_SOLUTION",
  "SUSPENSION",
  "CREAM",
  "OINTMENT",
  "GEL",
  "PATCH",
  "INHALATION",
  "DROPS",
  "SUPPOSITORY",
  "POWDER",
  "OTHER",
] as const;
export type Product = {
  inn: string;
  brand: string;
  mah: string;
  mah_country: string;
  dosage_form: (typeof DOSAGE_FORMS)[number];
  strength: string;
  atc_code: string | null;
  approval_authority: "EMA" | "FDA" | "MHRA" | "EU_NATIONAL" | "BfArM";
  approval_date: string;
  status: "ACTIVE" | "WITHDRAWN" | "SUSPENDED";
};

/** Incomplete source records remain visible, but never become complete approved products. */
export function referenceProduct(fact: Doc<"authorizedProductFacts">) {
  const form = normalizeDosageForm(fact.dosageForm)
    .replaceAll(" ", "_")
    .toUpperCase();
  const dosageForm = DOSAGE_FORMS.find((value) => value === form) ?? "OTHER";
  const product: Product | null =
    fact.authorizationStatus === "under_review"
      ? null
      : {
          inn: fact.normalizedInn || normalizeEvidenceText(fact.inn),
          brand: fact.brandName,
          mah: fact.mah,
          mah_country: fact.mahCountry ?? "",
          dosage_form: dosageForm,
          strength: fact.normalizedStrength || normalizeStrength(fact.strength),
          atc_code: fact.atcCode ?? null,
          approval_authority: fact.authorizationMarket,
          approval_date: fact.authorizationDate ?? "",
          status:
            fact.authorizationStatus === "approved"
              ? "ACTIVE"
              : fact.authorizationStatus === "withdrawn"
                ? "WITHDRAWN"
                : "SUSPENDED",
        };
  const missingFields = product
    ? Object.entries(product)
        .filter(
          ([key, value]) =>
            key !== "atc_code" && (value === "" || value === "Unknown"),
        )
        .map(([key]) => key)
    : ["approval_status"];
  if (dosageForm === "OTHER") missingFields.push("dosage_form_standardization");
  return {
    product,
    missingFields,
    sourceUrl: fact.sourceUrl,
    sourceRecordId: fact.sourceRecordId ?? "",
    rawDosageForm: fact.dosageForm,
  };
}
