import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { getCountryCapabilityProfile } from "./countryCapabilityProfiles";

const GCC_PLUS_COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Kuwait",
  "Qatar",
  "Egypt",
  "Algeria",
] as const;

const AVAILABILITY_STATUS_VALIDATOR = v.union(
  v.literal("formally_registered"),
  v.literal("tender_formulary_only"),
  v.literal("shortage_listed"),
  v.literal("hospital_import_only"),
  v.literal("not_found"),
  v.literal("ambiguous"),
  v.literal("unverified")
);

const PRODUCT_GENERIC_AVAILABILITY_VALIDATOR = v.union(
  v.literal("originator_only"),
  v.literal("originator_plus_generics"),
  v.literal("generic_only"),
  v.literal("not_available"),
  v.literal("unclear")
);

const EVIDENCE_CONFIDENCE_VALIDATOR = v.union(
  v.literal("confirmed"),
  v.literal("likely"),
  v.literal("inferred")
);

const EVIDENCE_ITEM_VALIDATOR = v.object({
  claim: v.string(),
  title: v.optional(v.string()),
  url: v.optional(v.string()),
  sourceType: v.union(
    v.literal("official_registry"),
    v.literal("shortage_list"),
    v.literal("tender_portal"),
    v.literal("public_procurement"),
    v.literal("essential_medicines"),
    v.literal("market_report"),
    v.literal("company"),
    v.literal("internal")
  ),
  confidence: EVIDENCE_CONFIDENCE_VALIDATOR,
  country: v.optional(v.string()),
  sourceSystem: v.optional(v.union(
    v.literal("cms"),
    v.literal("nhsbsa"),
    v.literal("sfda"),
    v.literal("eda_egypt"),
    v.literal("mohap_uae"),
    v.literal("bfarm_amice"),
    v.literal("who"),
    v.literal("nupco"),
    v.literal("evaluate"),
    v.literal("clarivate"),
    v.literal("lauer_taxe"),
    v.literal("manual"),
    v.literal("other")
  )),
  sourceCategory: v.optional(v.union(
    v.literal("official"),
    v.literal("commercial_database"),
    v.literal("proxy")
  )),
  observedAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  sourceRecordId: v.optional(v.string()),
});

const MARKET_ACCESS_ROUTE_VALIDATOR = v.union(
  v.literal("public_tender"),
  v.literal("private_hospital"),
  v.literal("retail_pharmacy"),
  v.literal("specialty_center"),
  v.literal("named_patient")
);

const OPPORTUNITY_KIND_VALIDATOR = v.union(
  v.literal("commercial_opportunity"),
  v.literal("tender_opportunity"),
  v.literal("commercial_and_tender"),
  v.literal("no_clear_opportunity"),
  v.literal("insufficient_commercial_evidence")
);

const TENDER_SIGNAL_STRENGTH_VALIDATOR = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none")
);

const CHANNEL_MIX_VALIDATOR = v.object({
  privateShare: v.optional(v.number()),
  tenderShare: v.optional(v.number()),
  hospitalShare: v.optional(v.number()),
});

