import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateLeadGate, isOutreachQualifyingSignal, LEAD_EVIDENCE_MAX_AGE_DAYS } from "./leadQualification";

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_STAGES = ["new", "working", "contacted", "replied"] as const;

const LEAD_STAGE = v.union(
  v.literal("new"),
  v.literal("working"),
  v.literal("contacted"),
  v.literal("replied"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("expired"),
  v.literal("disqualified")
);

const SOURCE_SYSTEM = v.union(
  v.literal("sfda_current_shortage"),
  v.literal("sfda_anticipated_shortage"),
  v.literal("nupco_tenders"),
  v.literal("nupco_tender_plan"),
  v.literal("etimad"),
  v.literal("mohap_import"),
  v.literal("uae_public_procurement"),
  v.literal("egypt_eprocurement")
);

const SIGNAL_TYPE = v.union(
  v.literal("shortage"),
  v.literal("anticipated_shortage"),
  v.literal("tender"),
  v.literal("procurement"),
  v.literal("registration")
);

const CONTACT_ROLE = v.union(
  v.literal("business_development"),
  v.literal("international_markets"),
  v.literal("licensing"),
  v.literal("commercial"),
  v.literal("executive")
);

const CONTACT_SOURCE_KIND = v.union(
  v.literal("company_website"),
  v.literal("company_press_release"),
  v.literal("conference"),
  v.literal("linkedin"),
  v.literal("manual")
);

const ingestedSignal = v.object({
  externalId: v.string(),
  country: v.union(v.literal("Saudi Arabia"), v.literal("Egypt")),
  signalType: SIGNAL_TYPE,
  status: v.union(v.literal("open"), v.literal("observed")),
  title: v.string(),
  productTerms: v.array(v.string()),
  sourceUrl: v.string(),
  publishedAt: v.optional(v.number()),
  deadline: v.optional(v.number()),
  parsedFacts: v.record(v.string(), v.string()),
});

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function supportedPublicUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return undefined;
}

function roleFromTitle(title: string) {
  const value = title.toLowerCase();
  if (/licens|alliance|partner/.test(value)) return "licensing" as const;
  if (/international|export|global/.test(value)) return "international_markets" as const;
  if (/business development|\bbd\b/.test(value)) return "business_development" as const;
  if (/chief|ceo|founder|managing director|president/.test(value)) return "executive" as const;
  return "commercial" as const;
}

function hasCountryPartner(
  partners: Array<{ geographies: string[]; confidence: string }> | undefined,
  country: string
) {
  const normalizedCountry = normalize(country);
  return (partners ?? []).some(
    (partner) =>
      partner.confidence === "confirmed" &&
      partner.geographies.some((geography) => normalize(geography) === normalizedCountry)
  );
}

function signalUrgency(signalType: string) {
  if (signalType === "shortage") return 36;
  if (signalType === "anticipated_shortage") return 30;
  if (signalType === "tender") return 28;
  if (signalType === "procurement") return 24;
  return 0;
}

function exactProductMatches(signal: Doc<"marketSignals">, drugs: Doc<"drugs">[]) {
  const terms = [...signal.productTerms, signal.parsedFacts.genericName]
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
  return drugs.filter((drug) =>
    [drug.name, drug.genericName].map(normalize).some((identity) => terms.includes(identity))
  );
}

function productCandidateScore(signal: Doc<"marketSignals">, drug: Doc<"drugs">) {
  const terms = [...signal.productTerms, signal.parsedFacts.genericName]
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
  const identities = [drug.name, drug.genericName].map(normalize).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    for (const identity of identities) {
      if (term === identity) score = Math.max(score, 100);
      else if (identity.length >= 4 && term.includes(identity)) score = Math.max(score, 75);
      else if (term.length >= 4 && identity.includes(term)) score = Math.max(score, 65);
    }
  }
  return score;
}

