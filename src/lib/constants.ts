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

export const GCC_PLUS_COUNTRIES = [
  "Saudi Arabia",
  "UAE",
  "Kuwait",
  "Qatar",
  "Egypt",
  "Algeria",
] as const;

export type GccPlusCountry = (typeof GCC_PLUS_COUNTRIES)[number];

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
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "Germany",
  "France",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
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

export const COMMERCIAL_OPPORTUNITY_KIND_OPTIONS = [
  { value: "commercial_opportunity", label: "Commercial Opportunity" },
  { value: "tender_opportunity", label: "Tender Opportunity" },
  { value: "commercial_and_tender", label: "Commercial + Tender" },
  { value: "no_clear_opportunity", label: "No Clear Opportunity" },
  { value: "insufficient_commercial_evidence", label: "Insufficient Evidence" },
] as const;

export const PRICING_CONFIDENCE_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unknown", label: "Unknown" },
] as const;

export const PRICE_POSITIONING_OPTIONS = [
  { value: "premium", label: "Premium" },
  { value: "parity", label: "At Parity" },
  { value: "discount", label: "Discount" },
  { value: "unknown", label: "Unknown" },
] as const;

export const COMPETITION_INTENSITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "unknown", label: "Unknown" },
] as const;

export const PRICE_SOURCE_CATEGORY_OPTIONS = [
  { value: "official", label: "Official" },
  { value: "commercial_database", label: "Commercial Database" },
  { value: "proxy", label: "Proxy" },
] as const;

export const PRICE_SOURCE_SYSTEM_OPTIONS = [
  { value: "cms", label: "CMS" },
  { value: "nhsbsa", label: "NHSBSA" },
  { value: "sfda", label: "SFDA" },
  { value: "eda_egypt", label: "EDA Egypt" },
  { value: "mohap_uae", label: "MOHAP UAE" },
  { value: "bfarm_amice", label: "BfArM AMIce" },
  { value: "who", label: "WHO" },
  { value: "nupco", label: "NUPCO" },
  { value: "evaluate", label: "Evaluate" },
  { value: "clarivate", label: "Clarivate" },
  { value: "lauer_taxe", label: "LAUER-TAXE" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
] as const;

export const PRICE_TYPE_OPTIONS = [
  { value: "registered", label: "Registered Price" },
  { value: "list", label: "List Price" },
  { value: "tariff", label: "Drug Tariff" },
  { value: "reimbursement", label: "Reimbursement Price" },
  { value: "asp", label: "ASP" },
  { value: "tender", label: "Tender Price" },
  { value: "retail", label: "Retail Price" },
  { value: "hospital", label: "Hospital Price" },
  { value: "other", label: "Other" },
] as const;

export const COMMERCIAL_SIGNAL_TYPE_OPTIONS = [
  { value: "tender", label: "Tender" },
  { value: "procurement", label: "Procurement" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "tariff", label: "Tariff" },
  { value: "channel", label: "Channel" },
  { value: "competition", label: "Competition" },
  { value: "proxy", label: "Proxy" },
] as const;

export const SIGNAL_STRENGTH_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const MARKET_MODEL_LEVEL_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unknown", label: "Unknown" },
] as const;

export const ENTRY_STRATEGY_CHANNEL_OPTIONS = [
  { value: "private_hospital", label: "Private Hospital" },
  { value: "retail_pharmacy", label: "Retail Pharmacy" },
  { value: "public_tender", label: "Public Tender" },
  { value: "specialty_center", label: "Specialty Center" },
  { value: "hybrid", label: "Hybrid" },
  { value: "unknown", label: "Unknown" },
] as const;

export const ENTRY_STRATEGY_SEQUENCING_OPTIONS = [
  { value: "private_first", label: "Private First" },
  { value: "private_to_tender", label: "Private to Tender" },
  { value: "tender_led", label: "Tender-Led" },
  { value: "hybrid_launch", label: "Hybrid Launch" },
  { value: "watch", label: "Watch" },
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
