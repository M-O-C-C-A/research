export const MENA_COUNTRIES = [
  "Saudi Arabia",
  "UAE",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Jordan",
  "Lebanon",
  "Egypt",
  "Iraq",
  "Syria",
  "Libya",
  "Tunisia",
  "Morocco",
  "Algeria",
] as const;

export type MenaCountry = (typeof MENA_COUNTRIES)[number];

export const THERAPEUTIC_AREAS = [
  "Oncology",
  "Cardiology",
  "Neurology",
  "Immunology",
  "Infectious Disease",
  "Diabetes & Endocrinology",
  "Respiratory",
  "Rare Diseases",
  "Hematology",
  "Gastroenterology",
  "Nephrology",
  "Ophthalmology",
  "Dermatology",
  "Musculoskeletal",
  "Psychiatry",
] as const;

export const EUROPEAN_COUNTRIES = [
  "Germany",
  "France",
  "United Kingdom",
  "Switzerland",
  "Denmark",
  "Belgium",
  "Netherlands",
  "Sweden",
  "Italy",
  "Spain",
  "Ireland",
  "Austria",
  "Finland",
  "Norway",
  "Poland",
  "Czech Republic",
  "Hungary",
  "Portugal",
  "Greece",
  "Romania",
] as const;

export const APPROVAL_STATUSES = [
  { value: "approved", label: "EMA Approved" },
  { value: "pending", label: "Pending Approval" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

export const COMPETITOR_PRESENCE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const REGULATORY_STATUS_OPTIONS = [
  { value: "not_registered", label: "Not Registered" },
  { value: "registered", label: "Registered" },
  { value: "pending_registration", label: "Pending Registration" },
  { value: "reimbursed", label: "Registered & Reimbursed" },
] as const;

export const DRUG_CATEGORIES = [
  "Small Molecule",
  "Biologic",
  "Biosimilar",
  "Monoclonal Antibody",
  "Gene Therapy",
  "Cell Therapy",
  "Vaccine",
  "Diagnostic",
  "Medical Device",
] as const;
