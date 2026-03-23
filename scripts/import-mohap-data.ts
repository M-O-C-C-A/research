/**
 * MOHAP Open Data Import Script
 *
 * Parses UAE Ministry of Health open datasets and creates gap opportunities
 * in Convex with official disease burden data as demand evidence.
 *
 * Data sources:
 *   - Core Indicator 2024.xlsx  (2016-2023 health indicators time series)
 *   - Hospital services 2024.xlsx (patient visit volumes 2018-2024)
 *   - Mortality Data _ 2024.xlsx  (deaths by emirate/nationality/gender 2011-2024)
 *   - UAE Statistical Annual Report 2023.pdf (communicable disease counts, hardcoded)
 *
 * Run with:
 *   npx tsx scripts/import-mohap-data.ts           # targets dev (.env.local)
 *   npx tsx scripts/import-mohap-data.ts --prod     # targets prod (.env.production.local)
 *   CONVEX_URL=https://… npx tsx scripts/…          # explicit override
 */

import * as XLSX from "xlsx";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const isProd = process.argv.includes("--prod");
const envFile = isProd ? ".env.production.local" : ".env.local";
dotenv.config({ path: path.join(__dirname, "..", envFile) });

const CONVEX_URL =
  process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error(`❌ No Convex URL found in ${envFile} (or CONVEX_URL env var)`);
  process.exit(1);
}
console.log(`🎯 Target: ${isProd ? "PRODUCTION" : "dev"} — ${CONVEX_URL}`);

const DOWNLOADS = path.join(process.env.HOME!, "Downloads");
const CORE_FILE = path.join(DOWNLOADS, "Core Indicator 2024.xlsx");
const HOSPITAL_FILE = path.join(DOWNLOADS, "Hospital services 2024.xlsx");
const MORTALITY_FILE = path.join(DOWNLOADS, "Mortality Data _ 2024.xlsx");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoreIndicators {
  bloodGlucoseRate: number; // raised blood glucose 18+ (fraction)
  bloodPressureRate: number; // raised blood pressure 18+ (fraction)
  obesityRate: number; // obesity 18+ (fraction)
  overweightRate: number; // overweight 18+ (fraction)
  anemiaRate: number; // anemia in reproductive-age women (fraction)
  ncdMortalityPer100k: number; // NCD deaths per 100k
  commMortalityPer100k: number; // communicable disease deaths per 100k
  cancerIncidencePer100k: number; // cancer incidence per 100k
  population: number; // total population
}

interface HospitalTotals {
  totalVisits2024: number;
  privateVisits2024: number;
  govVisits2024: number;
}

interface MortalityTotals {
  totalDeaths2024: number;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseCoreIndicators(filePath: string): CoreIndicators {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  // Helper: find a row by indicator name prefix, return 2023 value (col index 8, 0-based)
  const find = (prefix: string): number => {
    for (const row of rows) {
      const label = String(row[0] ?? "").toLowerCase();
      if (label.startsWith(prefix.toLowerCase())) {
        const val = row[8]; // 2023 column
        if (val !== null && val !== undefined) return Number(val);
      }
    }
    throw new Error(`Indicator not found: "${prefix}"`);
  };

  // Population is in col 8 but stored as truncated "10679" (thousands) in the file
  // Annual report says 10,678,556 — use hardcoded authoritative value
  const population = 10_678_556;

  const bloodGlucose = find("Raised blood glucose");
  const bloodPressure = find("Raised blood pressure");
  const obesity = find("Obesity (18+");
  const overweight = find("Overweight (18+");
  const anemia = find("Anemia among women");
  const ncdMortality = find("b) Non-Communicable Diseases");
  const commMortality = find("a) Communicable Diseases");
  const cancer = find("Cancer incidence");

  // Values may be stored as fractions (0.118) or percentages (11.8) — normalise to fraction
  const normalise = (v: number) => (v > 1 ? v / 100 : v);

  return {
    bloodGlucoseRate: normalise(bloodGlucose),
    bloodPressureRate: normalise(bloodPressure),
    obesityRate: normalise(obesity),
    overweightRate: normalise(overweight),
    anemiaRate: normalise(anemia),
    ncdMortalityPer100k: ncdMortality,
    commMortalityPer100k: commMortality,
    cancerIncidencePer100k: cancer,
    population,
  };
}

function parseHospitalTotals(filePath: string): HospitalTotals {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const wb = XLSX.readFile(filePath);

  // Sheet "Attending to the hospital" has: Year, Category, Emirate, Sector, Total
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes("attending")) ??
    wb.SheetNames[wb.SheetNames.length - 1];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, {
    defval: null,
  });

  let totalVisits = 0;
  let privateVisits = 0;
  let govVisits = 0;

  for (const row of rows) {
    const year = String(row["Year"] ?? row["year"] ?? "").trim();
    if (year !== "2024") continue;

    const sector = String(
      row["Sector EN"] ?? row["Sector"] ?? row["sector EN"] ?? ""
    )
      .trim()
      .toLowerCase();
    const total = Number(row["Total "] ?? row["Total"] ?? row["total"] ?? 0);
    if (isNaN(total)) continue;

    totalVisits += total;
    if (sector === "private") privateVisits += total;
    if (sector === "government") govVisits += total;
  }

  // Fallback to 2023 figures from Annual Report if 2024 data absent
  if (totalVisits === 0) {
    return {
      totalVisits2024: 25_642_705,
      privateVisits2024: 19_136_518,
      govVisits2024: 6_506_187,
    };
  }

  return { totalVisits2024: totalVisits, privateVisits2024: privateVisits, govVisits2024: govVisits };
}