function companyIdsForDrug(drug: Doc<"drugs">, links: Doc<"drugEntityLinks">[]) {
  const companyIds = new Set<Id<"companies">>();
  if (drug.companyId) companyIds.add(drug.companyId);
  for (const link of links) {
    if (
      link.companyId &&
      ["manufacturer", "market_authorization_holder"].includes(link.relationshipType)
    ) {
      companyIds.add(link.companyId);
    }
  }
  return companyIds;
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

function companyHasConflictingMarketAccess(company: Doc<"companies"> | undefined, country: string) {
  if (!company) return false;
  return (
    company.approachTargetRecommendation === "deprioritize" ||
    company.menaPartnershipStrength === "entrenched" ||
    hasCountryPartner(company.existingMenaPartners, country)
  );
}

function enrichQuickWinLead(lead: Doc<"actionableLeads">) {
  return {
    ...lead,
    origin: lead.origin ?? ("quick_win_signal" as const),
    originLabel: "Quick win" as const,
    readinessStatus: lead.readinessStatus ?? ("outreach_ready" as const),
    rankRationale: lead.rankRationale ?? "Quick-win signal ranked by freshness, urgency, deadline, and contact route.",
    blockers: lead.blockers ?? [],
    targetCountry: lead.country,
  };
}

export const list = query({
  args: { stage: v.optional(LEAD_STAGE), limit: v.optional(v.number()) },
  handler: async (ctx, { stage, limit = 50 }) => {
    if (stage) {
      const rows = await ctx.db
        .query("actionableLeads")
        .withIndex("by_stage_and_rank_score", (q) => q.eq("stage", stage))
        .order("desc")
        .take(limit);
      return rows.map(enrichQuickWinLead);
    }

    const groups = await Promise.all(
      ACTIVE_STAGES.map((activeStage) =>
        ctx.db
          .query("actionableLeads")
          .withIndex("by_stage_and_rank_score", (q) => q.eq("stage", activeStage))
          .order("desc")
          .take(limit)
      )
    );
    return groups
      .flat()
      .sort((left, right) => right.rankScore - left.rankScore || right.updatedAt - left.updatedAt)
      .slice(0, limit)
      .map(enrichQuickWinLead);
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies"), limit: v.optional(v.number()) },
  handler: async (ctx, { companyId, limit = 25 }) => {
    const groups = await Promise.all(
      ACTIVE_STAGES.map((stage) =>
        ctx.db
          .query("actionableLeads")
          .withIndex("by_company_and_stage", (q) => q.eq("companyId", companyId).eq("stage", stage))
          .order("desc")
          .take(limit)
      )
    );
    return groups
      .flat()
      .sort((left, right) => right.rankScore - left.rankScore || right.updatedAt - left.updatedAt)
      .slice(0, limit);
  },
});

export const get = query({
  args: { id: v.id("actionableLeads") },
  handler: async (ctx, { id }) => {
    const lead = await ctx.db.get(id);
    if (!lead) return null;
    const [signal, contact, company, drug] = await Promise.all([
      ctx.db.get(lead.signalId),
      ctx.db.get(lead.leadContactId),
      ctx.db.get(lead.companyId),
      ctx.db.get(lead.drugId),
    ]);
    const snapshot = signal ? await ctx.db.get(signal.sourceSnapshotId) : null;
    return { lead, signal, snapshot, contact, company, drug };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const groups = await Promise.all(
      ACTIVE_STAGES.map((stage) =>
        ctx.db
          .query("actionableLeads")
          .withIndex("by_stage_and_rank_score", (q) => q.eq("stage", stage))
          .take(250)
      )
    );
    const active = groups.flat();
    return {
      active: active.length,
      new: groups[0].length,
      working: groups[1].length,
      contacted: groups[2].length,
    };
  },
});

export const listSignalInbox = query({
  args: { limit: v.optional(v.number()), includeNotRelevant: v.optional(v.boolean()) },
  handler: async (ctx, { limit = 100, includeNotRelevant = false }) => {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    const [saudiSignals, uaeSignals, egyptSignals, drugs, links, companies, contacts] = await Promise.all([
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Saudi Arabia"))
        .order("desc")
        .take(boundedLimit),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "UAE"))
        .order("desc")
        .take(boundedLimit),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Egypt"))
        .order("desc")
        .take(boundedLimit),
      ctx.db.query("drugs").take(1_000),
      ctx.db.query("drugEntityLinks").take(4_000),
      ctx.db.query("companies").take(1_000),
      ctx.db.query("leadContacts").take(2_000),
    ]);
    const signals = [...saudiSignals, ...uaeSignals, ...egyptSignals]
      .filter((signal) => isOutreachQualifyingSignal(signal.signalType))
      .sort((left, right) => right.observedAt - left.observedAt)
      .slice(0, boundedLimit);
    const resolutions = await Promise.all(
      signals.map((signal) =>
        ctx.db
          .query("signalResolutions")
          .withIndex("by_signal", (q) => q.eq("signalId", signal._id))
          .unique()
      )
    );
    const resolutionBySignal = new Map(signals.map((signal, index) => [signal._id, resolutions[index]]));
    const linksByDrug = new Map<Id<"drugs">, Doc<"drugEntityLinks">[]>();
    for (const link of links) {
      const current = linksByDrug.get(link.drugId) ?? [];
      current.push(link);
      linksByDrug.set(link.drugId, current);
    }
    const companyById = new Map(companies.map((company) => [company._id, company]));
    const contactsByCompany = new Map<Id<"companies">, Doc<"leadContacts">[]>();
    for (const contact of contacts) {
      const current = contactsByCompany.get(contact.companyId) ?? [];
      current.push(contact);
      contactsByCompany.set(contact.companyId, current);
    }
    const now = Date.now();

    return signals.flatMap((signal) => {
      const resolution = resolutionBySignal.get(signal._id);
      if (!includeNotRelevant && resolution?.productMatchStatus === "not_relevant") return [];

      const exactMatches = exactProductMatches(signal, drugs);
      const candidateDrugs = drugs
        .map((drug) => ({ drug, score: productCandidateScore(signal, drug) }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.drug.name.localeCompare(right.drug.name))
        .slice(0, 6);
      // Broad NUPCO supply and services notices are valuable source records, but are
      // not product-company pursuits until a named product appears in the notice.
      if (
        ["nupco_tenders", "nupco_tender_plan", "etimad", "egypt_eprocurement"].includes(signal.sourceSystem) &&
        candidateDrugs.length === 0
      ) {
        return [];
      }
      const selectedDrug =
        resolution?.productMatchStatus === "matched" && resolution.drugId
          ? drugs.find((drug) => drug._id === resolution.drugId)
          : exactMatches.length === 1
            ? exactMatches[0]
            : undefined;
      const selectedLinks = selectedDrug ? linksByDrug.get(selectedDrug._id) ?? [] : [];
      const possibleCompanyIds = selectedDrug ? companyIdsForDrug(selectedDrug, selectedLinks) : new Set<Id<"companies">>();
      const confirmedCompanyIds = selectedDrug
        ? confirmedCompanyIdsForDrug(selectedDrug, selectedLinks)
        : new Set<Id<"companies">>();
      const manualCompanyId =
        resolution?.ownershipCompanyId &&
        resolution.ownershipEvidenceUrl &&
        possibleCompanyIds.has(resolution.ownershipCompanyId)
          ? resolution.ownershipCompanyId
          : undefined;
      const ownerCompanyId =
        manualCompanyId ?? (confirmedCompanyIds.size === 1 ? [...confirmedCompanyIds][0] : undefined);
      const ownerCompany = ownerCompanyId ? companyById.get(ownerCompanyId) : undefined;
      const contact = ownerCompanyId
        ? (contactsByCompany.get(ownerCompanyId) ?? []).find(
            (item) =>
              item.verifiedAt >= now - 90 * DAY &&
              Boolean(item.email || item.linkedinUrl) &&
              Boolean(supportedPublicUrl(item.sourceUrl))
          )
        : undefined;
      const gate = evaluateLeadGate({
        isOfficial: signal.isOfficial,
        observedAt: signal.observedAt,
        now,
        signalType: signal.signalType,
        productMatchCount: selectedDrug ? 1 : exactMatches.length,
        ownershipConfirmed: Boolean(ownerCompanyId),
        conflictingMarketAccess: companyHasConflictingMarketAccess(ownerCompany, signal.country),
        hasNamedContact: Boolean(contact?.name),
        hasPublicRoute: Boolean(contact?.email || contact?.linkedinUrl),
        contactVerifiedAt: contact?.verifiedAt,
        requireContact: false,
      });
      const readinessStatus = gate.eligible
        ? contact
          ? ("outreach_ready" as const)
          : ("needs_contact" as const)
        : ("blocked" as const);
      const contactBlockers =
        gate.eligible && !contact
          ? ["No current public business contact is available yet."]
          : [];
      const suggestedAction = !signal.isOfficial || signal.observedAt < now - LEAD_EVIDENCE_MAX_AGE_DAYS * DAY
        ? "No action: evidence has expired"
        : resolution?.productMatchStatus === "not_relevant"
          ? "Marked not relevant"
          : !selectedDrug
            ? candidateDrugs.length > 0 ? "Confirm the product match" : "Find or add the matching product"
            : !ownerCompanyId
              ? "Verify manufacturer or MAH ownership"
              : companyHasConflictingMarketAccess(ownerCompany, signal.country)
                ? "Review the existing market partner"
                : !contact
                  ? "Add a current public business contact"
                  : "Ready for qualification";
      return [{
        signal,
        resolution,
        candidateDrugs: candidateDrugs.map(({ drug, score }) => ({
          _id: drug._id,
          name: drug.name,
          genericName: drug.genericName,
          score,
        })),
        selectedDrug: selectedDrug && { _id: selectedDrug._id, name: selectedDrug.name, genericName: selectedDrug.genericName },
        ownerCompany: ownerCompany && { _id: ownerCompany._id, name: ownerCompany.name },
        ownershipCandidates: [...possibleCompanyIds]
          .map((companyId) => companyById.get(companyId))
          .filter((company): company is Doc<"companies"> => Boolean(company))
          .map((company) => ({ _id: company._id, name: company.name })),
        contact: contact && { name: contact.name, title: contact.title, email: contact.email, linkedinUrl: contact.linkedinUrl },
        eligible: gate.eligible,
        origin: "quick_win_signal" as const,
        originLabel: "Quick win" as const,
        readinessStatus,
        rankRationale: "Quick-win signal ranked by freshness, urgency, deadline, and contact route.",
        blockers: [...gate.blockers, ...contactBlockers],
        targetCountry: signal.country,
        suggestedAction,
      }];
    });
  },
});

export const inboxStats = query({
  args: {},
  handler: async (ctx) => {
    const [saudiSignals, uaeSignals, egyptSignals] = await Promise.all([
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Saudi Arabia"))
        .order("desc")
        .take(200),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "UAE"))
        .order("desc")
        .take(200),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Egypt"))
        .order("desc")
        .take(200),
    ]);
    const now = Date.now();
    const outreachSignals = [...saudiSignals, ...uaeSignals, ...egyptSignals].filter((signal) =>
      isOutreachQualifyingSignal(signal.signalType)
    );
    return {
      currentOutreachSignals: outreachSignals.filter((signal) => signal.observedAt >= now - LEAD_EVIDENCE_MAX_AGE_DAYS * DAY).length,
      staleOutreachSignals: outreachSignals.filter((signal) => signal.observedAt < now - LEAD_EVIDENCE_MAX_AGE_DAYS * DAY).length,
    };
  },
});