const ANALYSIS_ROW_VALIDATOR = v.object({
  country: v.string(),
  availabilityStatus: AVAILABILITY_STATUS_VALIDATOR,
  marketedNames: v.array(v.string()),
  matchedBrandName: v.optional(v.string()),
  matchedGenericName: v.optional(v.string()),
  genericAvailability: PRODUCT_GENERIC_AVAILABILITY_VALIDATOR,
  marketSizeUnits: v.optional(v.number()),
  marketSizeUnitsText: v.optional(v.string()),
  marketSizeValue: v.optional(v.number()),
  marketSizeValueText: v.optional(v.string()),
  marketValueCurrency: v.optional(v.string()),
  patientPopulation: v.optional(v.number()),
  patientPopulationText: v.optional(v.string()),
  prevalenceText: v.optional(v.string()),
  incidenceText: v.optional(v.string()),
  epidemiologySummary: v.optional(v.string()),
  channelMix: v.optional(CHANNEL_MIX_VALIDATOR),
  channelSummary: v.optional(v.string()),
  tenderVsPrivateSummary: v.optional(v.string()),
  payerMixSummary: v.optional(v.string()),
  publicChannelShare: v.optional(v.number()),
  privateChannelShare: v.optional(v.number()),
  hospitalChannelShare: v.optional(v.number()),
  tenderOpportunity: v.optional(v.boolean()),
  tenderSignalStrength: v.optional(TENDER_SIGNAL_STRENGTH_VALIDATOR),
  marketAccessRoute: v.optional(MARKET_ACCESS_ROUTE_VALIDATOR),
  opportunityKind: v.optional(OPPORTUNITY_KIND_VALIDATOR),
  commercialOpportunityScore: v.optional(v.number()),
  annualOpportunityRange: v.optional(v.string()),
  priorityScore: v.optional(v.number()),
  priorityReason: v.optional(v.string()),
  availabilityNarrative: v.optional(v.string()),
  competitionSummary: v.optional(v.string()),
  marketAccessNotes: v.optional(v.string()),
  insuredShare: v.optional(v.number()),
  outOfPocketShare: v.optional(v.number()),
  evidenceConfidence: EVIDENCE_CONFIDENCE_VALIDATOR,
  evidenceItems: v.array(EVIDENCE_ITEM_VALIDATOR),
});

type CanonicalProductDoc = Doc<"canonicalProducts">;
type DrugDoc = Doc<"drugs">;
type OpportunityDoc = Doc<"opportunities">;
type PriceEvidenceDoc = Doc<"priceEvidence">;
type CommercialSignalDoc = Doc<"commercialSignals">;
type GapDoc = Doc<"gapOpportunities">;
type WebsiteEvidenceDoc = Doc<"marketWebsiteEvidence">;

function normalizeCountry(value: string) {
  return value.trim().toLowerCase();
}