function parseMortalityTotals(filePath: string): MortalityTotals {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, {
    defval: null,
  });

  let total2024 = 0;
  for (const row of rows) {
    const year = String(row["Year"] ?? row["year"] ?? "").trim();
    if (year !== "2024") continue;
    const count = Number(row["Total"] ?? row["total"] ?? 0);
    if (!isNaN(count)) total2024 += count;
  }

  // Fallback to 2023 figure from Annual Report
  if (total2024 === 0) total2024 = 11_514;

  return { totalDeaths2024: total2024 };
}

// ---------------------------------------------------------------------------
// Hardcoded communicable disease data (from Annual Report 2023 PDF)
// ---------------------------------------------------------------------------

const COMMUNICABLE_DISEASES_2023 = {
  influenza: 74_023,
  chickenpox: 7_619,
  malaria: 3_000,
  dengue: 2_414,
  hepatitisB: 2_303,
  earlySyphilis: 2_016,
  amoebicDysentery: 1_702,
  hepatitisC: 1_527,
};

// ---------------------------------------------------------------------------
// Gap opportunity definitions
// ---------------------------------------------------------------------------

interface GapDef {
  therapeuticArea: string;
  indication: string;
  targetCountries: string[];
  gapScore: number;
  demandEvidence: string;
  whoDiseaseBurden: string;
  supplyGap: string;
  competitorLandscape: string;
  suggestedDrugClasses: string[];
  tenderSignals?: string;
  regulatoryFeasibility: "high" | "medium" | "low";
  sources: Array<{ title: string; url: string }>;
}