export const latestScan = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("leadScanRuns")
      .withIndex("by_started_at")
      .order("desc")
      .first(),
});

export const listCurrentSignalIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [saudiSignals, uaeSignals, egyptSignals] = await Promise.all([
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Saudi Arabia"))
        .order("desc")
        .take(200),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "UAE"))
        .order("desc")
        .take(200),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Egypt"))
        .order("desc")
        .take(200),
    ]);
    const now = Date.now();
    return [...saudiSignals, ...uaeSignals, ...egyptSignals]
      .filter((signal) => signal.observedAt >= now - LEAD_EVIDENCE_MAX_AGE_DAYS * DAY && isOutreachQualifyingSignal(signal.signalType))
      .map((signal) => signal._id);
  },
});

export const updateStage = mutation({
  args: { id: v.id("actionableLeads"), stage: LEAD_STAGE },
  handler: async (ctx, { id, stage }) => {
    await ctx.db.patch(id, { stage, updatedAt: Date.now() });
  },
});

export const confirmProductMatch = mutation({
  args: { signalId: v.id("marketSignals"), drugId: v.id("drugs") },
  handler: async (ctx, { signalId, drugId }) => {
    const [signal, drug, existing] = await Promise.all([
      ctx.db.get(signalId),
      ctx.db.get(drugId),
      ctx.db.query("signalResolutions").withIndex("by_signal", (q) => q.eq("signalId", signalId)).unique(),
    ]);
    if (!signal || !drug) throw new Error("The signal or product no longer exists.");
    const now = Date.now();
    const next = {
      signalId,
      drugId,
      productMatchStatus: "matched" as const,
      productMatchMethod: "manual" as const,
      resolvedAt: now,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }
    return await ctx.db.insert("signalResolutions", next);
  },
});