function orderedCountries(input?: readonly string[]) {
  const values = input && input.length > 0 ? input : GCC_PLUS_COUNTRIES;
  const unique = [...new Set(values)];
  return unique.sort((left, right) => {
    const leftIndex = GCC_PLUS_COUNTRIES.indexOf(left as (typeof GCC_PLUS_COUNTRIES)[number]);
    const rightIndex = GCC_PLUS_COUNTRIES.indexOf(right as (typeof GCC_PLUS_COUNTRIES)[number]);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
}

function availabilityRank(status?: OpportunityDoc["availabilityStatus"]) {
  switch (status) {
    case "formally_registered":
      return 6;
    case "tender_formulary_only":
      return 5;
    case "hospital_import_only":
      return 4;
    case "shortage_listed":
      return 3;
    case "ambiguous":
      return 2;
    case "unverified":
      return 1;
    case "not_found":
      return 0;
    default:
      return -1;
  }
}

function dedupeStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function normalizeName(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function extractLargestNumber(value?: string | null) {
  if (!value) return undefined;
  const matches = value.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return undefined;
  return Math.max(...matches.map((item) => Number(item.replaceAll(",", ""))));
}

function pickCurrency(
  priceRows: PriceEvidenceDoc[],
  fallbackText?: string
) {
  const fromRow = priceRows.find((row) => row.currency)?.currency;
  if (fromRow) return fromRow;
  if (!fallbackText) return undefined;
  const match = fallbackText.match(/\b([A-Z]{3})\b/);
  return match?.[1];
}

function average(values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => typeof value === "number");
  if (defined.length === 0) return undefined;
  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
}

function averageRounded(values: Array<number | undefined>) {
  const result = average(values);
  return result === undefined ? undefined : Number(result.toFixed(3));
}

function summarizeSignalStrength(signals: CommercialSignalDoc[]) {
  if (
    signals.some(
      (signal) =>
        (signal.signalType === "tender" || signal.signalType === "procurement") &&
        signal.signalStrength === "high"
    )
  ) {
    return "high" as const;
  }
  if (
    signals.some(
      (signal) =>
        (signal.signalType === "tender" || signal.signalType === "procurement") &&
        signal.signalStrength === "medium"
    )
  ) {
    return "medium" as const;
  }
  if (
    signals.some(
      (signal) => signal.signalType === "tender" || signal.signalType === "procurement"
    )
  ) {
    return "low" as const;
  }
  return "none" as const;
}

function uniqueEvidenceItems(
  items: Array<{
    claim: string;
    title?: string;
    url?: string;
    sourceType:
      | "official_registry"
      | "shortage_list"
      | "tender_portal"
      | "public_procurement"
      | "essential_medicines"
      | "market_report"
      | "company"
      | "internal";
    confidence: "confirmed" | "likely" | "inferred";
    country?: string;
    sourceSystem?:
      | "cms"
      | "nhsbsa"
      | "sfda"
      | "eda_egypt"
      | "mohap_uae"
      | "bfarm_amice"
      | "who"
      | "nupco"
      | "evaluate"
      | "clarivate"
      | "lauer_taxe"
      | "manual"
      | "other";
    sourceCategory?: "official" | "commercial_database" | "proxy";
    observedAt?: number;
    notes?: string;
    sourceRecordId?: string;
  }>
) {
  return [
    ...new Map(
      items.map((item) => [
        `${item.title ?? ""}|${item.url ?? ""}|${item.claim}|${item.country ?? ""}|${item.sourceRecordId ?? ""}`,
        item,
      ])
    ).values(),
  ].slice(0, 12);
}

function presenceLabel(status: OpportunityDoc["availabilityStatus"] | "registered" | "not_found" | "unverified") {
  if (status === "formally_registered" || status === "registered") return "available";
  if (status === "tender_formulary_only") return "tender/formulary only";
  if (status === "hospital_import_only") return "hospital/import only";
  if (status === "shortage_listed") return "shortage-listed";
  if (status === "not_found") return "not found";
  if (status === "ambiguous") return "ambiguous";
  return "unverified";
}

function summarizeEpidemiology(gaps: GapDoc[], country: string) {
  const scoped = gaps.filter((gap) =>
    gap.targetCountries.some((target) => normalizeCountry(target) === normalizeCountry(country))
  );
  const prevalence = scoped
    .map((gap) => gap.whoDiseaseBurden)
    .filter((value): value is string => Boolean(value))
    .find((value) => /prevalence/i.test(value));
  const incidence = scoped
    .map((gap) => gap.whoDiseaseBurden)
    .filter((value): value is string => Boolean(value))
    .find((value) => /incidence/i.test(value));
  const summary = scoped
    .map((gap) => gap.whoDiseaseBurden)
    .filter((value): value is string => Boolean(value))
    .slice(0, 2)
    .join(" ");
  return {
    prevalenceText: prevalence,
    incidenceText: incidence,
    epidemiologySummary: summary || undefined,
  };
}

function buildAvailabilityNarrative(args: {
  product: CanonicalProductDoc;
  country: string;
  availabilityStatus: OpportunityDoc["availabilityStatus"];
  marketedNames: string[];
  genericAvailability:
    | "originator_only"
    | "originator_plus_generics"
    | "generic_only"
    | "not_available"
    | "unclear";
}) {
  const marketedNames =
    args.marketedNames.length > 0 ? args.marketedNames.join(", ") : "no marketed name captured yet";
  const genericSentence =
    args.genericAvailability === "originator_plus_generics"
      ? "originator and generic competition both appear present."
      : args.genericAvailability === "generic_only"
        ? "the market appears generic-led."
        : args.genericAvailability === "originator_only"
          ? "the originator appears present without clear generic competition."
          : args.genericAvailability === "not_available"
            ? "current evidence does not show the product as available."
            : "the generic/originator mix is still unclear.";
  return `${args.country}: ${args.product.brandName} is ${presenceLabel(args.availabilityStatus)}. Observed names: ${marketedNames}; ${genericSentence}`;
}

function buildChannelSummary(args: {
  opportunity?: OpportunityDoc;
  signals: CommercialSignalDoc[];
  country: string;
}) {
  const profile = getCountryCapabilityProfile(args.country);
  const route = args.opportunity?.marketAccessRoute;
  const tenderSignals = args.signals.filter(
    (signal) => signal.signalType === "tender" || signal.signalType === "procurement"
  );
  const reimbursementSignals = args.signals.filter(
    (signal) => signal.signalType === "reimbursement"
  );
  const channelSignals = args.signals.filter((signal) => signal.signalType === "channel");
  const primaryRoute = route ? route.replaceAll("_", " ") : profile.marketAccessRoutes[0].replaceAll("_", " ");
  const channelSummary = `${args.country} appears to lean ${primaryRoute} first${tenderSignals.length > 0 ? `, with ${tenderSignals.length} tender/procurement signal${tenderSignals.length === 1 ? "" : "s"}` : ""}${channelSignals.length > 0 ? ` and ${channelSignals.length} channel signal${channelSignals.length === 1 ? "" : "s"}` : ""}.`;
  const tenderVsPrivateSummary =
    args.opportunity?.tenderOpportunity || tenderSignals.length > 0
      ? `${args.country} shows public tender activity, with private channel access still relevant when available.`
      : `${args.country} currently looks more private or institutional than tender-led.`;
  const payerMixSummary =
    reimbursementSignals.length > 0
      ? `${args.country} has reimbursement-linked evidence, so insured/publicly covered demand likely matters.`
      : `${args.country} payer mix is not fully quantified yet; private hospital, retail, or out-of-pocket access may still dominate.`;
  return {
    channelSummary,
    tenderVsPrivateSummary,
    payerMixSummary,
  };
}

function buildPriorityReason(args: {
  country: string;
  availabilityStatus: OpportunityDoc["availabilityStatus"];
  opportunity?: OpportunityDoc;
  evidenceCount: number;
}) {
  if (args.availabilityStatus === "not_found") {
    return `${args.country} looks like whitespace now, with no confirmed local availability in the current evidence set.`;
  }
  if (args.availabilityStatus === "tender_formulary_only") {
    return `${args.country} looks institutionally accessible first because presence appears limited to tender or formulary channels.`;
  }
  if (args.availabilityStatus === "hospital_import_only") {
    return `${args.country} looks niche but reachable through hospital/import pathways before full broad-market availability.`;
  }
  if ((args.opportunity?.commercialOpportunityScore ?? 0) >= 7) {
    return `${args.country} has stronger commercial signals than most GCC++ peers for this product.`;
  }
  return `${args.country} has ${args.evidenceCount} supporting market evidence item${args.evidenceCount === 1 ? "" : "s"} and should stay on the review shortlist.`;
}

function deriveEvidenceConfidence(
  evidenceItems: Array<{ confidence: "confirmed" | "likely" | "inferred" }>
) {
  if (evidenceItems.some((item) => item.confidence === "confirmed")) return "confirmed" as const;
  if (evidenceItems.some((item) => item.confidence === "likely")) return "likely" as const;
  return "inferred" as const;
}

function deriveAvailabilityStatus(
  opportunities: OpportunityDoc[],
  registrations: NonNullable<DrugDoc["menaRegistrations"]>
) {
  const bestOpportunity = [...opportunities].sort(
    (left, right) => availabilityRank(right.availabilityStatus) - availabilityRank(left.availabilityStatus)
  )[0];
  if (bestOpportunity?.availabilityStatus) return bestOpportunity.availabilityStatus;
  if (registrations.some((item) => item.status === "registered")) return "formally_registered" as const;
  if (registrations.some((item) => item.status === "not_found")) return "not_found" as const;
  return "unverified" as const;
}

function deriveGenericAvailability(args: {
  product: CanonicalProductDoc;
  opportunities: OpportunityDoc[];
  availabilityStatus: OpportunityDoc["availabilityStatus"];
  marketedNames: string[];
}) {
  if (args.availabilityStatus === "not_found" || args.availabilityStatus === "unverified") {
    return "not_available" as const;
  }
  const brandName = normalizeName(args.product.brandName);
  const innName = normalizeName(args.product.inn);
  const hasBrand = args.marketedNames.some((name) => normalizeName(name) === brandName);
  const hasGeneric = args.opportunities.some((item) => item.genericEquivalentDetected) ||
    args.marketedNames.some((name) => normalizeName(name) === innName);
  if (hasBrand && hasGeneric) return "originator_plus_generics" as const;
  if (hasGeneric) return "generic_only" as const;
  if (hasBrand) return "originator_only" as const;
  return "unclear" as const;
}

export const getAnalysisInputs = internalQuery({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }) => {
    const product = await ctx.db.get(canonicalProductId);
    if (!product) return null;

    const linkedDrugs = await ctx.db
      .query("drugs")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
      .collect();

    const opportunities = (
      await Promise.all(
        linkedDrugs.map((drug) =>
          ctx.db.query("opportunities").withIndex("by_drug", (q) => q.eq("drugId", drug._id)).collect()
        )
      )
    ).flat();

    const priceEvidence = (
      await Promise.all(
        linkedDrugs.map((drug) =>
          ctx.db.query("priceEvidence").withIndex("by_drug", (q) => q.eq("drugId", drug._id)).collect()
        )
      )
    ).flat();

    const commercialSignals = (
      await Promise.all(
        linkedDrugs.map((drug) =>
          ctx.db.query("commercialSignals").withIndex("by_drug", (q) => q.eq("drugId", drug._id)).collect()
        )
      )
    ).flat();

    const gaps = await ctx.db
      .query("gapOpportunities")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
      .collect();

    const websiteEvidenceFromDrugs = (
      await Promise.all(
        linkedDrugs.map((drug) =>
          ctx.db
            .query("marketWebsiteEvidence")
            .withIndex("by_drug_and_country", (q) => q.eq("drugId", drug._id))
            .collect()
        )
      )
    ).flat();
    const websiteEvidenceFromCanonical = await ctx.db
      .query("marketWebsiteEvidence")
      .withIndex("by_canonical_product_and_country", (q) =>
        q.eq("canonicalProductId", canonicalProductId)
      )
      .collect();

    return {
      product,
      linkedDrugs,
      opportunities,
      priceEvidence,
      commercialSignals,
      gaps,
      websiteEvidence: [...websiteEvidenceFromDrugs, ...websiteEvidenceFromCanonical],
    };
  },
});

