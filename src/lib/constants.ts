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

export const AVAILABILITY_STATUS_OPTIONS = [
  { value: "formally_registered", label: "Formally Registered" },
  { value: "tender_formulary_only", label: "Tender / Formulary Only" },
  { value: "shortage_listed", label: "Shortage Listed" },
  { value: "hospital_import_only", label: "Hospital / Import Only" },
  { value: "not_found", label: "Not Found" },
  { value: "ambiguous", label: "Ambiguous" },
  { value: "unverified", label: "Unverified" },
] as const;

export const MARKET_ACCESS_ROUTE_OPTIONS = [
  { value: "public_tender", label: "Public Tender" },
  { value: "private_hospital", label: "Private Hospital" },
  { value: "retail_pharmacy", label: "Retail Pharmacy" },
  { value: "specialty_center", label: "Specialty Center" },
  { value: "named_patient", label: "Named Patient / Import" },
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