export const markSignalNotRelevant = mutation({
  args: { signalId: v.id("marketSignals") },
  handler: async (ctx, { signalId }) => {
    const existing = await ctx.db
      .query("signalResolutions")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .unique();
    const now = Date.now();
    const next = {
      signalId,
      productMatchStatus: "not_relevant" as const,
      productMatchMethod: "manual" as const,
      resolvedAt: now,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }
    return await ctx.db.insert("signalResolutions", next);
  },
});

export const verifyManufacturerOwnership = mutation({
  args: {
    signalId: v.id("marketSignals"),
    companyId: v.id("companies"),
    evidenceUrl: v.string(),
    evidenceNote: v.optional(v.string()),
  },
  handler: async (ctx, { signalId, companyId, evidenceUrl, evidenceNote }) => {
    const sourceUrl = supportedPublicUrl(evidenceUrl);
    if (!sourceUrl) throw new Error("A public ownership source URL is required.");
    const resolution = await ctx.db
      .query("signalResolutions")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .unique();
    if (!resolution?.drugId || resolution.productMatchStatus !== "matched") {
      throw new Error("Confirm the product match before verifying ownership.");
    }
    const drug = await ctx.db.get(resolution.drugId);
    if (!drug) throw new Error("The linked product no longer exists.");
    const links = await ctx.db
      .query("drugEntityLinks")
      .withIndex("by_drug", (q) => q.eq("drugId", drug._id))
      .take(20);
    if (!companyIdsForDrug(drug, links).has(companyId)) {
      throw new Error("Ownership can only be verified for a manufacturer or MAH already linked to this product.");
    }
    await ctx.db.patch(resolution._id, {
      ownershipCompanyId: companyId,
      ownershipEvidenceUrl: sourceUrl,
      ownershipEvidenceNote: evidenceNote?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const upsertPublicContact = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    title: v.string(),
    role: CONTACT_ROLE,
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    sourceUrl: v.string(),
    sourceKind: CONTACT_SOURCE_KIND,
    verifiedAt: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.email && !args.linkedinUrl) {
      throw new Error("A public work email or direct LinkedIn profile is required.");
    }
    const sourceUrl = supportedPublicUrl(args.sourceUrl);
    if (!sourceUrl) throw new Error("A public source URL is required.");

    const existing = await ctx.db
      .query("leadContacts")
      .withIndex("by_company_and_source_url", (q) =>
        q.eq("companyId", args.companyId).eq("sourceUrl", sourceUrl)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, sourceUrl, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("leadContacts", { ...args, sourceUrl, createdAt: now, updatedAt: now });
  },
});

export const syncExistingCompanyContacts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").withIndex("by_name").take(500);
    const now = Date.now();
    let synced = 0;

    for (const company of companies) {
      const contacts = company.keyContacts ?? [];
      for (const contact of contacts) {
        if (contact.confidence === "inferred") continue;
        const sourceUrl = supportedPublicUrl(contact.linkedinUrl) ?? supportedPublicUrl(company.website);
        const verifiedAt = contact.lastVerifiedAt ?? company.researchedAt;
        if (!sourceUrl || !verifiedAt || (!contact.email && !contact.linkedinUrl)) continue;
        const existing = await ctx.db
          .query("leadContacts")
          .withIndex("by_company_and_source_url", (q) =>
            q.eq("companyId", company._id).eq("sourceUrl", sourceUrl)
          )
          .unique();
        const next = {
          companyId: company._id,
          name: contact.name,
          title: contact.title,
          role: roleFromTitle(contact.title),
          email: contact.email,
          linkedinUrl: contact.linkedinUrl,
          sourceUrl,
          sourceKind: contact.linkedinUrl ? ("linkedin" as const) : ("company_website" as const),
          verifiedAt,
          updatedAt: now,
        };
        if (existing) {
          await ctx.db.patch(existing._id, next);
        } else {
          await ctx.db.insert("leadContacts", { ...next, createdAt: now });
        }
        synced += 1;
      }
    }
    return synced;
  },
});