export const replaceForCanonicalProduct = internalMutation({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    rows: v.array(ANALYSIS_ROW_VALIDATOR),
  },
  handler: async (ctx, { canonicalProductId, rows }) => {
    const existing = await ctx.db
      .query("canonicalProductMarketAnalyses")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (const row of rows) {
      await ctx.db.insert("canonicalProductMarketAnalyses", {
        canonicalProductId,
        ...row,
        lastAnalyzedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const analyzeCanonicalProductMarkets = action({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    targetCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const inputs = await ctx.runQuery(
      internal.productMarketAnalysis.getAnalysisInputs,
      { canonicalProductId: args.canonicalProductId }
    );

    if (!inputs) {
      throw new Error("Canonical product not found");
    }

    const countries = orderedCountries(args.targetCountries);
    const rows = countries.map((country) => {
      const countryKey = normalizeCountry(country);
      const countryOpportunities = inputs.opportunities.filter(
        (item) => normalizeCountry(item.country) === countryKey
      );
      const countryRegistrations = inputs.linkedDrugs.flatMap((drug) =>
        (drug.menaRegistrations ?? []).filter(
          (registration) => normalizeCountry(registration.country) === countryKey
        )
      );
      const countryPriceEvidence = inputs.priceEvidence.filter(
        (item) => normalizeCountry(item.country) === countryKey
      );
      const countrySignals = inputs.commercialSignals.filter(
        (item) => normalizeCountry(item.country) === countryKey
      );
      const countryWebsiteEvidence = inputs.websiteEvidence.filter(
        (item) => normalizeCountry(item.country) === countryKey
      );
      const strongestOpportunity = [...countryOpportunities].sort(
        (left, right) =>
          (right.commercialOpportunityScore ?? right.opportunityScore ?? 0) -
          (left.commercialOpportunityScore ?? left.opportunityScore ?? 0)
      )[0];

      const availabilityStatus = deriveAvailabilityStatus(
        countryOpportunities,
        countryRegistrations
      );

      const marketedNames = dedupeStrings([
        ...countryOpportunities.flatMap((item) => [item.matchedBrandName, item.matchedGenericName]),
        ...countryRegistrations
          .filter((item) => item.status === "registered")
          .map(() => inputs.product.brandName),
      ]);

      const genericAvailability = deriveGenericAvailability({
        product: inputs.product,
        opportunities: countryOpportunities,
        availabilityStatus,
        marketedNames,
      });

      const evidenceItems = uniqueEvidenceItems([
        ...countryOpportunities.flatMap((item) =>
          (item.evidenceItems ?? []).map((evidence) => ({
            claim: evidence.claim,
            title: evidence.title,
            url: evidence.url,
            sourceType: evidence.sourceType,
            confidence: evidence.confidence,
            country,
            sourceSystem: evidence.sourceSystem,
            sourceCategory: evidence.sourceCategory,
            observedAt: evidence.observedAt,
            notes: evidence.notes,
            sourceRecordId: evidence.sourceRecordId,
          }))
        ),
        ...countryRegistrations.map((item) => ({
          claim: `${inputs.product.brandName} was marked ${item.status.replaceAll("_", " ")} in ${country}.`,
          title: item.sourceTitle ?? `${country} registration record`,
          url: item.url,
          sourceType: "official_registry" as const,
          confidence:
            item.status === "registered"
              ? ("confirmed" as const)
              : item.status === "not_found"
                ? ("likely" as const)
                : ("inferred" as const),
          country,
          sourceSystem: item.sourceSystem,
          sourceCategory: item.sourceSystem ? ("official" as const) : undefined,
          observedAt: item.observedAt ?? item.verifiedAt,
          notes: item.notes,
          sourceRecordId: item.sourceRecordId,
        })),
        ...countryPriceEvidence.map((item) => ({
          claim: `${item.sourceTitle}: ${item.currency} ${item.amount} (${item.priceType})`,
          title: item.sourceTitle,
          url: item.sourceUrl,
          sourceType:
            item.priceType === "tender"
              ? ("tender_portal" as const)
              : item.sourceCategory === "official"
                ? ("official_registry" as const)
                : ("market_report" as const),
          confidence: item.confidence,
          country,
          sourceSystem: item.sourceSystem,
          sourceCategory: item.sourceCategory,
          observedAt: item.observedAt,
          notes: item.notes,
          sourceRecordId: item.sourceRecordId,
        })),
        ...countrySignals.map((item) => ({
          claim: item.summary,
          title: item.sourceTitle,
          url: item.sourceUrl,
          sourceType:
            item.signalType === "tender" || item.signalType === "procurement"
              ? ("tender_portal" as const)
              : item.sourceCategory === "official"
                ? ("official_registry" as const)
                : ("market_report" as const),
          confidence: item.confidence,
          country,
          sourceSystem: item.sourceSystem,
          sourceCategory: item.sourceCategory,
          observedAt: item.observedAt,
          notes: item.notes,
        })),
        ...countryWebsiteEvidence.map((item: WebsiteEvidenceDoc) => ({
          claim: item.claim,
          title: item.title,
          url: item.url,
          sourceType: item.sourceType,
          confidence: item.confidence,
          country,
          sourceSystem: item.sourceSystem,
          sourceCategory: item.sourceCategory,
          observedAt: item.observedAt,
          notes: item.notes,
        })),
      ]);

      const evidenceConfidence = deriveEvidenceConfidence(evidenceItems);
      const epidemiology = summarizeEpidemiology(inputs.gaps, country);
      const marketSizeUnitsText =
        strongestOpportunity?.accessibleVolumeEstimate ??
        strongestOpportunity?.treatmentVolumeProxy ??
        strongestOpportunity?.marketSizeEstimate;
      const marketSizeValueText = strongestOpportunity?.annualOpportunityRange;
      const patientPopulation =
        strongestOpportunity?.estimatedCustomers ??
        extractLargestNumber(strongestOpportunity?.addressablePopulation);
      const patientPopulationText =
        strongestOpportunity?.addressablePopulation ??
        (patientPopulation ? `${Math.round(patientPopulation).toLocaleString()} patients` : undefined);
      const channelSummary = buildChannelSummary({
        opportunity: strongestOpportunity,
        signals: countrySignals,
        country,
      });
      const tenderSignalStrength = summarizeSignalStrength(countrySignals);
      const hospitalChannelShare =
        strongestOpportunity?.marketAccessRoute === "private_hospital" ||
        availabilityStatus === "hospital_import_only"
          ? strongestOpportunity?.privateChannelShare
          : undefined;
      const insuredShare =
        countrySignals.some((item) => item.signalType === "reimbursement")
          ? strongestOpportunity?.publicChannelShare
          : undefined;
      const outOfPocketShare =
        insuredShare !== undefined && strongestOpportunity?.privateChannelShare !== undefined
          ? Math.max(0, Number((1 - insuredShare).toFixed(3)))
          : undefined;
      const priorityScore =
        strongestOpportunity?.commercialOpportunityScore ??
        strongestOpportunity?.opportunityScore ??
        (availabilityStatus === "not_found" ? 7.5 : availabilityStatus === "tender_formulary_only" ? 6.6 : 5.4);

      return {
        country,
        availabilityStatus,
        marketedNames,
        matchedBrandName: strongestOpportunity?.matchedBrandName,
        matchedGenericName: strongestOpportunity?.matchedGenericName,
        genericAvailability,
        marketSizeUnits: extractLargestNumber(marketSizeUnitsText),
        marketSizeUnitsText,
        marketSizeValue: extractLargestNumber(marketSizeValueText),
        marketSizeValueText,
        marketValueCurrency: pickCurrency(countryPriceEvidence, marketSizeValueText),
        patientPopulation,
        patientPopulationText,
        prevalenceText: epidemiology.prevalenceText,
        incidenceText: epidemiology.incidenceText,
        epidemiologySummary: epidemiology.epidemiologySummary,
        channelMix:
          strongestOpportunity?.privateChannelShare !== undefined ||
          strongestOpportunity?.publicChannelShare !== undefined ||
          hospitalChannelShare !== undefined
            ? {
                privateShare: strongestOpportunity?.privateChannelShare,
                tenderShare:
                  strongestOpportunity?.tenderOpportunity ||
                  strongestOpportunity?.marketAccessRoute === "public_tender"
                    ? strongestOpportunity?.publicChannelShare
                    : undefined,
                hospitalShare: hospitalChannelShare,
              }
            : undefined,
        channelSummary: channelSummary.channelSummary,
        tenderVsPrivateSummary: channelSummary.tenderVsPrivateSummary,
        payerMixSummary: channelSummary.payerMixSummary,
        publicChannelShare: strongestOpportunity?.publicChannelShare,
        privateChannelShare: strongestOpportunity?.privateChannelShare,
        hospitalChannelShare,
        tenderOpportunity:
          strongestOpportunity?.tenderOpportunity ??
          (tenderSignalStrength !== "none" ? true : undefined),
        tenderSignalStrength,
        marketAccessRoute: strongestOpportunity?.marketAccessRoute,
        opportunityKind: strongestOpportunity?.opportunityKind,
        commercialOpportunityScore: strongestOpportunity?.commercialOpportunityScore,
        annualOpportunityRange: strongestOpportunity?.annualOpportunityRange,
        priorityScore,
        priorityReason: buildPriorityReason({
          country,
          availabilityStatus,
          opportunity: strongestOpportunity,
          evidenceCount: evidenceItems.length,
        }),
        availabilityNarrative: buildAvailabilityNarrative({
          product: inputs.product,
          country,
          availabilityStatus,
          marketedNames,
          genericAvailability,
        }),
        competitionSummary:
          strongestOpportunity?.competitivePriceSummary ??
          strongestOpportunity?.competitionIntensity ??
          strongestOpportunity?.competitorPresence,
        marketAccessNotes:
          strongestOpportunity?.marketAccessNotes ??
          getCountryCapabilityProfile(country).dossierRoute,
        insuredShare,
        outOfPocketShare,
        evidenceConfidence,
        evidenceItems,
      };
    });

    await ctx.runMutation(internal.productMarketAnalysis.replaceForCanonicalProduct, {
      canonicalProductId: args.canonicalProductId,
      rows,
    });

    return {
      canonicalProductId: args.canonicalProductId,
      countriesAnalyzed: rows.length,
      availableMarkets: rows.filter((row) =>
        ["formally_registered", "tender_formulary_only", "hospital_import_only", "shortage_listed"].includes(
          row.availabilityStatus
        )
      ).length,
      summary: `Refreshed GCC++ market analysis for ${inputs.product.brandName} across ${rows.length} countries.`,
    };
  },
});

export const getByCanonicalProduct = query({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }) => {
    const [product, rows, gaps] = await Promise.all([
      ctx.db.get(canonicalProductId),
      ctx.db
        .query("canonicalProductMarketAnalyses")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("gapOpportunities")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
    ]);

    if (!product) return null;

    const sortedRows = [...rows].sort((left, right) => {
      const leftIndex = orderedCountries().indexOf(left.country);
      const rightIndex = orderedCountries().indexOf(right.country);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });

    const totalMarketUnits = sortedRows.reduce(
      (sum, row) => sum + (row.marketSizeUnits ?? 0),
      0
    );
    const totalMarketValue = sortedRows.reduce(
      (sum, row) => sum + (row.marketSizeValue ?? 0),
      0
    );
    const totalPatientPopulation = sortedRows.reduce(
      (sum, row) => sum + (row.patientPopulation ?? 0),
      0
    );
    const priorityCountries = [...sortedRows]
      .sort((left, right) => (right.priorityScore ?? 0) - (left.priorityScore ?? 0))
      .slice(0, 3)
      .map((row) => ({
        country: row.country,
        score: row.priorityScore,
        reason: row.priorityReason,
      }));

    const gapSummary = gaps
      .map((gap) => gap.whoDiseaseBurden ?? gap.evidenceSummary)
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)
      .join(" ");

    return {
      product: {
        _id: product._id,
        brandName: product.brandName,
        inn: product.inn,
        therapeuticArea: product.therapeuticArea,
      },
      lastAnalyzedAt: sortedRows.reduce<number | null>(
        (latest, row) =>
          latest === null || row.lastAnalyzedAt > latest ? row.lastAnalyzedAt : latest,
        null
      ),
      countries: sortedRows,
      summary: {
        availableMarkets: sortedRows.filter((row) =>
          ["formally_registered", "tender_formulary_only", "hospital_import_only", "shortage_listed"].includes(
            row.availabilityStatus
          )
        ).length,
        whitespaceMarkets: sortedRows.filter((row) => row.availabilityStatus === "not_found").length,
        totalMarketUnits: totalMarketUnits > 0 ? totalMarketUnits : undefined,
        totalMarketValue: totalMarketValue > 0 ? totalMarketValue : undefined,
        marketValueCurrency:
          sortedRows.find((row) => row.marketValueCurrency)?.marketValueCurrency,
        totalPatientPopulation:
          totalPatientPopulation > 0 ? totalPatientPopulation : undefined,
        avgPrivateShare: averageRounded(sortedRows.map((row) => row.privateChannelShare)),
        avgTenderShare: averageRounded(
          sortedRows.map((row) => row.channelMix?.tenderShare ?? row.publicChannelShare)
        ),
        avgHospitalShare: averageRounded(sortedRows.map((row) => row.hospitalChannelShare)),
        avgInsuredShare: averageRounded(sortedRows.map((row) => row.insuredShare)),
        avgOutOfPocketShare: averageRounded(sortedRows.map((row) => row.outOfPocketShare)),
        topOpportunityScore: Math.max(
          0,
          ...sortedRows.map((row) => row.commercialOpportunityScore ?? row.priorityScore ?? 0)
        ),
        prevalenceSummary:
          sortedRows.map((row) => row.prevalenceText).filter(Boolean)[0] ??
          undefined,
        incidenceSummary:
          sortedRows.map((row) => row.incidenceText).filter(Boolean)[0] ??
          undefined,
        diseaseBurdenSummary: gapSummary || undefined,
        priorityCountries,
      },
    };
  },
});
