import { action, internalAction, internalMutation, internalQuery, mutation, MutationCtx, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { contentHash } from "./leadSourceParsers";

export const ENGINE_MARKETS = ["Saudi Arabia", "UAE", "Egypt", "Kuwait", "Qatar", "Algeria"] as const;
export const TARGET_MARKETS = ["Saudi Arabia", "UAE", "Egypt"] as const;

const TOP_20_PHARMA = [
  "Johnson & Johnson",
  "Roche",
  "Merck",
  "Pfizer",
  "AbbVie",
  "Novartis",
  "Bristol Myers Squibb",
  "AstraZeneca",
  "Sanofi",
  "GSK",
  "Takeda",
  "Eli Lilly",
  "Novo Nordisk",
  "Bayer",
  "Amgen",
  "Gilead",
  "Boehringer Ingelheim",
  "Astellas",
  "Daiichi Sankyo",
  "Eisai",
] as const;

const TOP_20_PHARMA_ALIASES = {
  "Johnson & Johnson": ["janssen", "janssen cilag", "johnson johnson", "j&j"],
  Roche: ["genentech", "chugai"],
  Merck: ["msd", "merck sharp dohme"],
  Pfizer: ["wyeth", "hospira"],
  AbbVie: ["allergan"],
  Novartis: ["sandoz"],
  GSK: ["glaxosmithkline"],
  "Bristol Myers Squibb": ["bristol myers", "bristol-myers", "bms", "celgene"],
  "Eli Lilly": ["lilly"],
  "Novo Nordisk": ["novonordisk"],
  Amgen: ["amgen europe"],
  Gilead: ["kite pharma"],
  "Boehringer Ingelheim": ["boehringer"],
  "Daiichi Sankyo": ["daiichi"],
} as const satisfies Record<string, readonly string[]>;

const DEFAULT_SOURCES = [
  {
    sourceRegistry: "drugs_fda",
    title: "Drugs@FDA approvals",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.accessdata.fda.gov/scripts/cder/daf/",
    cadence: "daily" as const,
    parserVersion: "drugs-fda-v1",
    structureSignature: "Drugs@FDA",
  },
  {
    sourceRegistry: "orange_book",
    title: "FDA Orange Book patent and exclusivity data",
    sourceType: "patent_exclusivity" as const,
    baseUrl: "https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files",
    cadence: "monthly" as const,
    parserVersion: "orange-book-v1",
    structureSignature: "Orange Book",
  },
  {
    sourceRegistry: "purple_book",
    title: "FDA Purple Book biologics data",
    sourceType: "patent_exclusivity" as const,
    baseUrl: "https://purplebooksearch.fda.gov/downloads",
    cadence: "monthly" as const,
    parserVersion: "purple-book-v1",
    structureSignature: "Purple Book",
  },
  {
    sourceRegistry: "ema_medicine_downloads",
    title: "EMA EPAR medicine data downloads",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    cadence: "daily" as const,
    parserVersion: "ema-downloads-v1",
    structureSignature: "medicines/download-medicine-data",
  },
  {
    sourceRegistry: "ema_orphan_register",
    title: "EMA orphan designation register",
    sourceType: "orphan_register" as const,
    baseUrl: "https://www.ema.europa.eu/en/medicines/download-medicine-data#orphan-designations-section",
    cadence: "weekly" as const,
    parserVersion: "ema-orphan-v1",
    structureSignature: "orphan",
  },
  {
    sourceRegistry: "ema_article_57",
    title: "EMA Article 57 EEA-authorised medicines",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/data-medicines-iso-idmp-standards-post-authorisation/public-data-article-57-database",
    cadence: "weekly" as const,
    parserVersion: "ema-article57-v1",
    structureSignature: "Article 57",
  },
  {
    sourceRegistry: "ema_sme_register",
    title: "EMA SME register",
    sourceType: "company_rights" as const,
    baseUrl: "https://fmapps.ema.europa.eu/SME/reg_companies.php",
    cadence: "weekly" as const,
    parserVersion: "ema-sme-v1",
    structureSignature: "SME",
  },
  {
    sourceRegistry: "mhra_products",
    title: "MHRA authorised products",
    sourceType: "home_authorization" as const,
    baseUrl: "https://products.mhra.gov.uk/",
    cadence: "weekly" as const,
    parserVersion: "mhra-products-v1",
    structureSignature: "MHRA",
  },
  {
    sourceRegistry: "ema_withdrawals",
    title: "EMA withdrawals and refusals",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.ema.europa.eu/en/medicines/download-medicine-data#withdrawn-applications-section",
    cadence: "weekly" as const,
    parserVersion: "ema-withdrawals-v1",
    structureSignature: "withdrawn",
  },
  {
    sourceRegistry: "sfda_registered_drugs",
    title: "SFDA registered-drug service",
    sourceType: "target_registration" as const,
    baseUrl: "https://www.sfda.gov.sa/en/drugs-list",
    cadence: "daily" as const,
    parserVersion: "sfda-registered-v1",
    structureSignature: "drug",
  },
  {
    sourceRegistry: "sfda_current_shortage",
    title: "SFDA current drug shortage list",
    sourceType: "shortage" as const,
    baseUrl: "https://www.sfda.gov.sa/en/currentlyInShortageList",
    cadence: "daily" as const,
    parserVersion: "saudi-public-v1",
    structureSignature: "shortage",
  },
  {
    sourceRegistry: "sfda_anticipated_shortage",
    title: "SFDA anticipated drug shortage list",
    sourceType: "shortage" as const,
    baseUrl: "https://www.sfda.gov.sa/en/anticipatedShortage",
    cadence: "daily" as const,
    parserVersion: "saudi-public-v1",
    structureSignature: "shortage",
  },
  {
    sourceRegistry: "nupco_tenders",
    title: "NUPCO tenders",
    sourceType: "procurement" as const,
    baseUrl: "https://www.nupco.com/tenders/tenders-list/",
    cadence: "daily" as const,
    parserVersion: "nupco-tenders-v1",
    structureSignature: "tender",
  },
  {
    sourceRegistry: "uae_ede_directory",
    title: "UAE EDE registered product directory",
    sourceType: "target_registration" as const,
    baseUrl: "https://services.ede.gov.ae/drugdirectory?lang=en-US",
    cadence: "daily" as const,
    parserVersion: "ede-directory-v1",
    structureSignature: "drugdirectory",
  },
  {
    sourceRegistry: "abu_dhabi_drug_authorization",
    title: "Abu Dhabi approved and specially authorised drugs",
    sourceType: "procurement" as const,
    baseUrl: "https://www.doh.gov.ae/en/research/Dashboard/Drug-Authorization",
    cadence: "weekly" as const,
    parserVersion: "doh-special-authorisation-v1",
    structureSignature: "Drug Authorization",
  },
  {
    sourceRegistry: "dha_drug_price_list",
    title: "DHA medicine price list",
    sourceType: "target_registration" as const,
    baseUrl: "https://www.dha.gov.ae/ar/HealthRegulationSector/DrugControl",
    cadence: "weekly" as const,
    parserVersion: "dha-price-list-v1",
    structureSignature: "DrugControl",
  },
  {
    sourceRegistry: "egypt_eda_public_search",
    title: "Egypt EDA public registration lookup (targeted checks only)",
    sourceType: "target_registration" as const,
    baseUrl: "https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx",
    cadence: "manual" as const,
    parserVersion: "egypt-eda-targeted-v1",
    structureSignature: "EDASearch",
  },
  {
    sourceRegistry: "egypt_eda_authorized_export",
    title: "Authorized EDA / Pharma Data Hub registration export",
    sourceType: "manual_import" as const,
    baseUrl: "https://edaegypt.gov.eg/en/publications-reports-and-eda-in-numbers/eda-publications/periodic-lists/",
    cadence: "manual" as const,
    parserVersion: "egypt-authorized-import-v1",
    structureSignature: "periodic",
  },
  {
    sourceRegistry: "egypt_eoneps",
    title: "Egypt public procurement opportunities",
    sourceType: "procurement" as const,
    baseUrl: "https://www.eps-gags.gov.eg/pt/sys/movePtIntroduceDetail.do",
    cadence: "daily" as const,
    parserVersion: "egypt-eoneps-v1",
    structureSignature: "procurement",
  },
  {
    sourceRegistry: "company_rights_sources",
    title: "Company BD pages, press releases, and filings",
    sourceType: "company_rights" as const,
    baseUrl: "https://www.sec.gov/edgar/search/",
    cadence: "weekly" as const,
    parserVersion: "company-rights-v1",
    structureSignature: "SEC",
  },
  {
    sourceRegistry: "disease_burden_sources",
    title: "GBD, GLOBOCAN, IDF, and national registries",
    sourceType: "disease_burden" as const,
    baseUrl: "https://gco.iarc.who.int/",
    cadence: "weekly" as const,
    parserVersion: "disease-burden-v1",
    structureSignature: "Global Cancer Observatory",
  },
] as const;

const sourceTypeValidator = v.union(
  v.literal("home_authorization"),
  v.literal("target_registration"),
  v.literal("shortage"),
  v.literal("procurement"),
  v.literal("company_rights"),
  v.literal("manual_import"),
  v.literal("patent_exclusivity"),
  v.literal("orphan_register"),
  v.literal("disease_burden")
);

const cadenceValidator = v.union(v.literal("manual"), v.literal("daily"), v.literal("weekly"), v.literal("monthly"));
const marketValidator = v.union(
  v.literal("Saudi Arabia"),
  v.literal("UAE"),
  v.literal("Egypt"),
  v.literal("Kuwait"),
  v.literal("Qatar"),
  v.literal("Algeria")
);
const reviewStatusValidator = v.union(
  v.literal("open"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("merged")
);

const productClassValidator = v.union(
  v.literal("innovator"),
  v.literal("on_patent"),
  v.literal("orphan_rare_disease"),
  v.literal("hybrid"),
  v.literal("off_patent_biosimilar")
);

const sizingInputStatusValidator = v.union(
  v.literal("official_source"),
  v.literal("company_release"),
  v.literal("literature"),
  v.literal("practitioner_estimate"),
  v.literal("unvalidated")
);

function normalize(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalMarket(value: string): (typeof ENGINE_MARKETS)[number] | null {
  return ENGINE_MARKETS.find((market) => normalize(market) === normalize(value)) ?? null;
}

function nextFetchAt(cadence: "manual" | "daily" | "weekly" | "monthly", now: number) {
  if (cadence === "manual") return undefined;
  const days = cadence === "daily" ? 1 : cadence === "weekly" ? 7 : 30;
  return now + days * 24 * 60 * 60 * 1000;
}

function userAgent() {
  const contact = process.env.KEMEDICA_CRAWLER_CONTACT_EMAIL ?? "research@kemedica.com";
  return `KEMEDICA-market-access-bot/1.0 (mailto:${contact})`;
}

function isTop20Company(companyName?: string | null) {
  const normalizedCompany = normalize(companyName);
  if (!normalizedCompany) return { isTop20: false };
  const parent = TOP_20_PHARMA.find((name) => {
    const normalizedParent = normalize(name);
    return normalizedCompany === normalizedParent || normalizedCompany.includes(normalizedParent);
  });
  if (parent) return { isTop20: true, parent };
  const aliasParent = Object.entries(TOP_20_PHARMA_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalizedCompany.includes(normalize(alias)))
  )?.[0];
  return { isTop20: Boolean(aliasParent), parent: aliasParent };
}

export function isTop20OwnerName(companyName?: string | null) {
  return isTop20Company(companyName).isTop20;
}

export function canMarkVerifiedAbsent(args: {
  status: string;
  searchedNames: string[];
  searchedInnVariants: string[];
  officialRegistry?: string | null;
}) {
  return (
    args.status === "not_registered" &&
    args.searchedNames.length > 0 &&
    args.searchedInnVariants.length > 0 &&
    Boolean(args.officialRegistry?.trim())
  );
}

function parseRevenueRange(value?: string | null) {
  const text = value ?? "";
  const numbers = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (numbers.length === 0) return { low: 0, high: 0 };
  const multiplier = /(?:\d\s*bn\b|\bbillion\b)/i.test(text)
    ? 1_000_000_000
    : /(?:\d\s*m\b|\bmillion\b)/i.test(text)
      ? 1_000_000
      : 1;
  const low = numbers[0] * multiplier;
  const high = (numbers[1] ?? numbers[0]) * multiplier;
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

export function defaultMarketMarginRate(country: string) {
  const market = canonicalMarket(country);
  if (market === "Egypt") return 28;
  if (market === "Saudi Arabia") return 32;
  if (market === "UAE") return 35;
  return 30;
}

export function calculatePeakSales(args: {
  eligiblePatients: number;
  diagnosedReachableRate: number;
  brandedTreatmentRate: number;
  kemedicaShareRate: number;
  netPricePerPatientYearUsd: number;
}) {
  return Math.round(
    args.eligiblePatients *
      (args.diagnosedReachableRate / 100) *
      (args.brandedTreatmentRate / 100) *
      (args.kemedicaShareRate / 100) *
      args.netPricePerPatientYearUsd
  );
}

export function calculateRiskAdjustedMargin(args: {
  peakSalesUsd: number;
  marketMarginRate: number;
  licenseSignedProbability: number;
  registrationGrantedProbability: number;
}) {
  return Math.round(
    args.peakSalesUsd *
      (args.marketMarginRate / 100) *
      (args.licenseSignedProbability / 100) *
      (args.registrationGrantedProbability / 100)
  );
}

const SCREENING_FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  AED: 0.2723,
  SAR: 0.2667,
  EGP: 0.0207,
  QAR: 0.2747,
  KWD: 3.25,
  DZD: 0.0075,
};

export function deriveInternationalPriceAnchorForTest(priceRows: Array<{
  amount: number;
  currency: string;
  country: string;
  priceType: string;
  sourceCategory: string;
}>) {
  const eligibleTypes = new Set(["registered", "list", "tariff", "reimbursement", "hospital", "retail"]);
  const anchors = priceRows
    .filter((row) => eligibleTypes.has(row.priceType))
    .map((row) => {
      const fx = SCREENING_FX_TO_USD[row.currency.toUpperCase()];
      if (!fx || row.amount <= 0) return null;
      return {
        amountUsd: row.amount * fx,
        country: row.country,
        currency: row.currency.toUpperCase(),
        priceType: row.priceType,
        sourceCategory: row.sourceCategory,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (anchors.length === 0) return null;
  const sorted = [...anchors].sort((left, right) => left.amountUsd - right.amountUsd);
  const trimmed = sorted.length > 4 ? sorted.slice(1, -1) : sorted;
  const averageUsd = Math.round(trimmed.reduce((sum, row) => sum + row.amountUsd, 0) / trimmed.length);
  const countries = [...new Set(anchors.map((row) => row.country))].sort();
  const currencies = [...new Set(anchors.map((row) => row.currency))].sort();
  const officialCount = anchors.filter((row) => row.sourceCategory === "official").length;
  return { averageUsd, count: anchors.length, countries, currencies, officialCount };
}

function deriveInternationalPriceAnchor(priceRows: Doc<"priceEvidence">[]) {
  return deriveInternationalPriceAnchorForTest(priceRows);
}

function deriveSizingDefaults(args: {
  country: (typeof ENGINE_MARKETS)[number];
  opportunity: Doc<"decisionOpportunities">;
  priceAnchor?: ReturnType<typeof deriveInternationalPriceAnchor>;
}) {
  if (args.priceAnchor && args.priceAnchor.averageUsd > 0) {
    return {
      eligiblePatients: 250,
      diagnosedReachableRate: 45,
      brandedTreatmentRate: 30,
      kemedicaShareRate: 12,
      netPricePerPatientYearUsd: args.priceAnchor.averageUsd,
      marketMarginRate: defaultMarketMarginRate(args.country),
      licenseSignedProbability: 35,
      registrationGrantedProbability: 60,
      inputStatus: "international_price_anchor" as const,
      basis: `Average international registered/list price anchor: ${args.priceAnchor.count} record(s), ${args.priceAnchor.officialCount} official, currencies ${args.priceAnchor.currencies.join(", ")}, countries ${args.priceAnchor.countries.join(", ")}. Patient/reach/share rates remain practitioner estimates.`,
    };
  }
  return {
    eligiblePatients: 0,
    diagnosedReachableRate: 0,
    brandedTreatmentRate: 0,
    kemedicaShareRate: 0,
    netPricePerPatientYearUsd: 0,
    marketMarginRate: defaultMarketMarginRate(args.country),
    licenseSignedProbability: 0,
    registrationGrantedProbability: 0,
    inputStatus: "unvalidated" as const,
    basis: "UNVALIDATED: no product-specific eligible patient, rate, share, and net-price sizing row is stored yet.",
  };
}

function classifyProduct(args: {
  drug: Doc<"drugs"> | null;
  opportunity: Doc<"decisionOpportunities">;
  evidenceText: string;
}) {
  const text = normalize(
    `${args.drug?.category ?? ""} ${args.drug?.productProfile?.productFamily ?? ""} ${args.drug?.therapeuticArea ?? ""} ${args.evidenceText}`
  );
  if (/orphan|rare/.test(text)) return "orphan_rare_disease" as const;
  if (/biosimilar|off patent|off-patent/.test(text)) return "off_patent_biosimilar" as const;
  if (/hybrid/.test(text)) return "hybrid" as const;
  if (args.drug?.patentExpiryYear && args.drug.patentExpiryYear >= new Date().getFullYear()) return "on_patent" as const;
  return "innovator" as const;
}

function registryStatusMatrix(drug: Doc<"drugs"> | null) {
  const hasRegistration = (country: string) =>
    (drug?.menaRegistrations ?? []).some(
      (registration) =>
        normalize(registration.country) === normalize(country) && registration.status === "registered"
    );
  return {
    fda: drug?.approvalStatus === "approved" ? ("registered" as const) : ("unknown" as const),
    ema: drug?.emaApprovalDate || drug?.approvalDate ? ("registered" as const) : ("unknown" as const),
    bfarm: "unknown" as const,
    sfda: hasRegistration("Saudi Arabia") ? ("registered" as const) : ("unknown" as const),
    mohap: hasRegistration("UAE") ? ("registered" as const) : ("unknown" as const),
    eda: hasRegistration("Egypt") ? ("registered" as const) : ("unknown" as const),
  };
}

export function calculateModel1ExpectedValue(args: {
  annualOpportunityRange?: string | null;
  grossMarginPct: number;
  tenderDiscountPct: number;
  registrationCostUsd: number;
  annualPvCostUsd: number;
  workingCapitalPct: number;
  probabilityOfSuccessPct: number;
}) {
  const range = parseRevenueRange(args.annualOpportunityRange);
  const midpoint = (range.low + range.high) / 2;
  const discountedRevenue = midpoint * (1 - args.tenderDiscountPct / 100);
  const grossProfit = discountedRevenue * (args.grossMarginPct / 100);
  const workingCapitalCharge = discountedRevenue * (args.workingCapitalPct / 100);
  const operatingProfit = grossProfit - args.registrationCostUsd - args.annualPvCostUsd - workingCapitalCharge;
  return Math.round(operatingProfit * (args.probabilityOfSuccessPct / 100));
}

export function calculateModel4ExpectedValue(args: {
  annualOpportunityRange?: string | null;
  successFeePct: number;
  sublicenseRoyaltyPct: number;
  operatingCostUsd: number;
  probabilityOfSuccessPct: number;
}) {
  const range = parseRevenueRange(args.annualOpportunityRange);
  const midpoint = (range.low + range.high) / 2;
  const revenueShare = midpoint * ((args.successFeePct + args.sublicenseRoyaltyPct) / 100);
  return Math.round((revenueShare - args.operatingCostUsd) * (args.probabilityOfSuccessPct / 100));
}

function targetRegisteredMarkets(drug: Doc<"drugs"> | null, opportunity: Doc<"decisionOpportunities">) {
  const fromDrug = (drug?.menaRegistrations ?? [])
    .filter((registration) => registration.status === "registered")
    .map((registration) => canonicalMarket(registration.country))
    .filter((market): market is (typeof ENGINE_MARKETS)[number] => Boolean(market));
  const blocked = (opportunity.blockedFocusMarkets ?? [])
    .map(canonicalMarket)
    .filter((market): market is (typeof ENGINE_MARKETS)[number] => Boolean(market));
  return [...new Set([...fromDrug, ...blocked].filter((market) => TARGET_MARKETS.includes(market as never)))];
}

function gateReasons(args: {
  opportunity: Doc<"decisionOpportunities">;
  drug: Doc<"drugs"> | null;
  company: Doc<"companies"> | null;
  registeredTargetMarkets: string[];
  isTop20: boolean;
  menaRightsLicensed: boolean;
  belowMarginFloor: boolean;
  distributionInfeasible: boolean;
}) {
  const reasons: string[] = [];
  const hasHomeAuthorization =
    args.drug?.approvalStatus === "approved" ||
    Boolean(args.drug?.approvalDate || args.drug?.emaApprovalDate);
  const companyKnown = Boolean(args.company || args.opportunity.approachEntityName || args.opportunity.manufacturerName);
  const demandEvidence = Boolean(args.opportunity.demandProxy || args.opportunity.marketSizeEstimate);
  if (!hasHomeAuthorization) reasons.push("Home authorization is not yet validated from FDA/EMA/BfArM evidence.");
  if (!companyKnown) reasons.push("Owner, manufacturer, or MAH is not known.");
  if (args.isTop20) reasons.push("Owner matches the maintained top-20 pharma exclusion list.");
  if (args.menaRightsLicensed) reasons.push("MENA rights already appear licensed or unavailable.");
  if (args.drug?.approvalStatus === "withdrawn") reasons.push("Product is withdrawn or suspended.");
  if (args.registeredTargetMarkets.length > 0) {
    reasons.push(`Already registered in ${args.registeredTargetMarkets.join(", ")}.`);
  }
  if (args.belowMarginFloor) reasons.push("Risk-adjusted margin is below the active floor.");
  if (args.distributionInfeasible) reasons.push("Distribution or market-entry route is currently infeasible.");
  if (!demandEvidence) reasons.push("Demand evidence or commercial sizing signal is missing.");
  return reasons;
}

async function insertChangeEventWithInAppDelivery(
  ctx: MutationCtx,
  event: Omit<Doc<"changeEvents">, "_id" | "_creationTime">
) {
  const eventId = await ctx.db.insert("changeEvents", event);
  const now = Date.now();
  await ctx.db.insert("alertDeliveries", {
    changeEventId: eventId,
    channel: "in_app",
    status: "sent",
    destination: "KEMEDICA app",
    retryCount: 0,
    sentAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("alertDeliveries", {
    changeEventId: eventId,
    channel: "email_digest",
    status: process.env.KEMEDICA_EMAIL_DIGEST_WEBHOOK_URL ? "pending" : "skipped",
    destination: process.env.KEMEDICA_EMAIL_DIGEST_WEBHOOK_URL ? "configured email digest webhook" : "not configured",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("alertDeliveries", {
    changeEventId: eventId,
    channel: "teams_webhook",
    status: process.env.KEMEDICA_TEAMS_WEBHOOK_URL ? "pending" : "skipped",
    destination: process.env.KEMEDICA_TEAMS_WEBHOOK_URL ? "configured Teams webhook" : "not configured",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return eventId;
}

export const seedSourceRegistry = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const seeded: Id<"sourceRegistries">[] = [];
    for (const source of DEFAULT_SOURCES) {
      const existing = await ctx.db
        .query("sourceRegistries")
        .withIndex("by_source_registry", (q) => q.eq("sourceRegistry", source.sourceRegistry))
        .unique();
      const doc = {
        ...source,
        status: "active" as const,
        userAgent: userAgent(),
        contactEmail: process.env.KEMEDICA_CRAWLER_CONTACT_EMAIL ?? "research@kemedica.com",
        rateLimitPerMinute: 12,
        staleAfterMs: (
          source.cadence === "monthly" ? 45 :
            source.cadence === "weekly" ? 14 :
              source.cadence === "manual" ? 30 : 3
        ) * 24 * 60 * 60 * 1000,
        nextFetchAt: nextFetchAt(source.cadence, now),
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        seeded.push(existing._id);
      } else {
        seeded.push(await ctx.db.insert("sourceRegistries", { ...doc, createdAt: now }));
      }
    }
    return { seeded: seeded.length };
  },
});

export const listSourceHealth = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("sourceRegistries").withIndex("by_source_registry").take(100),
});

export const listChangeEvents = query({
  args: { status: v.optional(v.union(v.literal("new"), v.literal("acknowledged"), v.literal("resolved"))), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = args.status
      ? await ctx.db
          .query("changeEvents")
          .withIndex("by_status_and_created_at", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(args.limit ?? 50)
      : await ctx.db.query("changeEvents").withIndex("by_status_and_created_at").order("desc").take(args.limit ?? 50);
    return rows;
  },
});

export const listAlertDeliveries = query({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("sent"), v.literal("skipped"), v.literal("failed"))), limit: v.optional(v.number()) },
  handler: async (ctx, args) =>
    args.status
      ? await ctx.db.query("alertDeliveries").withIndex("by_status", (q) => q.eq("status", args.status!)).take(args.limit ?? 50)
      : await ctx.db.query("alertDeliveries").withIndex("by_status").take(args.limit ?? 50),
});

export const listPendingAlertDeliveries = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("alertDeliveries").withIndex("by_status", (q) => q.eq("status", "pending")).take(20),
});

export const getChangeEventForDelivery = internalQuery({
  args: { id: v.id("changeEvents") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const markAlertDelivery = internalMutation({
  args: {
    id: v.id("alertDeliveries"),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    if (!current) return;
    await ctx.db.patch(args.id, {
      status: args.status,
      lastError: args.lastError,
      retryCount: args.status === "failed" ? current.retryCount + 1 : current.retryCount,
      sentAt: args.status === "sent" ? Date.now() : current.sentAt,
      updatedAt: Date.now(),
    });
  },
});

export const listWatchlist = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("watchlistItems").withIndex("by_status", (q) => q.eq("status", "tracked")).take(100),
});

export const trackSubstance = mutation({
  args: {
    drugId: v.optional(v.id("drugs")),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    inn: v.string(),
    productName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    reason: v.string(),
    targetMarkets: v.array(marketValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const substanceKey = normalize(args.inn || args.productName);
    return await ctx.db.insert("watchlistItems", {
      ...args,
      substanceKey,
      status: "tracked",
      alertOnRegistration: true,
      alertOnRights: true,
      alertOnThreshold: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listReviewQueue = query({
  args: { status: v.optional(reviewStatusValidator), limit: v.optional(v.number()) },
  handler: async (ctx, args) =>
    await ctx.db
      .query("reviewQueueItems")
      .withIndex("by_status_and_created_at", (q) => q.eq("status", args.status ?? "open"))
      .order("desc")
      .take(args.limit ?? 50),
});

export const resolveReviewItem = mutation({
  args: {
    id: v.id("reviewQueueItems"),
    status: reviewStatusValidator,
    reviewedBy: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewedBy: args.reviewedBy,
      reviewedAt: Date.now(),
      reviewNote: args.reviewNote,
      updatedAt: Date.now(),
    });
  },
});

export const getLatestRunDashboard = query({
  args: {},
  handler: async (ctx) => {
    const run = (await ctx.db.query("opportunityRuns").withIndex("by_started_at").order("desc").take(1))[0] ?? null;
    const items = run
      ? await ctx.db.query("opportunityRunItems").withIndex("by_run_and_ranking_position", (q) => q.eq("runId", run._id)).take(50)
      : [];
    return { run, items };
  },
});

export const getScreeningDashboard = query({
  args: {
    targetMarket: v.optional(marketValidator),
    productClass: v.optional(productClassValidator),
    exclusions: v.optional(v.object({
      alreadyRegisteredTarget: v.boolean(),
      top20Pharma: v.boolean(),
      menaRightsLicensed: v.boolean(),
      withdrawnOrSuspended: v.boolean(),
      belowMarginFloor: v.boolean(),
      distributionInfeasible: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const run = (await ctx.db.query("opportunityRuns").withIndex("by_started_at").order("desc").take(1))[0] ?? null;
    const items = run
      ? await ctx.db.query("opportunityRunItems").withIndex("by_run", (q) => q.eq("runId", run._id)).take(500)
      : [];
    const defaults = {
      alreadyRegisteredTarget: true,
      top20Pharma: true,
      menaRightsLicensed: true,
      withdrawnOrSuspended: true,
      belowMarginFloor: true,
      distributionInfeasible: true,
    };
    const itemExclusionFlags = (item: Doc<"opportunityRunItems">) =>
      item.exclusionFlags ?? {
        alreadyRegisteredTarget: item.registeredTargetMarkets.length > 0,
        top20Pharma: item.isTop20Excluded,
        menaRightsLicensed: item.territoryRightsStatus === "LICENSED_OR_UNAVAILABLE",
        withdrawnOrSuspended: false,
        belowMarginFloor: false,
        distributionInfeasible: false,
      };
    const exclusions = args.exclusions ?? defaults;
    const marketFiltered = args.targetMarket
      ? items.filter((item) => item.targetMarkets.includes(args.targetMarket!))
      : items;
    const classFiltered = args.productClass
      ? marketFiltered.filter((item) => item.productClass === args.productClass)
      : marketFiltered;
    const cascade = {
      candidateUniverse: items.length,
      afterMarketFilter: marketFiltered.length,
      afterProductClassFilter: classFiltered.length,
      removedAlreadyRegistered: classFiltered.filter((item) => itemExclusionFlags(item).alreadyRegisteredTarget).length,
      removedTop20: classFiltered.filter((item) => itemExclusionFlags(item).top20Pharma).length,
      removedRightsLicensed: classFiltered.filter((item) => itemExclusionFlags(item).menaRightsLicensed).length,
      removedWithdrawnSuspended: classFiltered.filter((item) => itemExclusionFlags(item).withdrawnOrSuspended).length,
      removedBelowMarginFloor: classFiltered.filter((item) => itemExclusionFlags(item).belowMarginFloor).length,
      removedDistributionInfeasible: classFiltered.filter((item) => itemExclusionFlags(item).distributionInfeasible).length,
    };
    const filtered = classFiltered
      .filter((item) => !exclusions.alreadyRegisteredTarget || !itemExclusionFlags(item).alreadyRegisteredTarget)
      .filter((item) => !exclusions.top20Pharma || !itemExclusionFlags(item).top20Pharma)
      .filter((item) => !exclusions.menaRightsLicensed || !itemExclusionFlags(item).menaRightsLicensed)
      .filter((item) => !exclusions.withdrawnOrSuspended || !itemExclusionFlags(item).withdrawnOrSuspended)
      .filter((item) => !exclusions.belowMarginFloor || !itemExclusionFlags(item).belowMarginFloor)
      .filter((item) => !exclusions.distributionInfeasible || !itemExclusionFlags(item).distributionInfeasible)
      .sort((left, right) => right.riskAdjustedMargin - left.riskAdjustedMargin)
      .slice(0, 50);
    return { run, cascade: { ...cascade, visible: filtered.length }, items: filtered };
  },
});

export const getDealEconomics = query({
  args: { decisionOpportunityId: v.id("decisionOpportunities") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("dealEconomicsScenarios")
      .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
      .take(20),
});

export const getAssetExportPayload = query({
  args: { decisionOpportunityId: v.id("decisionOpportunities") },
  handler: async (ctx, args) => {
    const opportunity = await ctx.db.get(args.decisionOpportunityId);
    if (!opportunity) return null;
    const [drug, company, reportData, sizingInputs, dealScenarios, runItems, evidence] = await Promise.all([
      ctx.db.get(opportunity.drugId),
      opportunity.companyId ? ctx.db.get(opportunity.companyId) : null,
      ctx.db
        .query("mandateOpportunityReports")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
        .unique(),
      ctx.db
        .query("opportunitySizingInputs")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
        .take(20),
      ctx.db
        .query("dealEconomicsScenarios")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
        .take(20),
      ctx.db
        .query("opportunityRunItems")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
        .take(20),
      ctx.db
        .query("opportunityEvidence")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
        .take(20),
    ]);
    const runItem = [...runItems].sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
    return {
      opportunity,
      drug,
      company,
      mandateReport: reportData,
      sizingInputs,
      dealScenarios,
      runItem,
      latestRunItem: runItem,
      evidence,
      generatedAt: Date.now(),
    };
  },
});

export const getMarketFile = query({
  args: { country: marketValidator },
  handler: async (ctx, args) =>
    await ctx.db.query("marketFiles").withIndex("by_country", (q) => q.eq("country", args.country)).unique(),
});

export const listMarketFiles = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("marketFiles").withIndex("by_country").take(20),
});

export const listSizingInputs = query({
  args: { decisionOpportunityId: v.id("decisionOpportunities") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("opportunitySizingInputs")
      .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
      .take(20),
});

export const upsertSizingInput = mutation({
  args: {
    decisionOpportunityId: v.id("decisionOpportunities"),
    country: marketValidator,
    eligiblePatients: v.number(),
    diagnosedReachableRate: v.number(),
    brandedTreatmentRate: v.number(),
    kemedicaShareRate: v.number(),
    netPricePerPatientYearUsd: v.number(),
    marketMarginRate: v.number(),
    licenseSignedProbability: v.number(),
    registrationGrantedProbability: v.number(),
    inputStatus: sizingInputStatusValidator,
    basis: v.string(),
  },
  handler: async (ctx, args) => {
    const opportunity = await ctx.db.get(args.decisionOpportunityId);
    if (!opportunity) throw new Error("Opportunity not found");
    const now = Date.now();
    let registry = await ctx.db
      .query("sourceRegistries")
      .withIndex("by_source_registry", (q) => q.eq("sourceRegistry", "manual_sizing_inputs"))
      .unique();
    if (!registry) {
      const registryId = await ctx.db.insert("sourceRegistries", {
        sourceRegistry: "manual_sizing_inputs",
        title: "Manual sizing assumptions",
        sourceType: "manual_import",
        baseUrl: "internal://manual-sizing-inputs",
        cadence: "manual",
        status: "active",
        parserVersion: "manual-sizing-v1",
        userAgent: "internal",
        contactEmail: "internal",
        rateLimitPerMinute: 1,
        staleAfterMs: 0,
        createdAt: now,
        updatedAt: now,
      });
      registry = (await ctx.db.get(registryId))!;
    }
    const sourceFetchId = await ctx.db.insert("sourceFetches", {
      sourceRegistryId: registry._id,
      sourceRegistry: "manual_sizing_inputs",
      sourceUrl: "internal://manual-sizing-inputs",
      fetchedAt: now,
      sourceType: "sizing_input",
      httpStatus: 200,
      ok: true,
      contentHash: contentHash(JSON.stringify(args)),
      rawPayload: JSON.stringify(args),
      parserVersion: "manual-sizing-v1",
      structureStatus: "passed",
      robotsAllowed: true,
      createdAt: now,
    });
    const existing = (
      await ctx.db
        .query("opportunitySizingInputs")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
        .take(20)
    ).find((row) => row.country === args.country);
    const doc = {
      decisionOpportunityId: args.decisionOpportunityId,
      drugId: opportunity.drugId,
      country: args.country,
      eligiblePatients: args.eligiblePatients,
      diagnosedReachableRate: args.diagnosedReachableRate,
      brandedTreatmentRate: args.brandedTreatmentRate,
      kemedicaShareRate: args.kemedicaShareRate,
      netPricePerPatientYearUsd: args.netPricePerPatientYearUsd,
      marketMarginRate: args.marketMarginRate,
      licenseSignedProbability: args.licenseSignedProbability,
      registrationGrantedProbability: args.registrationGrantedProbability,
      inputStatus: args.inputStatus,
      basis: args.basis,
      sourceUrl: "internal://manual-sizing-inputs",
      fetchedAt: now,
      sourceRegistry: "manual_sizing_inputs",
      sourceFetchId,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("opportunitySizingInputs", { ...doc, createdAt: now });
  },
});

export const importSubstanceCrosswalk = mutation({
  args: {
    rows: v.array(v.object({
      substanceKey: v.string(),
      sourceSystem: v.union(v.literal("rxnorm"), v.literal("atc"), v.literal("inn"), v.literal("internal")),
      sourceCode: v.string(),
      displayName: v.string(),
      normalizedName: v.string(),
      synonymType: v.union(v.literal("preferred"), v.literal("synonym"), v.literal("salt"), v.literal("combination")),
    })),
    sourceRegistry: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sourceRegistryName = args.sourceRegistry ?? "manual_substance_crosswalk";
    const sourceUrl = args.sourceUrl ?? "internal://manual-substance-crosswalk";
    let registry = await ctx.db
      .query("sourceRegistries")
      .withIndex("by_source_registry", (q) => q.eq("sourceRegistry", sourceRegistryName))
      .unique();
    if (!registry) {
      const registryId = await ctx.db.insert("sourceRegistries", {
        sourceRegistry: sourceRegistryName,
        title: "Manual substance crosswalk import",
        sourceType: "manual_import",
        baseUrl: sourceUrl,
        cadence: "manual",
        status: "active",
        parserVersion: "substance-crosswalk-v1",
        userAgent: "internal",
        contactEmail: "internal",
        rateLimitPerMinute: 1,
        staleAfterMs: 0,
        createdAt: now,
        updatedAt: now,
      });
      registry = (await ctx.db.get(registryId))!;
    }
    const sourceFetchId = await ctx.db.insert("sourceFetches", {
      sourceRegistryId: registry._id,
      sourceRegistry: sourceRegistryName,
      sourceUrl,
      fetchedAt: now,
      sourceType: "substance_crosswalk",
      httpStatus: 200,
      ok: true,
      contentHash: contentHash(JSON.stringify(args.rows)),
      rawPayload: JSON.stringify(args.rows),
      parserVersion: "substance-crosswalk-v1",
      structureStatus: "passed",
      robotsAllowed: true,
      createdAt: now,
    });
    let inserted = 0;
    let updated = 0;
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("substanceCrosswalks")
        .withIndex("by_source_system_and_source_code", (q) =>
          q.eq("sourceSystem", row.sourceSystem).eq("sourceCode", row.sourceCode)
        )
        .unique();
      const doc = {
        ...row,
        substanceKey: normalize(row.substanceKey),
        normalizedName: normalize(row.normalizedName),
        sourceUrl,
        fetchedAt: now,
        sourceRegistry: sourceRegistryName,
        sourceFetchId,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        updated += 1;
      } else {
        await ctx.db.insert("substanceCrosswalks", { ...doc, createdAt: now });
        inserted += 1;
      }
    }
    return { inserted, updated, sourceFetchId };
  },
});

export const listSubstanceCrosswalks = query({
  args: {
    substanceKey: v.optional(v.string()),
    normalizedName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.substanceKey) {
      return await ctx.db
        .query("substanceCrosswalks")
        .withIndex("by_substance_key", (q) => q.eq("substanceKey", normalize(args.substanceKey!)))
        .take(args.limit ?? 50);
    }
    if (args.normalizedName) {
      return await ctx.db
        .query("substanceCrosswalks")
        .withIndex("by_normalized_name", (q) => q.eq("normalizedName", normalize(args.normalizedName!)))
        .take(args.limit ?? 50);
    }
    return await ctx.db.query("substanceCrosswalks").take(args.limit ?? 50);
  },
});

export const getRegistryStatusBySubstance = query({
  args: { substanceKey: v.string() },
  handler: async (ctx, args) => {
    const key = normalize(args.substanceKey);
    const crosswalks = await ctx.db
      .query("substanceCrosswalks")
      .withIndex("by_substance_key", (q) => q.eq("substanceKey", key))
      .take(50);
    const products = await ctx.db
      .query("substanceFacts")
      .withIndex("by_substance_key", (q) => q.eq("substanceKey", key))
      .take(100);
    const statuses = products.map((product) => ({
      productId: product._id,
      inn: product.inn,
      registry: product.sourceRegistry,
      status: product.matchStatus,
      sourceUrl: product.sourceUrl,
    }));
    return {
      substanceKey: key,
      crosswalks,
      matrix: {
        fda: statuses.find((status) => status.registry.includes("fda"))?.status ?? "UNKNOWN",
        ema: statuses.find((status) => status.registry.includes("ema"))?.status ?? "UNKNOWN",
        bfarm: statuses.find((status) => status.registry.includes("bfarm"))?.status ?? "UNKNOWN",
        sfda: statuses.find((status) => status.registry.includes("sfda"))?.status ?? "UNKNOWN",
        mohap: statuses.find((status) => status.registry.includes("mohap") || status.registry.includes("uae"))?.status ?? "UNKNOWN",
        eda: statuses.find((status) => status.registry.includes("eda") || status.registry.includes("egypt"))?.status ?? "UNKNOWN",
      },
      statuses,
    };
  },
});

export const ensureMarketFiles = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let registry = await ctx.db
      .query("sourceRegistries")
      .withIndex("by_source_registry", (q) => q.eq("sourceRegistry", "internal_market_files"))
      .unique();
    if (!registry) {
      const registryId = await ctx.db.insert("sourceRegistries", {
        sourceRegistry: "internal_market_files",
        title: "Internal market file defaults",
        sourceType: "manual_import",
        baseUrl: "internal://market-files",
        cadence: "manual",
        status: "active",
        parserVersion: "market-file-defaults-v1",
        userAgent: "internal",
        contactEmail: "internal",
        rateLimitPerMinute: 1,
        staleAfterMs: 0,
        createdAt: now,
        updatedAt: now,
      });
      registry = (await ctx.db.get(registryId))!;
    }
    const fetchId = await ctx.db.insert("sourceFetches", {
      sourceRegistryId: registry._id,
      sourceRegistry: "internal_market_files",
      sourceUrl: "internal://market-files",
      fetchedAt: now,
      sourceType: "market_file_defaults",
      httpStatus: 200,
      ok: true,
      contentHash: String(now),
      rawPayload: JSON.stringify({ markets: ENGINE_MARKETS }),
      parserVersion: "market-file-defaults-v1",
      structureStatus: "passed",
      robotsAllowed: true,
      createdAt: now,
    });
    const defaults = {
      "Saudi Arabia": {
        registrationRoute: "SFDA product registration with local authorized representation, dossier review, pricing, and import controls to validate by product class.",
        typicalTimeline: "Timeline requires current SFDA validation; use this as a planning placeholder only.",
        pricingRules: "Regulated pricing and public tender dynamics should be modeled before outreach.",
        tenderCalendar: "NUPCO and Etimad monitoring are priority signals.",
        competitorRegistrationSummary: "Use SFDA registration and shortage evidence before marking a gap.",
      },
      UAE: {
        registrationRoute: "EDE/MOHAP registration or official import/price-list evidence is required; web search is context only.",
        typicalTimeline: "Timeline requires local RA validation for product category and dossier route.",
        pricingRules: "Official UAE price-list evidence should anchor list price assumptions where available.",
        tenderCalendar: "Hospital/import routes may matter alongside public purchasing signals.",
        competitorRegistrationSummary: "Accept official EDE/MOHAP registry or price-list evidence as registration truth.",
      },
      Egypt: {
        registrationRoute: "EDA registration path with conservative manual-review support for legacy registry checks.",
        typicalTimeline: "Timeline requires product-class and pricing-route validation.",
        pricingRules: "Pricing and currency sensitivity should be treated as a high-risk commercial assumption.",
        tenderCalendar: "Egypt e-procurement monitoring is a priority demand signal.",
        competitorRegistrationSummary: "Use EDA registry evidence before marking verified absence.",
      },
      Kuwait: {
        registrationRoute: "National registration with local partner and public/private access route validation.",
        typicalTimeline: "Timeline requires local regulatory validation.",
        pricingRules: "Reference pricing and institutional procurement assumptions need validation.",
        tenderCalendar: "Monitor as secondary follow-on market.",
        competitorRegistrationSummary: "Secondary-market competitor checks remain manual in MVP.",
      },
      Qatar: {
        registrationRoute: "National registration and institutional access route validation.",
        typicalTimeline: "Timeline requires local regulatory validation.",
        pricingRules: "Pricing assumptions should be benchmarked against GCC evidence.",
        tenderCalendar: "Monitor as secondary follow-on market.",
        competitorRegistrationSummary: "Secondary-market competitor checks remain manual in MVP.",
      },
      Algeria: {
        registrationRoute: "National registration and pricing access route validation.",
        typicalTimeline: "Timeline requires local regulatory validation.",
        pricingRules: "Pricing and import economics require country-specific validation.",
        tenderCalendar: "Monitor as secondary follow-on market.",
        competitorRegistrationSummary: "Secondary-market competitor checks remain manual in MVP.",
      },
    } satisfies Record<(typeof ENGINE_MARKETS)[number], {
      registrationRoute: string;
      typicalTimeline: string;
      pricingRules: string;
      tenderCalendar: string;
      competitorRegistrationSummary: string;
    }>;
    for (const country of ENGINE_MARKETS) {
      const existing = await ctx.db.query("marketFiles").withIndex("by_country", (q) => q.eq("country", country)).unique();
      const doc = {
        country,
        ...defaults[country],
        lastReviewedAt: now,
        sourceUrl: "internal://market-files",
        fetchedAt: now,
        sourceRegistry: "internal_market_files",
        sourceFetchId: fetchId,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
      } else {
        await ctx.db.insert("marketFiles", { ...doc, createdAt: now });
      }
    }
    return { seeded: ENGINE_MARKETS.length };
  },
});

export const upsertSourceRegistry = mutation({
  args: {
    sourceRegistry: v.string(),
    title: v.string(),
    sourceType: sourceTypeValidator,
    baseUrl: v.string(),
    robotsUrl: v.optional(v.string()),
    cadence: cadenceValidator,
    parserVersion: v.string(),
    structureSignature: v.optional(v.string()),
    rateLimitPerMinute: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sourceRegistries")
      .withIndex("by_source_registry", (q) => q.eq("sourceRegistry", args.sourceRegistry))
      .unique();
    const doc = {
      ...args,
      status: "active" as const,
      userAgent: userAgent(),
      contactEmail: process.env.KEMEDICA_CRAWLER_CONTACT_EMAIL ?? "research@kemedica.com",
      rateLimitPerMinute: args.rateLimitPerMinute ?? 12,
      staleAfterMs: (args.cadence === "weekly" ? 14 : 3) * 24 * 60 * 60 * 1000,
      nextFetchAt: nextFetchAt(args.cadence, now),
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("sourceRegistries", { ...doc, createdAt: now });
  },
});

export const ingestManualSourceFetch = mutation({
  args: {
    sourceRegistry: v.string(),
    sourceUrl: v.string(),
    sourceType: v.string(),
    rawPayload: v.string(),
    parserVersion: v.optional(v.string()),
    structureMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let registry = await ctx.db
      .query("sourceRegistries")
      .withIndex("by_source_registry", (q) => q.eq("sourceRegistry", args.sourceRegistry))
      .unique();
    if (!registry) {
      const registryId = await ctx.db.insert("sourceRegistries", {
        sourceRegistry: args.sourceRegistry,
        title: args.sourceRegistry.replaceAll("_", " "),
        sourceType: "manual_import",
        baseUrl: args.sourceUrl,
        cadence: "manual",
        status: "active",
        parserVersion: args.parserVersion ?? "manual-v1",
        userAgent: userAgent(),
        contactEmail: process.env.KEMEDICA_CRAWLER_CONTACT_EMAIL ?? "research@kemedica.com",
        rateLimitPerMinute: 12,
        staleAfterMs: 30 * 24 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      });
      registry = (await ctx.db.get(registryId))!;
    }
    const fetchId = await ctx.db.insert("sourceFetches", {
      sourceRegistryId: registry._id,
      sourceRegistry: args.sourceRegistry,
      sourceUrl: args.sourceUrl,
      fetchedAt: now,
      sourceType: args.sourceType,
      httpStatus: 200,
      ok: true,
      contentHash: contentHash(args.rawPayload),
      rawPayload: args.rawPayload,
      parserVersion: args.parserVersion ?? registry.parserVersion,
      structureStatus: args.structureMessage ? "not_checked" : "passed",
      structureMessage: args.structureMessage,
      robotsAllowed: true,
      createdAt: now,
    });
    await ctx.db.patch(registry._id, {
      lastFetchedAt: now,
      lastSuccessAt: now,
      nextFetchAt: nextFetchAt(registry.cadence, now),
      updatedAt: now,
    });
    return fetchId;
  },
});

export const ensureDefaultAssumptionSet = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = (await ctx.db.query("opportunityAssumptionSets").withIndex("by_is_active", (q) => q.eq("isActive", true)).take(1))[0];
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("opportunityAssumptionSets", {
      name: "Default KEMEDICA threshold",
      isActive: true,
      thresholdScore: 65,
      minimumRiskAdjustedMargin: 500000,
      targetMarkets: ["Saudi Arabia", "UAE", "Egypt"],
      secondaryMarkets: ["Kuwait", "Qatar", "Algeria"],
      top20ExclusionEnabled: true,
      model1Assumptions: {
        grossMarginPct: 28,
        tenderDiscountPct: 18,
        registrationCostUsd: 75000,
        annualPvCostUsd: 25000,
        workingCapitalPct: 8,
        probabilityOfSuccessPct: 35,
      },
      model4Assumptions: {
        successFeePct: 3,
        sublicenseRoyaltyPct: 2,
        probabilityOfSuccessPct: 22,
        operatingCostUsd: 15000,
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getActiveAssumptionSet = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("opportunityAssumptionSets").withIndex("by_is_active", (q) => q.eq("isActive", true)).take(1))[0] ?? null,
});

export const listDueSourceRegistries = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("sourceRegistries")
      .withIndex("by_status_and_next_fetch_at", (q) => q.eq("status", "active"))
      .take(100);
    return active.filter((source) => source.cadence !== "manual" && (source.nextFetchAt ?? 0) <= now);
  },
});

export const recordAutomatedFetch = internalMutation({
  args: {
    sourceRegistryId: v.id("sourceRegistries"),
    sourceRegistry: v.string(),
    sourceUrl: v.string(),
    sourceType: v.string(),
    rawPayload: v.string(),
    httpStatus: v.optional(v.number()),
    ok: v.boolean(),
    parserVersion: v.string(),
    structureStatus: v.union(v.literal("passed"), v.literal("failed"), v.literal("not_checked")),
    structureMessage: v.optional(v.string()),
    robotsAllowed: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const registry = await ctx.db.get(args.sourceRegistryId);
    if (!registry) throw new Error("Unknown source registry");
    const fetchId = await ctx.db.insert("sourceFetches", {
      ...args,
      fetchedAt: now,
      contentHash: contentHash(args.rawPayload),
      createdAt: now,
    });
    await ctx.db.patch(args.sourceRegistryId, {
      status: !args.robotsAllowed
        ? "blocked_by_robots"
        : args.structureStatus === "failed"
          ? "structural_change"
          : args.ok
            ? "active"
            : "error",
      lastFetchedAt: now,
      lastSuccessAt: args.ok && args.structureStatus !== "failed" ? now : registry.lastSuccessAt,
      lastErrorAt: !args.ok || args.structureStatus === "failed" || !args.robotsAllowed ? now : registry.lastErrorAt,
      lastError: args.errorMessage ?? args.structureMessage,
      nextFetchAt: nextFetchAt(registry.cadence, now),
      staleAt: !args.ok || args.structureStatus === "failed" ? now : undefined,
      updatedAt: now,
    });
    if (args.structureStatus === "failed") {
      await ctx.db.insert("reviewQueueItems", {
        itemType: "source_structure",
        status: "open",
        title: `${registry.title} source structure changed`,
        summary: args.structureMessage ?? "The expected source structure was not detected.",
        proposedAction: "Inspect the retained payload, update and fixture-test the parser, then approve the source before resuming automated classifications.",
        candidatePayload: {
          sourceRegistry: args.sourceRegistry,
          parserVersion: args.parserVersion,
          httpStatus: String(args.httpStatus ?? "unknown"),
          lastValidSnapshotAt: registry.lastSuccessAt ? new Date(registry.lastSuccessAt).toISOString() : "none",
        },
        sourceUrl: args.sourceUrl,
        fetchedAt: now,
        sourceRegistry: args.sourceRegistry,
        sourceFetchId: fetchId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return fetchId;
  },
});

export const createOpportunityRun = mutation({
  args: {
    trigger: v.union(v.literal("manual"), v.literal("scheduled"), v.literal("source_change")),
    assumptionSetId: v.id("opportunityAssumptionSets"),
  },
  handler: async (ctx, args) => {
    const assumptionSet = await ctx.db.get(args.assumptionSetId);
    if (!assumptionSet) throw new Error("Missing assumption set");
    const now = Date.now();
    const runId = await ctx.db.insert("opportunityRuns", {
      assumptionSetId: args.assumptionSetId,
      status: "running",
      trigger: args.trigger,
      candidateCount: 0,
      passedGateCount: 0,
      excludedTop20Count: 0,
      targetRegisteredCount: 0,
      warnings: [],
      startedAt: now,
      createdAt: now,
    });
    const registryId = await ctx.db.insert("sourceRegistries", {
      sourceRegistry: `opportunity_run_${runId}`,
      title: "Opportunity run internal snapshot",
      sourceType: "manual_import",
      baseUrl: "internal://opportunity-run",
      cadence: "manual",
      status: "active",
      parserVersion: "internal-run-v1",
      userAgent: "internal",
      contactEmail: "internal",
      rateLimitPerMinute: 1,
      staleAfterMs: 0,
      lastFetchedAt: now,
      lastSuccessAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const sourceFetchId = await ctx.db.insert("sourceFetches", {
      sourceRegistryId: registryId,
      sourceRegistry: "internal_opportunity_run",
      sourceUrl: "internal://opportunity-run",
      fetchedAt: now,
      sourceType: "opportunity_run",
      httpStatus: 200,
      ok: true,
      contentHash: String(now),
      rawPayload: JSON.stringify({ runId, assumptionSet }),
      parserVersion: "internal-run-v1",
      structureStatus: "passed",
      robotsAllowed: true,
      createdAt: now,
    });
    const opportunities = await ctx.db
      .query("decisionOpportunities")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(200);
    const previousRun = (await ctx.db.query("opportunityRuns").withIndex("by_started_at").order("desc").take(2)).find(
      (run) => run._id !== runId && run.status === "completed"
    );
    const previousItems = previousRun
      ? await ctx.db.query("opportunityRunItems").withIndex("by_run", (q) => q.eq("runId", previousRun._id)).take(500)
      : [];
    const previousByOpportunity = new Map(
      previousItems
        .filter((item) => item.decisionOpportunityId)
        .map((item) => [item.decisionOpportunityId!, item])
    );
    let passedGateCount = 0;
    let excludedTop20Count = 0;
    let targetRegisteredCount = 0;
    const itemIds: Id<"opportunityRunItems">[] = [];
    for (const opportunity of opportunities) {
      const [drug, company] = await Promise.all([
        ctx.db.get(opportunity.drugId),
        opportunity.companyId ? ctx.db.get(opportunity.companyId) : null,
      ]);
      const companyName = company?.name ?? opportunity.manufacturerName ?? opportunity.approachEntityName;
      const top20 = isTop20Company(companyName);
      const registeredTargetMarkets = targetRegisteredMarkets(drug, opportunity);
      const rightsEvidence = await ctx.db
        .query("territoryRightsEvidence")
        .withIndex("by_drug", (q) => q.eq("drugId", opportunity.drugId))
        .take(20);
      const menaRightsLicensed = rightsEvidence.some((item) =>
        ["confirmed", "unavailable"].includes(item.rightsStatus) &&
        /mena|middle east|gulf|gcc|egypt|saudi|uae/i.test(item.territory)
      );
      const menaRightsSummary = menaRightsLicensed
        ? "MENA rights already appear licensed or unavailable in stored evidence."
        : rightsEvidence.length > 0
          ? "Rights evidence exists but still needs analyst confirmation."
          : "No MENA partner on public record in current stored evidence.";
      const sizingInputs = await ctx.db
        .query("opportunitySizingInputs")
        .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", opportunity._id))
        .take(20);
      const priceRows = await ctx.db
        .query("priceEvidence")
        .withIndex("by_drug", (q) => q.eq("drugId", opportunity.drugId))
        .take(100);
      const priceAnchor = deriveInternationalPriceAnchor(priceRows);
      const targetMarkets = opportunity.focusMarkets
        .map(canonicalMarket)
        .filter((market): market is (typeof ENGINE_MARKETS)[number] => Boolean(market));
      const peakSalesByMarket: Record<string, number> = {};
      let peakSalesUsd = 0;
      let kemedicaMarginAtPeakUsd = 0;
      const cascadeBasisParts: string[] = [];
      let sizingStatus: "evidence_based" | "practitioner_estimate" | "unvalidated" = "unvalidated";
      for (const market of targetMarkets.length > 0 ? targetMarkets : TARGET_MARKETS) {
        const storedSizing = sizingInputs.find((row) => row.country === market);
        const sizing = storedSizing ?? deriveSizingDefaults({ country: market, opportunity, priceAnchor });
        if (storedSizing && storedSizing.inputStatus !== "unvalidated") {
          if (storedSizing.inputStatus === "practitioner_estimate") {
            sizingStatus = sizingStatus === "evidence_based" ? "evidence_based" : "practitioner_estimate";
          } else if (storedSizing.inputStatus === "international_price_anchor") {
            sizingStatus = sizingStatus === "evidence_based" ? "evidence_based" : "practitioner_estimate";
          } else {
            sizingStatus = "evidence_based";
          }
        } else if (
          (sizing.inputStatus === "practitioner_estimate" || sizing.inputStatus === "international_price_anchor") &&
          sizingStatus !== "evidence_based"
        ) {
          sizingStatus = "practitioner_estimate";
        }
        const peak = calculatePeakSales(sizing);
        const riskAdjusted = calculateRiskAdjustedMargin({
          peakSalesUsd: peak,
          marketMarginRate: sizing.marketMarginRate,
          licenseSignedProbability: sizing.licenseSignedProbability,
          registrationGrantedProbability: sizing.registrationGrantedProbability,
        });
        peakSalesByMarket[market] = peak;
        peakSalesUsd += peak;
        kemedicaMarginAtPeakUsd += riskAdjusted;
        cascadeBasisParts.push(
          sizing.inputStatus === "unvalidated"
            ? `${market}: UNVALIDATED sizing; add eligible patients, rates, share, and net price in the Asset File.`
            : `${market}: ${sizing.eligiblePatients.toLocaleString()} eligible; ${sizing.diagnosedReachableRate}% reachable; ${sizing.brandedTreatmentRate}% branded; ${sizing.kemedicaShareRate}% KEMEDICA share; ${sizing.inputStatus.replaceAll("_", " ")}.`
        );
      }
      const belowMarginFloor =
        sizingStatus !== "unvalidated" && kemedicaMarginAtPeakUsd < assumptionSet.minimumRiskAdjustedMargin;
      const distributionInfeasible = opportunity.entryStrategy === "watch";
      const reasons = gateReasons({
        opportunity,
        drug,
        company,
        registeredTargetMarkets,
        isTop20: top20.isTop20,
        menaRightsLicensed,
        belowMarginFloor,
        distributionInfeasible,
      });
      if (top20.isTop20) excludedTop20Count += 1;
      if (registeredTargetMarkets.length > 0) targetRegisteredCount += 1;
      const gateStatus = reasons.length === 0 ? "passed" : reasons.length <= 2 ? "needs_review" : "failed";
      if (gateStatus === "passed") passedGateCount += 1;
      const annualRange = opportunity.marketSizeEstimate;
      const model1ExpectedValue = kemedicaMarginAtPeakUsd;
      const model4ExpectedValue = calculateModel4ExpectedValue({
        annualOpportunityRange: annualRange,
        ...assumptionSet.model4Assumptions,
      });
      const riskAdjustedMargin = kemedicaMarginAtPeakUsd;
      const primaryMarket = canonicalMarket(opportunity.focusMarkets[0] ?? "Saudi Arabia") ?? "Saudi Arabia";
      const productClass = classifyProduct({
        drug,
        opportunity,
        evidenceText: `${opportunity.gapSummary} ${opportunity.confidenceSummary} ${opportunity.marketAttractiveness}`,
      });
      const matrix = registryStatusMatrix(drug);
      const withdrawnOrSuspended = drug?.approvalStatus === "withdrawn";
      const itemId = await ctx.db.insert("opportunityRunItems", {
        runId,
        decisionOpportunityId: opportunity._id,
        drugId: opportunity.drugId,
        companyId: opportunity.companyId,
        productName: opportunity.productName,
        inn: opportunity.genericName,
        companyName,
        primaryMarket,
        targetMarkets,
        productClass,
        indication: drug?.indication ?? opportunity.therapeuticArea,
        registryStatusMatrix: matrix,
        gateStatus,
        gateReasons: reasons.length > 0 ? reasons : ["All MVP evidence gates passed."],
        exclusionFlags: {
          alreadyRegisteredTarget: registeredTargetMarkets.length > 0,
          top20Pharma: top20.isTop20,
          menaRightsLicensed,
          withdrawnOrSuspended,
          belowMarginFloor,
          distributionInfeasible,
        },
        isTop20Excluded: top20.isTop20,
        registeredTargetMarkets,
        homeAuthorizationStatus: drug?.approvalStatus ?? "unknown",
        approvalsSummary:
          drug?.approvalStatus === "approved"
            ? `Approved${drug.approvalDate ? ` ${drug.approvalDate}` : ""}${drug.emaApprovalDate ? `; EMA ${drug.emaApprovalDate}` : ""}`
            : "Home authorization needs validation",
        territoryRightsStatus: menaRightsLicensed ? "LICENSED_OR_UNAVAILABLE" : "UNVALIDATED",
        menaRightsSummary,
        opportunityScore: opportunity.priorityScore,
        riskAdjustedMargin,
        peakSalesUsd,
        peakSalesByMarket,
        kemedicaMarginAtPeakUsd,
        cascadeBasis: cascadeBasisParts.join(" "),
        sizingStatus,
        model1ExpectedValue,
        model4ExpectedValue,
        createdAt: now,
      });
      itemIds.push(itemId);
      const previous = previousByOpportunity.get(opportunity._id);
      if (previous) {
        const crossedUp =
          previous.opportunityScore < assumptionSet.thresholdScore &&
          opportunity.priorityScore >= assumptionSet.thresholdScore;
        const crossedDown =
          previous.opportunityScore >= assumptionSet.thresholdScore &&
          opportunity.priorityScore < assumptionSet.thresholdScore;
        const newRegistrations = registeredTargetMarkets.filter(
          (market) => !previous.registeredTargetMarkets.includes(market)
        );
        for (const market of newRegistrations) {
          await insertChangeEventWithInAppDelivery(ctx, {
            eventType: "target_market_registration",
            severity: "critical",
            status: "new",
            title: `${opportunity.productName} registered in ${market}`,
            summary: "A tracked opportunity now has target-market registration evidence; KEMEDICA may have been beaten to market.",
            decisionOpportunityId: opportunity._id,
            drugId: opportunity.drugId,
            companyId: opportunity.companyId,
            country: market,
            previousRunId: previousRun?._id,
            currentRunId: runId,
            sourceUrl: "internal://opportunity-run",
            fetchedAt: now,
            sourceRegistry: "internal_opportunity_run",
            sourceFetchId,
            createdAt: now,
          });
        }
        if (crossedUp || crossedDown) {
          await insertChangeEventWithInAppDelivery(ctx, {
            eventType: crossedUp ? "threshold_crossed_up" : "threshold_crossed_down",
            severity: crossedUp ? "info" : "warning",
            status: "new",
            title: `${opportunity.productName} ${crossedUp ? "crossed above" : "fell below"} threshold`,
            summary: `Opportunity score moved from ${previous.opportunityScore.toFixed(1)} to ${opportunity.priorityScore.toFixed(1)}.`,
            decisionOpportunityId: opportunity._id,
            drugId: opportunity.drugId,
            companyId: opportunity.companyId,
            previousRunId: previousRun?._id,
            currentRunId: runId,
            sourceUrl: "internal://opportunity-run",
            fetchedAt: now,
            sourceRegistry: "internal_opportunity_run",
            sourceFetchId,
            createdAt: now,
          });
        }
      }
      for (const model of ["MODEL_1_REGIONAL_AGENT", "MODEL_4_BROKER_SUBLICENSE"] as const) {
        const isModel1 = model === "MODEL_1_REGIONAL_AGENT";
        await ctx.db.insert("dealEconomicsScenarios", {
          decisionOpportunityId: opportunity._id,
          runItemId: itemId,
          model,
          market: primaryMarket,
          netRevenueLowUsd: parseRevenueRange(annualRange).low,
          netRevenueHighUsd: parseRevenueRange(annualRange).high,
          expectedGrossMarginPct: isModel1
            ? assumptionSet.model1Assumptions.grossMarginPct
            : assumptionSet.model4Assumptions.successFeePct + assumptionSet.model4Assumptions.sublicenseRoyaltyPct,
          operatingCostUsd: isModel1
            ? assumptionSet.model1Assumptions.registrationCostUsd + assumptionSet.model1Assumptions.annualPvCostUsd
            : assumptionSet.model4Assumptions.operatingCostUsd,
          probabilityOfSuccessPct: isModel1
            ? assumptionSet.model1Assumptions.probabilityOfSuccessPct
            : assumptionSet.model4Assumptions.probabilityOfSuccessPct,
          expectedValueUsd: isModel1 ? model1ExpectedValue : model4ExpectedValue,
          assumptions: isModel1
            ? ["KEMEDICA registers/imports/distributes through local route.", "Includes tender discount, PV cost, working capital, and registration cost."]
            : ["KEMEDICA brokers or sub-licenses regional rights.", "Lower operating burden with smaller probability-adjusted economics."],
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const ranked = (
      await Promise.all(itemIds.map((id) => ctx.db.get(id)))
    )
      .filter((item): item is Doc<"opportunityRunItems"> => item !== null)
      .sort((left, right) => right.riskAdjustedMargin - left.riskAdjustedMargin);
    for (const [index, item] of ranked.entries()) {
      await ctx.db.patch(item._id, { rankingPosition: index + 1 });
    }
    await ctx.db.patch(runId, {
      status: "completed",
      candidateCount: opportunities.length,
      passedGateCount,
      excludedTop20Count,
      targetRegisteredCount,
      completedAt: now,
    });
    return { runId, candidateCount: opportunities.length, passedGateCount };
  },
});

export const rebuildOpportunityRun = action({
  args: { trigger: v.optional(v.union(v.literal("manual"), v.literal("scheduled"), v.literal("source_change"))) },
  handler: async (ctx, args): Promise<{ runId: Id<"opportunityRuns">; candidateCount: number; passedGateCount: number }> => {
    const assumptionSetId: Id<"opportunityAssumptionSets"> = await ctx.runMutation(
      internal.continuousOpportunityEngine.ensureDefaultAssumptionSet,
      {}
    );
    return await ctx.runMutation(api.continuousOpportunityEngine.createOpportunityRun, {
      trigger: args.trigger ?? "manual",
      assumptionSetId,
    });
  },
});

async function robotsAllowed(sourceUrl: string, userAgentValue: string) {
  const url = new URL(sourceUrl);
  const robotsUrl = `${url.origin}/robots.txt`;
  try {
    const response = await fetch(robotsUrl, { headers: { "User-Agent": userAgentValue } });
    if (!response.ok) return true;
    const text = await response.text();
    const lower = text.toLowerCase();
    const path = url.pathname.toLowerCase();
    const globalDisallows = [...lower.matchAll(/user-agent:\s*\*[\s\S]*?(?=user-agent:|$)/g)]
      .flatMap((block) => [...block[0].matchAll(/disallow:\s*([^\n\r#]+)/g)].map((match) => match[1].trim()));
    return !globalDisallows.some((rule) => rule !== "" && path.startsWith(rule));
  } catch {
    return true;
  }
}

function assertStructure(rawPayload: string, signature?: string) {
  if (!signature) return { status: "not_checked" as const };
  const passed = rawPayload.toLowerCase().includes(signature.toLowerCase());
  return {
    status: passed ? ("passed" as const) : ("failed" as const),
    message: passed ? undefined : `Expected page structure signature "${signature}" was not found.`,
  };
}

export const runDueSourceDispatcher = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(api.continuousOpportunityEngine.seedSourceRegistry, {});
    const sources: Doc<"sourceRegistries">[] = await ctx.runQuery(
      internal.continuousOpportunityEngine.listDueSourceRegistries,
      {}
    );
    const results: Array<{
      sourceRegistry: string;
      ok: boolean;
      reason?: string;
      structureStatus?: "passed" | "failed" | "not_checked";
    }> = [];
    for (const source of sources) {
      const allowed = await robotsAllowed(source.baseUrl, source.userAgent);
      if (!allowed) {
        await ctx.runMutation(internal.continuousOpportunityEngine.recordAutomatedFetch, {
          sourceRegistryId: source._id,
          sourceRegistry: source.sourceRegistry,
          sourceUrl: source.baseUrl,
          sourceType: source.sourceType,
          rawPayload: "",
          ok: false,
          parserVersion: source.parserVersion,
          structureStatus: "not_checked",
          robotsAllowed: false,
          errorMessage: "robots.txt disallows this fetch path.",
        });
        results.push({ sourceRegistry: source.sourceRegistry, ok: false, reason: "robots" });
        continue;
      }
      try {
        const response = await fetch(source.baseUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml,application/json,text/plain",
            "User-Agent": source.userAgent,
          },
        });
        const rawPayload = await response.text();
        const structure = assertStructure(rawPayload, source.structureSignature);
        await ctx.runMutation(internal.continuousOpportunityEngine.recordAutomatedFetch, {
          sourceRegistryId: source._id,
          sourceRegistry: source.sourceRegistry,
          sourceUrl: source.baseUrl,
          sourceType: source.sourceType,
          rawPayload,
          httpStatus: response.status,
          ok: response.ok,
          parserVersion: source.parserVersion,
          structureStatus: structure.status,
          structureMessage: structure.message,
          robotsAllowed: true,
          errorMessage: response.ok ? undefined : `${source.title} returned ${response.status}.`,
        });
        results.push({ sourceRegistry: source.sourceRegistry, ok: response.ok, structureStatus: structure.status });
      } catch (error) {
        await ctx.runMutation(internal.continuousOpportunityEngine.recordAutomatedFetch, {
          sourceRegistryId: source._id,
          sourceRegistry: source.sourceRegistry,
          sourceUrl: source.baseUrl,
          sourceType: source.sourceType,
          rawPayload: "",
          ok: false,
          parserVersion: source.parserVersion,
          structureStatus: "not_checked",
          robotsAllowed: true,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        results.push({ sourceRegistry: source.sourceRegistry, ok: false, reason: "fetch_error" });
      }
    }
    if (results.some((result) => result.ok)) {
      await ctx.runAction(api.continuousOpportunityEngine.rebuildOpportunityRun, { trigger: "source_change" });
    }
    return { checked: results.length, results };
  },
});

export const runDueSourceDispatcherInternal = internalAction({
  args: {},
  handler: async (ctx) => await ctx.runAction(api.continuousOpportunityEngine.runDueSourceDispatcher, {}),
});

export const processPendingAlertDeliveries = action({
  args: {},
  handler: async (ctx) => {
    const pending: Doc<"alertDeliveries">[] = await ctx.runQuery(
      internal.continuousOpportunityEngine.listPendingAlertDeliveries,
      {}
    );
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const delivery of pending) {
      const event: Doc<"changeEvents"> | null = await ctx.runQuery(
        internal.continuousOpportunityEngine.getChangeEventForDelivery,
        { id: delivery.changeEventId }
      );
      if (!event) {
        await ctx.runMutation(internal.continuousOpportunityEngine.markAlertDelivery, {
          id: delivery._id,
          status: "skipped",
          lastError: "Change event no longer exists.",
        });
        skipped += 1;
        continue;
      }
      const webhookUrl =
        delivery.channel === "teams_webhook"
          ? process.env.KEMEDICA_TEAMS_WEBHOOK_URL
          : delivery.channel === "email_digest"
            ? process.env.KEMEDICA_EMAIL_DIGEST_WEBHOOK_URL
            : undefined;
      if (!webhookUrl) {
        await ctx.runMutation(internal.continuousOpportunityEngine.markAlertDelivery, {
          id: delivery._id,
          status: "skipped",
          lastError: "Webhook is not configured.",
        });
        skipped += 1;
        continue;
      }
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.title,
            summary: event.summary,
            severity: event.severity,
            eventType: event.eventType,
            createdAt: event.createdAt,
          }),
        });
        if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
        await ctx.runMutation(internal.continuousOpportunityEngine.markAlertDelivery, {
          id: delivery._id,
          status: "sent",
        });
        sent += 1;
      } catch (error) {
        await ctx.runMutation(internal.continuousOpportunityEngine.markAlertDelivery, {
          id: delivery._id,
          status: "failed",
          lastError: error instanceof Error ? error.message : String(error),
        });
        failed += 1;
      }
    }
    return { sent, skipped, failed };
  },
});

export const processPendingAlertDeliveriesInternal = internalAction({
  args: {},
  handler: async (ctx) => await ctx.runAction(api.continuousOpportunityEngine.processPendingAlertDeliveries, {}),
});