export const ingestOfficialSignals = internalMutation({
  args: {
    sourceSystem: SOURCE_SYSTEM,
    sourceRecordId: v.string(),
    sourceUrl: v.string(),
    country: v.union(v.literal("Saudi Arabia"), v.literal("Egypt")),
    title: v.optional(v.string()),
    rawContent: v.string(),
    contentHash: v.string(),
    parserVersion: v.string(),
    httpStatus: v.optional(v.number()),
    signals: v.array(ingestedSignal),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const snapshotId = await ctx.db.insert("sourceSnapshots", {
      sourceSystem: args.sourceSystem,
      sourceRecordId: args.sourceRecordId,
      sourceUrl: args.sourceUrl,
      country: args.country,
      title: args.title,
      rawContent: args.rawContent.slice(0, 250_000),
      contentHash: args.contentHash,
      parserVersion: args.parserVersion,
      fetchedAt: now,
      httpStatus: args.httpStatus,
    });
    const signalIds: Id<"marketSignals">[] = [];
    let created = 0;

    for (const signal of args.signals) {
      const existing = await ctx.db
        .query("marketSignals")
        .withIndex("by_source_system_and_external_id", (q) =>
          q.eq("sourceSystem", args.sourceSystem).eq("externalId", signal.externalId)
        )
        .unique();
      const next = {
        sourceSnapshotId: snapshotId,
        sourceSystem: args.sourceSystem,
        externalId: signal.externalId,
        country: signal.country,
        signalType: signal.signalType,
        status: signal.status,
        title: signal.title,
        productTerms: [...new Set(signal.productTerms.map((term) => term.trim()).filter(Boolean))],
        sourceUrl: signal.sourceUrl,
        publishedAt: signal.publishedAt,
        deadline: signal.deadline,
        observedAt: now,
        isOfficial: true,
        parsedFacts: signal.parsedFacts,
        contentHash: args.contentHash,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, next);
        signalIds.push(existing._id);
      } else {
        signalIds.push(await ctx.db.insert("marketSignals", { ...next, createdAt: now }));
        created += 1;
      }
    }
    return { snapshotId, signalIds, created };
  },
});

