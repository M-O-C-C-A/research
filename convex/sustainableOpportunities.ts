/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isTop20OwnerName } from "./continuousOpportunityEngine";
import { parseDateToTimestamp } from "./productIntelligenceHelpers";
import {
  evaluateSustainableGate,
  SUSTAINABLE_TARGET_COUNTRIES,
  type SustainableRegistrationStatus,
  type SustainableTargetCountry,
} from "./sustainableOpportunityQualification";

const DAY = 24 * 60 * 60 * 1000;
const HOME_SOURCE_SYSTEMS = ["drugs_fda", "ema_central", "eu_national_bfarm"] as const;
const TEN_YEARS = 365 * 10 * DAY;

function normalize(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasCountryPartner(
  partners: Array<{ geographies: string[]; confidence: string }> | undefined,
  country?: string
) {
  const normalizedCountry = normalize(country);
  return (partners ?? []).some(
    (partner) =>
      partner.confidence === "confirmed" &&
      (normalizedCountry
        ? partner.geographies.some((geography) => normalize(geography) === normalizedCountry)
        : partner.geographies.some((geography) =>
            ["mena", "middle east", "gulf", "gcc", "saudi arabia", "uae", "egypt"].includes(
              normalize(geography)
            )
          ))
  );
}

function hasConfirmedMenaPresence(company: Doc<"companies">) {
  return (
    company.menaPresence === "established" ||
    company.menaChannelStatus === "established" ||
    company.menaPartnershipStrength === "moderate" ||
    company.menaPartnershipStrength === "entrenched" ||
    hasCountryPartner(company.existingMenaPartners)
  );
}

function hasConflictingTargetPresence(company: Doc<"companies">, country: SustainableTargetCountry) {
  return (
    company.approachTargetRecommendation === "deprioritize" ||
    company.menaPartnershipStrength === "entrenched" ||
    hasCountryPartner(company.existingMenaPartners, country)
  );
}

function confirmedCompanyIdsForDrug(drug: Doc<"drugs">, links: Doc<"drugEntityLinks">[]) {
  const companyIds = new Set<Id<"companies">>();
  if (drug.companyId && drug.productProfile?.ownershipConfidence === "confirmed") {
    companyIds.add(drug.companyId);
  }
  for (const link of links) {
    if (
      link.companyId &&
      link.confidence === "confirmed" &&
      ["manufacturer", "market_authorization_holder"].includes(link.relationshipType)
    ) {
      companyIds.add(link.companyId);
    }
  }
  return companyIds;
}

function supportedPublicUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return undefined;
}

function sourceUrlForCanonicalProduct(
  canonicalProductId: Id<"canonicalProducts"> | undefined,
  sourcesByCanonicalProductId: Map<Id<"canonicalProducts">, Doc<"productSources">[]>
) {
  if (!canonicalProductId) return undefined;
  return sourcesByCanonicalProductId
    .get(canonicalProductId)
    ?.find((source) => HOME_SOURCE_SYSTEMS.includes(source.sourceSystem as (typeof HOME_SOURCE_SYSTEMS)[number]))
    ?.sourceUrl;
}

function targetStatusFromDrug(drug: Doc<"drugs">, country: SustainableTargetCountry) {
  const rows = drug.menaRegistrations?.filter((row) => normalize(row.country) === normalize(country)) ?? [];
  const latest = rows.sort((left, right) => (right.verifiedAt ?? 0) - (left.verifiedAt ?? 0))[0];
  return latest?.status as SustainableRegistrationStatus | undefined;
}

function latestRegistrationFact(
  facts: Doc<"registrationStatusFacts">[],
  country: SustainableTargetCountry
) {
  return facts
    .filter((fact) => fact.country === country)
    .sort((left, right) => right.fetchedAt - left.fetchedAt)[0];
}