function buildGaps(
  ci: CoreIndicators,
  hosp: HospitalTotals,
): GapDef[] {
  const pop = ci.population;
  const diabeticCount = Math.round(pop * ci.bloodGlucoseRate);
  const hypertensiveCount = Math.round(pop * ci.bloodPressureRate);
  const anemiaCount = Math.round((pop * 0.36) * ci.anemiaRate); // 36% female population
  const cancerCases = Math.round((pop / 100_000) * ci.cancerIncidencePer100k);
  const privatePct = Math.round((hosp.privateVisits2024 / hosp.totalVisits2024) * 100);

  const MOHAP_SOURCE = {
    title: "MOHAP UAE Statistical Annual Health Sector Report 2023",
    url: "https://mohap.gov.ae/en/open-data/mohap-open-data",
  };
  const CORE_SOURCE = {
    title: "MOHAP Core Health Indicators 2024",
    url: "https://mohap.gov.ae/en/open-data/mohap-open-data",
  };
  const HOSP_SOURCE = {
    title: "MOHAP Hospital Services Data 2024",
    url: "https://mohap.gov.ae/en/open-data/mohap-open-data",
  };

  return [
    // -------------------------------------------------------------------------
    // 1. Diabetes / Metabolic Syndrome
    // -------------------------------------------------------------------------
    {
      therapeuticArea: "Endocrinology",
      indication: "Type 2 Diabetes / Metabolic Syndrome",
      targetCountries: ["UAE"],
      gapScore: 8.5,
      demandEvidence: [
        `UAE raised blood glucose rate: ${(ci.bloodGlucoseRate * 100).toFixed(1)}% of adults 18+ (MOHAP Core Indicators 2024).`,
        `Estimated ${diabeticCount.toLocaleString()} individuals with raised blood glucose in a population of ${pop.toLocaleString()}.`,
        `Obesity rate: ${(ci.obesityRate * 100).toFixed(1)}% of adults 18+. Overweight: ${(ci.overweightRate * 100).toFixed(1)}%.`,
        `NCD mortality rate: ${ci.ncdMortalityPer100k}/100k — 5× higher than communicable diseases (${ci.commMortalityPer100k}/100k).`,
        `Total hospital visits 2024: ${hosp.totalVisits2024.toLocaleString()} (${privatePct}% private sector).`,
      ].join("\n"),
      whoDiseaseBurden: `Raised blood glucose (WHO definition) in ${(ci.bloodGlucoseRate * 100).toFixed(1)}% of UAE adults. At 10.7M population this represents approximately ${diabeticCount.toLocaleString()} people. Combined with ${(ci.obesityRate * 100).toFixed(1)}% obesity and ${(ci.overweightRate * 100).toFixed(1)}% overweight, the metabolic disease burden is among the highest globally for a high-income country.`,
      supplyGap: "UAE requires MOHAP registration for all marketed drugs. EU-approved diabetes drugs (GLP-1 agonists, SGLT-2 inhibitors, newer insulin analogues) are not fully registered in UAE. Growing private hospital volume creates demand for innovative branded therapies beyond generics currently available.",
      competitorLandscape: "Market dominated by Novo Nordisk, Sanofi, AstraZeneca via local distributors. Generic metformin/sulfonylureas widely available through government formulary. Opportunity in newer patented mechanisms (GLP-1, SGLT-2) targeting private pay patients.",
      suggestedDrugClasses: ["GLP-1 receptor agonists", "SGLT-2 inhibitors", "DPP-4 inhibitors", "Insulin analogues", "Metformin combinations"],
      tenderSignals: "UAE Ministry of Health runs annual drug procurement tenders. Diabetes is a national priority condition under UAE Vision 2031 health strategy.",
      regulatoryFeasibility: "high",
      sources: [MOHAP_SOURCE, CORE_SOURCE, HOSP_SOURCE],
    },

    // -------------------------------------------------------------------------
    // 2. Cardiovascular / Hypertension
    // -------------------------------------------------------------------------
    {
      therapeuticArea: "Cardiovascular",
      indication: "Hypertension / Dyslipidemia",
      targetCountries: ["UAE"],
      gapScore: 8.0,
      demandEvidence: [
        `UAE raised blood pressure rate: ${(ci.bloodPressureRate * 100).toFixed(1)}% of adults 18+ (MOHAP Core Indicators 2024).`,
        `Estimated ${hypertensiveCount.toLocaleString()} individuals with raised blood pressure in UAE.`,
        `Overweight rate ${(ci.overweightRate * 100).toFixed(1)}% drives dyslipidemia and cardiovascular risk.`,
        `NCD mortality ${ci.ncdMortalityPer100k}/100k — cardiovascular disease is leading NCD cause of death in the region.`,
        `64% male-dominated population (expatriate labour force) — males have higher cardiovascular disease prevalence.`,
        `${privatePct}% of ${hosp.totalVisits2024.toLocaleString()} annual hospital visits are private — branded CV drugs viable.`,
      ].join("\n"),
      whoDiseaseBurden: `${(ci.bloodPressureRate * 100).toFixed(1)}% of UAE adults 18+ have raised blood pressure (MOHAP 2024) — approximately ${hypertensiveCount.toLocaleString()} people. UAE's unique demographics (64% male, predominantly working-age expatriates) amplify cardiovascular risk. Overweight rate of ${(ci.overweightRate * 100).toFixed(1)}% creates a large dyslipidemia patient pool.`,
      supplyGap: "Branded cardiovascular drugs from EU manufacturers are underrepresented in UAE relative to generics. ACE inhibitors and ARBs are generically available; PCSK9 inhibitors, sacubitril/valsartan combinations, and newer anticoagulants represent an access gap for private patients.",
      competitorLandscape: "Generics dominate the government formulary. Private hospital segment served by Pfizer, AstraZeneca, Novartis distributors. Opportunity for EU SME manufacturers with differentiated CV formulations to enter via private hospital channel.",
      suggestedDrugClasses: ["ACE inhibitors / ARBs", "PCSK9 inhibitors", "Statins (branded)", "Beta-blockers", "Novel anticoagulants (DOACs)", "Sacubitril/valsartan"],
      tenderSignals: "Cardiovascular drugs appear in UAE National Essential Medicines List. Annual MOHAP procurement tenders include antihypertensives and statins.",
      regulatoryFeasibility: "high",
      sources: [MOHAP_SOURCE, CORE_SOURCE, HOSP_SOURCE],
    },

    // -------------------------------------------------------------------------
    // 3. Oncology
    // -------------------------------------------------------------------------
    {
      therapeuticArea: "Oncology",
      indication: "Solid Tumours (Breast, Colorectal, Lung)",
      targetCountries: ["UAE"],
      gapScore: 7.5,
      demandEvidence: [
        `Cancer incidence: ${ci.cancerIncidencePer100k}/100k (MOHAP Core Indicators 2024) — approximately ${cancerCases.toLocaleString()} new cases/year in UAE.`,
        `Radiotherapy infrastructure: only 1.7 units per million population — infrastructure gap signals unmet demand for systemic therapies.`,
        `National screening programs active for breast cancer (mammography), cervical cancer, and HbA1c (MOHAP Annual Report 2023).`,
        `Mammography density: 224/million — high screening activity drives earlier detection and treatment demand.`,
        `NCD mortality rate ${ci.ncdMortalityPer100k}/100k — cancer is a primary contributor to NCD mortality in UAE.`,
      ].join("\n"),
      whoDiseaseBurden: `UAE cancer incidence of ${ci.cancerIncidencePer100k}/100k generates approximately ${cancerCases.toLocaleString()} new cases annually. Radiotherapy capacity is limited (1.7 units/million vs. international benchmark of ~5/million), indicating systemic/targeted therapy is the primary treatment modality. Active national breast and cervical cancer screening programs create a pipeline of diagnosed patients needing treatment.`,
      supplyGap: "UAE's limited radiotherapy infrastructure creates demand for oral oncology drugs and IV chemotherapy. EU-approved targeted therapies (CDK4/6 inhibitors, PARP inhibitors, checkpoint inhibitors) have limited registered options in UAE. Abu Dhabi's Cleveland Clinic and Dubai's private hospital cluster represent high-value oncology buyers.",
      competitorLandscape: "Roche, Novartis, AstraZeneca, MSD have UAE distributor arrangements. Smaller EU manufacturers with niche oncology products can access private oncology centres in Abu Dhabi/Dubai without competing directly with blockbuster distributors.",
      suggestedDrugClasses: ["CDK4/6 inhibitors", "PARP inhibitors", "Checkpoint inhibitors", "Targeted kinase inhibitors", "Cytotoxic chemotherapy (IV)", "Oral oncology (capecitabine, etc.)"],
      regulatoryFeasibility: "medium",
      sources: [MOHAP_SOURCE, CORE_SOURCE],
    },

    // -------------------------------------------------------------------------
    // 4. Hematology / Women's Health — Anemia
    // -------------------------------------------------------------------------
    {
      therapeuticArea: "Hematology",
      indication: "Iron Deficiency Anemia (Reproductive-Age Women)",
      targetCountries: ["UAE"],
      gapScore: 6.5,
      demandEvidence: [
        `Anemia prevalence: ${(ci.anemiaRate * 100).toFixed(1)}% of reproductive-age women in UAE (MOHAP Core Indicators 2024).`,
        `Estimated ${anemiaCount.toLocaleString()} women of reproductive age (15-49) affected based on 36% female population share.`,
        `Low birth weight at 12.13% of births (2023) — maternal nutritional deficiency is a contributing factor.`,
        `101,088 live births in 2023 — large maternal health patient population.`,
        `Government health centers recorded 9.9M visits in 2023, including dedicated diabetes and fertility centers.`,
      ].join("\n"),
      whoDiseaseBurden: `${(ci.anemiaRate * 100).toFixed(1)}% of UAE reproductive-age women have anemia (MOHAP 2024). With 3.84M females in a population of 10.7M, approximately ${anemiaCount.toLocaleString()} women are affected. Low birth weight rate of 12.13% indicates maternal nutritional gaps. UAE has 4 dedicated government fertility centres and 18 private fertility centres — maternal health is an active care pathway.`,
      supplyGap: "Iron supplementation is widely available generically, but IV iron formulations (ferric carboxymaltose, iron isomaltoside) and erythropoiesis-stimulating agents for chronic anemia management have limited registration. Pre-natal supplement combinations from EU manufacturers are underrepresented.",
      competitorLandscape: "Oral iron generics dominate. Vifor Pharma (now CSL) dominates IV iron. EU manufacturers of combination pre-natal supplements and specialty iron formulations face limited competition in UAE private pharmacies.",
      suggestedDrugClasses: ["IV iron formulations (ferric carboxymaltose)", "Oral iron combinations", "Erythropoiesis-stimulating agents", "Pre-natal multivitamins"],
      regulatoryFeasibility: "high",
      sources: [MOHAP_SOURCE, CORE_SOURCE],
    },

    // -------------------------------------------------------------------------
    // 5. Infectious Disease — Viral Hepatitis
    // -------------------------------------------------------------------------
    {
      therapeuticArea: "Infectious Disease",
      indication: "Viral Hepatitis B & C",
      targetCountries: ["UAE"],
      gapScore: 6.0,
      demandEvidence: [
        `Hepatitis B: ${COMMUNICABLE_DISEASES_2023.hepatitisB.toLocaleString()} notified cases in UAE 2023 (MOHAP Annual Report 2023).`,
        `Hepatitis C: ${COMMUNICABLE_DISEASES_2023.hepatitisC.toLocaleString()} notified cases in UAE 2023 (MOHAP Annual Report 2023).`,
        `HepB incidence rate: 23.81/100k in 2017, declining to near-zero by 2022/2023 due to vaccination — but existing chronic carriers remain a treatment population.`,
        `UAE has active Communicable Disease Control Centers screening 5.17M workers annually — HepB/C detected in this workforce screening.`,
        `Large expatriate workforce (particularly South Asian) has higher HepB/C background prevalence.`,
      ].join("\n"),
      whoDiseaseBurden: `MOHAP recorded ${COMMUNICABLE_DISEASES_2023.hepatitisB.toLocaleString()} Hepatitis B and ${COMMUNICABLE_DISEASES_2023.hepatitisC.toLocaleString()} Hepatitis C cases in 2023. The UAE's large expatriate population (especially from South Asia and Africa) carries elevated HepB/C prevalence. MOHAP communicable disease control centres screen 5.17M workers/year — representing an active diagnosis pipeline.`,
      supplyGap: "Direct-acting antivirals (DAAs) for Hepatitis C (sofosbuvir-based regimens) and nucleos(t)ide analogues for HepB chronic management. Affordable generic DAAs increasingly available, but branded EU formulations with better tolerability profiles serve private-pay patients.",
      competitorLandscape: "Gilead Sciences dominates HepC with sofosbuvir/velpatasvir (Epclusa). Generic versions licensed in some MENA markets. HepB market: Tenofovir generics available. EU manufacturers of novel HepB/C combinations can target private infectious disease specialists.",
      suggestedDrugClasses: ["NS5B polymerase inhibitors (sofosbuvir)", "NS5A inhibitors", "Nucleotide/nucleoside analogues (tenofovir, entecavir)", "Pan-genotypic DAA combinations"],
      regulatoryFeasibility: "medium",
      sources: [MOHAP_SOURCE],
    },

    // -------------------------------------------------------------------------
    // 6. Respiratory — Influenza / Antivirals
    // -------------------------------------------------------------------------
    {
      therapeuticArea: "Respiratory",
      indication: "Seasonal Influenza / Respiratory Infections",
      targetCountries: ["UAE"],
      gapScore: 5.5,
      demandEvidence: [
        `Influenza: ${COMMUNICABLE_DISEASES_2023.influenza.toLocaleString()} notified cases in 2023 — 68% of ALL notifiable communicable diseases in UAE (MOHAP Annual Report 2023).`,
        `Dengue fever: ${COMMUNICABLE_DISEASES_2023.dengue.toLocaleString()} cases — increasing vector-borne respiratory-adjacent burden.`,
        `UAE has 3.59M emergency department visits/year — respiratory infections drive significant A&E utilisation.`,
        `Large mobile workforce population (5.17M screened annually) creates influenza transmission hotspots.`,
        `Government health centers: 9.92M visits in 2023; respiratory complaints are a leading primary care presentation.`,
      ].join("\n"),
      whoDiseaseBurden: `Seasonal influenza is the dominant communicable disease in UAE, with ${COMMUNICABLE_DISEASES_2023.influenza.toLocaleString()} notified cases in 2023 (68% of all notifiable diseases). The UAE's dense urban population, international travel hub status, and large dormitory-housed workforce create sustained seasonal and pandemic influenza burden.`,
      supplyGap: "Influenza vaccines (quadrivalent, adjuvanted for elderly) and antiviral treatments (oseltamivir, baloxavir) are partially available but supply is inconsistent. EU vaccine manufacturers and novel antiviral developers can access UAE's private clinic and employer-health programme markets.",
      competitorLandscape: "GSK (Fluarix), Sanofi (Vaxigrip) dominate influenza vaccines. Roche's Tamiflu (oseltamivir) and Shionogi's Xofluza (baloxavir) represent the antiviral market. EU manufacturers of quadrivalent adjuvanted vaccines or novel antivirals face limited local competition in the private employer-health segment.",
      suggestedDrugClasses: ["Quadrivalent influenza vaccines", "Adjuvanted influenza vaccines (elderly)", "Neuraminidase inhibitors (oseltamivir)", "Cap-dependent endonuclease inhibitors (baloxavir)", "Respiratory syncytial virus (RSV) prophylaxis"],
      regulatoryFeasibility: "high",
      sources: [MOHAP_SOURCE],
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL!);

  console.log("📂 Parsing MOHAP datasets...\n");

  // Parse files
  let ci: CoreIndicators;
  try {
    ci = parseCoreIndicators(CORE_FILE);
    console.log(`✓ Core Indicators parsed:`);
    console.log(`  Blood glucose:   ${(ci.bloodGlucoseRate * 100).toFixed(1)}%`);
    console.log(`  Blood pressure:  ${(ci.bloodPressureRate * 100).toFixed(1)}%`);
    console.log(`  Obesity:         ${(ci.obesityRate * 100).toFixed(1)}%`);
    console.log(`  Anemia (women):  ${(ci.anemiaRate * 100).toFixed(1)}%`);
    console.log(`  Cancer incidence:${ci.cancerIncidencePer100k}/100k`);
    console.log(`  NCD mortality:   ${ci.ncdMortalityPer100k}/100k`);
  } catch (e) {
    console.error(`❌ Failed to parse Core Indicators: ${e}`);
    process.exit(1);
  }

  let hosp: HospitalTotals;
  try {
    hosp = parseHospitalTotals(HOSPITAL_FILE);
    console.log(`✓ Hospital Services parsed:`);
    console.log(`  Total visits 2024: ${hosp.totalVisits2024.toLocaleString()}`);
    console.log(
      `  Private:           ${hosp.privateVisits2024.toLocaleString()} (${Math.round((hosp.privateVisits2024 / hosp.totalVisits2024) * 100)}%)`
    );
  } catch (e) {
    console.warn(`⚠ Hospital Services parse error (using fallback): ${e}`);
    hosp = {
      totalVisits2024: 25_642_705,
      privateVisits2024: 19_136_518,
      govVisits2024: 6_506_187,
    };
  }

  let mort: MortalityTotals;
  try {
    mort = parseMortalityTotals(MORTALITY_FILE);
    console.log(`✓ Mortality Data parsed:`);
    console.log(`  Total deaths 2024: ${mort.totalDeaths2024.toLocaleString()}`);
  } catch (e) {
    console.warn(`⚠ Mortality parse error (using fallback): ${e}`);
    mort = { totalDeaths2024: 11_514 };
  }

  console.log("\n🏗  Building gap opportunities...\n");
  const gaps = buildGaps(ci, hosp);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const gap of gaps) {
    try {
      const id = await client.mutation(api.gapOpportunities.create, gap);
      // The mutation returns the same ID if it updated an existing gap
      console.log(`✓ [${gap.therapeuticArea}] ${gap.indication}`);
      console.log(`  → ${id}`);
      created++;
    } catch (e) {
      console.error(`❌ Failed: ${gap.therapeuticArea} / ${gap.indication}`);
      console.error(`   ${e}`);
      failed++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Done. ${created} gaps created/updated, ${failed} failed.`);
  console.log(`\nVerify at your app → /gaps`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