export const syncLatestMohapImport = internalMutation({
  args: {},
  handler: async (ctx) => {
    const latestImport = await ctx.db
      .query("registrationImports")
      .withIndex("by_status", (q) => q.eq("status", "applied"))
      .order("desc")
      .take(1);
    const importDoc = latestImport[0];
    if (!importDoc || importDoc.sourceMarket !== "UAE") return { signals: 0 };

    const rows = await ctx.db
      .query("registrationImportRows")
      .withIndex("by_import", (q) => q.eq("importId", importDoc._id))
      .take(500);
    const uaeRows = rows.filter((row) => row.country.toLowerCase() === "uae");
    if (uaeRows.length === 0) return { signals: 0 };

    const now = Date.now();
    const sourceUrl = "https://mohap.gov.ae/en/services/request-for-a-price-list-of-registered-medications";
    const snapshotId = await ctx.db.insert("sourceSnapshots", {
      sourceSystem: "mohap_import",
      sourceRecordId: importDoc._id,
      sourceUrl,
      country: "UAE",
      title: importDoc.fileName,
      rawContent: JSON.stringify({ importId: importDoc._id, rows: uaeRows.length }),
      contentHash: `${importDoc._id}:${importDoc.updatedAt}`,
      parserVersion: "mohap-import-v1",
      fetchedAt: now,
    });

    for (const row of uaeRows) {
      const externalId = row.sourceRecordId ?? `${importDoc._id}:${row.sourceSheet}:${row.sourceRowNumber}`;
      const existing = await ctx.db
        .query("marketSignals")
        .withIndex("by_source_system_and_external_id", (q) =>
          q.eq("sourceSystem", "mohap_import").eq("externalId", externalId)
        )
        .unique();
      const next = {
        sourceSnapshotId: snapshotId,
        sourceSystem: "mohap_import" as const,
        externalId,
        country: "UAE" as const,
        signalType: "registration" as const,
        status: "observed" as const,
        title: `MoHAP registration: ${row.productName}`,
        productTerms: [row.productName, row.genericName].filter((term): term is string => Boolean(term)),
        sourceUrl,
        publishedAt: undefined,
        deadline: undefined,
        observedAt: now,
        isOfficial: true,
        parsedFacts: {
          registrationStatus: row.registrationStatus,
          manufacturer: row.manufacturerName ?? "",
          mah: row.mahName ?? "",
          registrationNumber: row.registrationNumber ?? "",
        },
        contentHash: `${importDoc._id}:${importDoc.updatedAt}`,
        updatedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, next);
      else await ctx.db.insert("marketSignals", { ...next, createdAt: now });
    }
    return { signals: uaeRows.length };
  },
});