export const list = query({
  args: {
    readinessStatus: v.optional(
      v.union(v.literal("needs_contact"), v.literal("outreach_ready"), v.literal("blocked"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { readinessStatus, limit = 50 }) => {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    const rows = readinessStatus
      ? await ctx.db
          .query("candidateOpportunities")
          .withIndex("by_readiness_status_and_rank_score", (q) => q.eq("readinessStatus", readinessStatus))
          .order("desc")
          .take(boundedLimit)
      : (
          await Promise.all([
            ctx.db
              .query("candidateOpportunities")
              .withIndex("by_readiness_status_and_rank_score", (q) => q.eq("readinessStatus", "needs_contact"))
              .order("desc")
              .take(boundedLimit),
            ctx.db
              .query("candidateOpportunities")
              .withIndex("by_readiness_status_and_rank_score", (q) => q.eq("readinessStatus", "outreach_ready"))
              .order("desc")
              .take(boundedLimit),
          ])
        )
          .flat()
          .sort((left, right) => right.rankScore - left.rankScore || right.updatedAt - left.updatedAt)
          .slice(0, boundedLimit);

    return rows.map((row) => ({
      ...row,
      originLabel: "Sustainable opportunity" as const,
    }));
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const [needsContact, outreachReady, blocked] = await Promise.all([
      ctx.db
        .query("candidateOpportunities")
        .withIndex("by_readiness_status_and_rank_score", (q) => q.eq("readinessStatus", "needs_contact"))
        .take(200),
      ctx.db
        .query("candidateOpportunities")
        .withIndex("by_readiness_status_and_rank_score", (q) => q.eq("readinessStatus", "outreach_ready"))
        .take(200),
      ctx.db
        .query("candidateOpportunities")
        .withIndex("by_readiness_status_and_rank_score", (q) => q.eq("readinessStatus", "blocked"))
        .take(200),
    ]);
    return {
      active: needsContact.length + outreachReady.length,
      needsContact: needsContact.length,
      outreachReady: outreachReady.length,
      blocked: blocked.length,
    };
  },
});

export const rebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [canonicalProducts, drugs, links, companies, productSources, canonicalProductLinks] = await Promise.all([
      ctx.db.query("canonicalProducts").withIndex("by_status", (q) => q.eq("status", "active")).take(1_000),
      ctx.db.query("drugs").take(1_000),
      ctx.db.query("drugEntityLinks").take(4_000),
      ctx.db.query("companies").withIndex("by_status", (q) => q.eq("status", "active")).take(1_000),
      ctx.db.query("productSources").take(4_000),
      ctx.db.query("canonicalProductLinks").take(8_000),
    ]);

    const drugsByCanonicalProductId = new Map<Id<"canonicalProducts">, Doc<"drugs">[]>();
    for (const drug of drugs.filter((drug) => drug.status === "active" && drug.canonicalProductId)) {
      const key = drug.canonicalProductId!;
      const current = drugsByCanonicalProductId.get(key) ?? [];
      current.push(drug);
      drugsByCanonicalProductId.set(key, current);
    }

    const linksByDrugId = new Map<Id<"drugs">, Doc<"drugEntityLinks">[]>();
    for (const link of links) {
      const current = linksByDrugId.get(link.drugId) ?? [];
      current.push(link);
      linksByDrugId.set(link.drugId, current);
    }

    const companyById = new Map(companies.map((company) => [company._id, company]));
    const sourceById = new Map(productSources.map((source) => [source._id, source]));
    const sourcesByCanonicalProductId = new Map<Id<"canonicalProducts">, Doc<"productSources">[]>();
    for (const productLink of canonicalProductLinks) {
      const source = sourceById.get(productLink.productSourceId);
      if (!source) continue;
      const current = sourcesByCanonicalProductId.get(productLink.canonicalProductId) ?? [];
      current.push(source);
      sourcesByCanonicalProductId.set(productLink.canonicalProductId, current);
    }

    let considered = 0;
    let published = 0;
    let blocked = 0;

    for (const canonicalProduct of canonicalProducts) {
      const homeSystems = canonicalProduct.sourceSystems.filter((sourceSystem) =>
        HOME_SOURCE_SYSTEMS.includes(sourceSystem as (typeof HOME_SOURCE_SYSTEMS)[number])
      );
      const approvedAt = parseDateToTimestamp(canonicalProduct.approvalDate);
      if (homeSystems.length === 0 || !approvedAt || approvedAt < now - TEN_YEARS) continue;
      considered += 1;

      const matchingDrugs = drugsByCanonicalProductId.get(canonicalProduct._id) ?? [];
      const drug = matchingDrugs.length === 1 ? matchingDrugs[0] : undefined;
      if (!drug) continue;

      const drugLinks = linksByDrugId.get(drug._id) ?? [];
      const confirmedCompanyIds = confirmedCompanyIdsForDrug(drug, drugLinks);
      if (confirmedCompanyIds.size !== 1) continue;
      const companyId = [...confirmedCompanyIds][0];
      const company = companyById.get(companyId);
      if (!company) continue;

      const facts = await ctx.db
        .query("registrationStatusFacts")
        .withIndex("by_canonical_product_and_country", (q) => q.eq("canonicalProductId", canonicalProduct._id))
        .take(50);
      const targetStatuses = Object.fromEntries(
        SUSTAINABLE_TARGET_COUNTRIES.map((country) => {
          const fact = latestRegistrationFact(facts, country);
          return [country, (fact?.status ?? targetStatusFromDrug(drug, country)) as SustainableRegistrationStatus | undefined];
        })
      ) as Record<SustainableTargetCountry, SustainableRegistrationStatus | undefined>;
      const gate = evaluateSustainableGate({
        isOfficial: true,
        approvedAt,
        now,
        productMatchCount: matchingDrugs.length,
        ownershipConfirmed: true,
        isTop20Owner: isTop20OwnerName(company.name),
        hasConfirmedMenaPresence: hasConfirmedMenaPresence(company),
        targetStatuses,
      });
      const conflictCountries = gate.qualifyingCountries.filter((country) =>
        hasConflictingTargetPresence(company, country)
      );
      const blockers = [
        ...gate.blockers,
        ...conflictCountries.map((country) => `A confirmed market partner conflicts with ${country}.`),
      ];
      const targetCountries = gate.qualifyingCountries.filter(
        (country) => !conflictCountries.includes(country)
      );
      const contact = (
        await ctx.db
          .query("leadContacts")
          .withIndex("by_company_and_verified_at", (q) => q.eq("companyId", companyId))
          .order("desc")
          .take(10)
      ).find(
        (item) =>
          item.verifiedAt >= now - 90 * DAY &&
          Boolean(item.email || item.linkedinUrl) &&
          Boolean(supportedPublicUrl(item.sourceUrl))
      );

      const readinessStatus =
        blockers.length > 0 || targetCountries.length === 0
          ? ("blocked" as const)
          : contact
            ? ("outreach_ready" as const)
            : ("needs_contact" as const);
      const rankScore = Math.max(
        0,
        70 +
          targetCountries.length * 8 +
          Math.max(0, 20 - Math.floor((now - approvedAt) / (365 * DAY)) * 2) +
          (contact ? 5 : 0)
      );
      const targetCountry = targetCountries[0] ?? "Saudi Arabia";
      const sourceUrl = sourceUrlForCanonicalProduct(canonicalProduct._id, sourcesByCanonicalProductId) ?? "internal://product-intelligence";
      const existing = await ctx.db
        .query("candidateOpportunities")
        .withIndex("by_drug_and_company_and_target_country", (q) =>
          q.eq("drugId", drug._id).eq("companyId", companyId).eq("targetCountry", targetCountry)
        )
        .unique();
      const next = {
        origin: "sustainable_whitespace" as const,
        readinessStatus,
        drugId: drug._id,
        canonicalProductId: canonicalProduct._id,
        companyId,
        productName: drug.name,
        genericName: drug.genericName,
        approachEntityName: company.name,
        targetCountry,
        targetCountries,
        sourceSystems: homeSystems as Array<(typeof HOME_SOURCE_SYSTEMS)[number]>,
        approvalDate: canonicalProduct.approvalDate,
        approvedAt,
        evidenceObservedAt: now,
        sourceUrl,
        rankScore,
        rankRationale: `Sustainable whitespace: ${targetCountries.length} verified target-market absence${targetCountries.length === 1 ? "" : "s"} from a recent FDA/EMA/BfArM approval.`,
        blockers,
        qualificationReasons: [
          `Home-market approval observed from ${homeSystems.join(", ")} within the last 10 years.`,
          "Exactly one current product record matched the canonical approval.",
          "Manufacturer or MAH ownership is confirmed.",
          targetCountries.length > 0
            ? `${targetCountries.join(", ")} ${targetCountries.length === 1 ? "has" : "have"} official verified-absent registration evidence.`
            : "No target market has verified-absent evidence yet.",
        ],
        contactName: contact?.name,
        contactTitle: contact?.title,
        contactRoute: contact ? (contact.email ? ("email" as const) : ("linkedin" as const)) : undefined,
        lastQualifiedAt: now,
        staleAfter: now + 90 * DAY,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, next);
      } else {
        await ctx.db.insert("candidateOpportunities", { ...next, createdAt: now });
      }
      if (readinessStatus === "blocked") blocked += 1;
      else published += 1;
    }

    return { considered, published, blocked };
  },
});
