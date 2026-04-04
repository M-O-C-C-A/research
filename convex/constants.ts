// Shared constants for Convex backend functions

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