export const requalifySignals = internalMutation({
  args: { signalIds: v.array(v.id("marketSignals")) },
  handler: async (ctx, { signalIds }) => {
    const now = Date.now();
    const drugs = await ctx.db.query("drugs").take(1_000);
    let published = 0;

    for (const signalId of signalIds) {
      const signal = await ctx.db.get(signalId);
      if (!signal) continue;

      const resolution = await ctx.db
        .query("signalResolutions")
        .withIndex("by_signal", (q) => q.eq("signalId", signalId))
        .unique();
      if (resolution?.productMatchStatus === "not_relevant") continue;
      const matchingDrugs =
        resolution?.productMatchStatus === "matched" && resolution.drugId
          ? drugs.filter((drug) => drug._id === resolution.drugId)
          : exactProductMatches(signal, drugs);
      if (matchingDrugs.length !== 1) continue;
      const drug = matchingDrugs[0];

      const links = await ctx.db
        .query("drugEntityLinks")
        .withIndex("by_drug", (q) => q.eq("drugId", drug._id))
        .take(10);
      const confirmedCompanyIds = confirmedCompanyIdsForDrug(drug, links);
      if (
        resolution?.ownershipCompanyId &&
        resolution.ownershipEvidenceUrl &&
        companyIdsForDrug(drug, links).has(resolution.ownershipCompanyId)
      ) {
        confirmedCompanyIds.add(resolution.ownershipCompanyId);
      }
      if (confirmedCompanyIds.size !== 1) continue;
      const companyId = [...confirmedCompanyIds][0];
      const company = await ctx.db.get(companyId);
      if (!company || company.status !== "active") continue;
      const conflictingMarketAccess = companyHasConflictingMarketAccess(company, signal.country);

      const contacts = await ctx.db
        .query("leadContacts")
        .withIndex("by_company_and_verified_at", (q) => q.eq("companyId", companyId))
        .order("desc")
        .take(10);
      const contact = contacts.find(
        (item) =>
          item.verifiedAt >= now - 90 * DAY &&
          Boolean(item.email || item.linkedinUrl) &&
          Boolean(supportedPublicUrl(item.sourceUrl))
      );
      const gate = evaluateLeadGate({
        isOfficial: signal.isOfficial,
        observedAt: signal.observedAt,
        now,
        signalType: signal.signalType,
        productMatchCount: matchingDrugs.length,
        ownershipConfirmed: confirmedCompanyIds.size === 1,
        conflictingMarketAccess,
        hasNamedContact: Boolean(contact?.name),
        hasPublicRoute: Boolean(contact?.email || contact?.linkedinUrl),
        contactVerifiedAt: contact?.verifiedAt,
        requireContact: false,
      });
      if (!gate.eligible || !contact) continue;

      const contactRoute = contact.email ? ("email" as const) : ("linkedin" as const);
      const signalAgeDays = Math.max(0, Math.floor((now - signal.observedAt) / DAY));
      const deadlineBoost = signal.deadline && signal.deadline > now ? 15 : 0;
      const rankScore = Math.max(0, 100 - signalAgeDays * 4) + signalUrgency(signal.signalType) + deadlineBoost + (contactRoute === "email" ? 5 : 0);
      const staleAfter = Math.min(signal.observedAt + 14 * DAY, contact.verifiedAt + 90 * DAY);
      const qualificationReasons = [
        `Official ${signal.sourceSystem.replaceAll("_", " ")} evidence observed ${new Date(signal.observedAt).toISOString().slice(0, 10)}.`,
        "Exactly one current product record matched the source term.",
        "Manufacturer or MAH relationship is confirmed in the product record.",
        `Named ${contact.role.replaceAll("_", " ")} contact has a current public ${contactRoute} route.`,
      ];
      const existing = await ctx.db
        .query("actionableLeads")
        .withIndex("by_signal_and_drug_and_company", (q) =>
          q.eq("signalId", signal._id).eq("drugId", drug._id).eq("companyId", companyId)
        )
        .unique();
      const next = {
        signalId: signal._id,
        drugId: drug._id,
        companyId,
        leadContactId: contact._id,
        country: signal.country,
        productName: drug.name,
        genericName: drug.genericName,
        approachEntityName: company.name,
        contactName: contact.name,
        contactTitle: contact.title,
        contactRoute,
        signalType: signal.signalType,
        signalTitle: signal.title,
        sourceUrl: signal.sourceUrl,
        deadline: signal.deadline,
        origin: "quick_win_signal" as const,
        readinessStatus: "outreach_ready" as const,
        rankRationale: "Quick-win signal ranked by freshness, urgency, deadline, and contact route.",
        blockers: [] as string[],
        rankScore,
        qualificationReasons,
        lastQualifiedAt: now,
        staleAfter,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...next,
          stage: existing.stage === "expired" ? "new" : existing.stage,
        });
      } else {
        await ctx.db.insert("actionableLeads", { ...next, stage: "new", createdAt: now });
      }
      published += 1;
    }
    return { published };
  },
});

