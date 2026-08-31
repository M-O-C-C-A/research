import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
    sourceRegistry: "ema_medicine_downloads",
    title: "EMA medicine data downloads",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.ema.europa.eu/en/medicines/download-medicine-data",
    cadence: "daily" as const,
    parserVersion: "ema-downloads-v1",
    structureSignature: "medicines/download-medicine-data",
  },
  {
    sourceRegistry: "fda_orange_purple_books",
    title: "FDA Orange and Purple Book references",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.fda.gov/drugs/drug-approvals-and-databases",
    cadence: "daily" as const,
    parserVersion: "fda-books-v1",
    structureSignature: "Drug Approvals and Databases",
  },
  {
    sourceRegistry: "bfarm_pharmnet",
    title: "BfArM / PharmNet.Bund authorizations",
    sourceType: "home_authorization" as const,
    baseUrl: "https://www.pharmnet-bund.de",
    cadence: "weekly" as const,
    parserVersion: "bfarm-pharmnet-v1",
    structureSignature: "PharmNet",
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
    sourceRegistry: "uae_ede_mohap_manual",
    title: "UAE EDE/MOHAP registration and price evidence",
    sourceType: "target_registration" as const,
    baseUrl: "https://www.ede.gov.ae",
    cadence: "manual" as const,
    parserVersion: "uae-manual-import-v1",
    structureSignature: "ede",
  },
  {
    sourceRegistry: "egypt_eda_manual",
    title: "Egypt EDA registration search evidence",
    sourceType: "target_registration" as const,
    baseUrl: "https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx",
    cadence: "manual" as const,
    parserVersion: "egypt-eda-manual-v1",
    structureSignature: "EDASearch",
  },
] as const;

const sourceTypeValidator = v.union(
  v.literal("home_authorization"),
  v.literal("target_registration"),
  v.literal("shortage"),
  v.literal("procurement"),
  v.literal("company_rights"),
  v.literal("manual_import")
);

const cadenceValidator = v.union(v.literal("manual"), v.literal("daily"), v.literal("weekly"));
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

function nextFetchAt(cadence: "manual" | "daily" | "weekly", now: number) {
  if (cadence === "manual") return undefined;
  return now + (cadence === "daily" ? 24 : 7 * 24) * 60 * 60 * 1000;
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

function rankableMargin(args: { priorityScore: number; model1ExpectedValue: number; model4ExpectedValue: number }) {
  const bestValue = Math.max(args.model1ExpectedValue, args.model4ExpectedValue, 0);
  return Number(((args.priorityScore / 10) * Math.log10(bestValue + 10)).toFixed(2));
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
  if (args.registeredTargetMarkets.length > 0) {
    reasons.push(`Already registered in ${args.registeredTargetMarkets.join(", ")}.`);
  }
  if (!demandEvidence) reasons.push("Demand evidence or commercial sizing signal is missing.");
  return reasons;
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
        staleAfterMs: (source.cadence === "weekly" ? 14 : 3) * 24 * 60 * 60 * 1000,
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

export const getDealEconomics = query({
  args: { decisionOpportunityId: v.id("decisionOpportunities") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("dealEconomicsScenarios")
      .withIndex("by_decision_opportunity", (q) => q.eq("decisionOpportunityId", args.decisionOpportunityId))
      .take(20),
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
      minimumRiskAdjustedMargin: 4,
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
      const reasons = gateReasons({
        opportunity,
        drug,
        company,
        registeredTargetMarkets,
        isTop20: top20.isTop20,
      });
      if (top20.isTop20) excludedTop20Count += 1;
      if (registeredTargetMarkets.length > 0) targetRegisteredCount += 1;
      const gateStatus = reasons.length === 0 ? "passed" : reasons.length <= 2 ? "needs_review" : "failed";
      if (gateStatus === "passed") passedGateCount += 1;
      const annualRange = opportunity.marketSizeEstimate;
      const model1ExpectedValue = calculateModel1ExpectedValue({
        annualOpportunityRange: annualRange,
        ...assumptionSet.model1Assumptions,
      });
      const model4ExpectedValue = calculateModel4ExpectedValue({
        annualOpportunityRange: annualRange,
        ...assumptionSet.model4Assumptions,
      });
      const riskAdjustedMargin = rankableMargin({
        priorityScore: opportunity.priorityScore,
        model1ExpectedValue,
        model4ExpectedValue,
      });
      const primaryMarket = canonicalMarket(opportunity.focusMarkets[0] ?? "Saudi Arabia") ?? "Saudi Arabia";
      const itemId = await ctx.db.insert("opportunityRunItems", {
        runId,
        decisionOpportunityId: opportunity._id,
        drugId: opportunity.drugId,
        companyId: opportunity.companyId,
        productName: opportunity.productName,
        inn: opportunity.genericName,
        companyName,
        primaryMarket,
        targetMarkets: opportunity.focusMarkets.map(canonicalMarket).filter((market): market is (typeof ENGINE_MARKETS)[number] => Boolean(market)),
        gateStatus,
        gateReasons: reasons.length > 0 ? reasons : ["All MVP evidence gates passed."],
        isTop20Excluded: top20.isTop20,
        registeredTargetMarkets,
        homeAuthorizationStatus: drug?.approvalStatus ?? "unknown",
        territoryRightsStatus: "UNVALIDATED",
        opportunityScore: opportunity.priorityScore,
        riskAdjustedMargin,
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
          await ctx.db.insert("changeEvents", {
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
          await ctx.db.insert("changeEvents", {
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