export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("actionableLeads")
      .withIndex("by_stale_after", (q) => q.lt("staleAfter", now))
      .take(200);
    let expired = 0;
    for (const lead of stale) {
      if (["won", "lost", "disqualified", "expired"].includes(lead.stage)) continue;
      await ctx.db.patch(lead._id, { stage: "expired", updatedAt: now });
      expired += 1;
    }
    return expired;
  },
});

export const createScanRun = internalMutation({
  args: {
    trigger: v.union(v.literal("manual"), v.literal("scheduled")),
    sourceSystems: v.array(SOURCE_SYSTEM),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("leadScanRuns", {
      ...args,
      status: "running",
      signalsFound: 0,
      leadsPublished: 0,
      leadsExpired: 0,
      warnings: [],
      startedAt: Date.now(),
    }),
});

export const completeScanRun = internalMutation({
  args: {
    id: v.id("leadScanRuns"),
    status: v.union(v.literal("completed"), v.literal("partial"), v.literal("error")),
    signalsFound: v.number(),
    leadsPublished: v.number(),
    leadsExpired: v.number(),
    warnings: v.array(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      signalsFound: args.signalsFound,
      leadsPublished: args.leadsPublished,
      leadsExpired: args.leadsExpired,
      warnings: args.warnings.slice(0, 30),
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
  },
});
