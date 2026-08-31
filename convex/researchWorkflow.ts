import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const DAY = 24 * 60 * 60 * 1000;

const TARGET_TYPE = v.union(v.literal("product"), v.literal("company"));
const FINDING_KIND = v.union(
  v.literal("product_profile"),
  v.literal("company_profile"),
  v.literal("ownership"),
  v.literal("registration"),
  v.literal("market_signal"),
  v.literal("partner"),
  v.literal("contact")
);
const SOURCE_KIND = v.union(
  v.literal("official_registry"),
  v.literal("official_signal"),
  v.literal("company_website"),
  v.literal("company_press_release"),
  v.literal("conference"),
  v.literal("linkedin"),
  v.literal("public_web")
);
const CONFIDENCE = v.union(
  v.literal("confirmed"),
  v.literal("likely"),
  v.literal("inferred")
);
const RELATIONSHIP_TYPE = v.union(
  v.literal("manufacturer"),
  v.literal("market_authorization_holder")
);
const REGISTRATION_STATUS = v.union(
  v.literal("registered"),
  v.literal("not_found"),
  v.literal("unverified")
);

const persistedFinding = v.object({
  kind: FINDING_KIND,
  claim: v.string(),
  excerpt: v.string(),
  sourceUrl: v.string(),
  sourceTitle: v.string(),
  sourceKind: SOURCE_KIND,
  confidence: CONFIDENCE,
  proposedCompanyId: v.optional(v.id("companies")),
  proposedCompanyName: v.optional(v.string()),
  relationshipType: v.optional(RELATIONSHIP_TYPE),
  contactName: v.optional(v.string()),
  contactTitle: v.optional(v.string()),
  contactEmail: v.optional(v.string()),
  contactLinkedinUrl: v.optional(v.string()),
  country: v.optional(v.union(v.literal("Saudi Arabia"), v.literal("UAE"), v.literal("Egypt"))),
  registrationStatus: v.optional(REGISTRATION_STATUS),
});

function normalize(value?: string) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") ?? "";
}

function publicUrl(value?: string) {
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

export const getProductContext = internalQuery({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) => {
    const drug = await ctx.db.get(drugId);
    if (!drug) return null;
    const links = await ctx.db
      .query("drugEntityLinks")
      .withIndex("by_drug", (q) => q.eq("drugId", drugId))
      .take(50);
    const companyIds = [...new Set([drug.companyId, ...links.map((link) => link.companyId)].filter(Boolean))] as Id<"companies">[];
    const companies = await Promise.all(companyIds.map((companyId) => ctx.db.get(companyId)));
    const [saudiSignals, uaeSignals, egyptSignals] = await Promise.all([
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Saudi Arabia"))
        .order("desc")
        .take(100),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "UAE"))
        .order("desc")
        .take(100),
      ctx.db
        .query("marketSignals")
        .withIndex("by_country_and_observed_at", (q) => q.eq("country", "Egypt"))
        .order("desc")
        .take(100),
    ]);
    const signals = [...saudiSignals, ...uaeSignals, ...egyptSignals];
    const terms = new Set([normalize(drug.name), normalize(drug.genericName)]);
    const matchingSignals = signals.filter((signal) =>
      signal.productTerms.some((term) => terms.has(normalize(term)))
    );
    return {
      drug,
      links,
      companies: companies.filter((company): company is NonNullable<typeof company> => Boolean(company)),
      matchingSignals,
    };
  },
});

export const getCompanyContext = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) return null;
    const [drugs, contacts] = await Promise.all([
      ctx.db.query("drugs").withIndex("by_company", (q) => q.eq("companyId", companyId)).take(50),
      ctx.db.query("leadContacts").withIndex("by_company_and_verified_at", (q) => q.eq("companyId", companyId)).order("desc").take(20),
    ]);
    return { company, drugs, contacts };
  },
});

export const createRun = internalMutation({
  args: {
    targetType: TARGET_TYPE,
    drugId: v.optional(v.id("drugs")),
    companyId: v.optional(v.id("companies")),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("researchRuns", {
      ...args,
      scopeCountries: ["Saudi Arabia", "UAE", "Egypt"],
      status: "running",
      provider: "openai_web_search",
      model: "gpt-4.1",
      sourceCount: 0,
      findingCount: 0,
      startedAt: Date.now(),
    }),
});

export const completeRun = internalMutation({
  args: {
    runId: v.id("researchRuns"),
    rawOutput: v.string(),
    provider: v.string(),
    model: v.optional(v.string()),
    findings: v.array(persistedFinding),
  },
  handler: async (ctx, { runId, rawOutput, provider, model, findings }) => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("Research run not found.");
    const now = Date.now();
    for (const finding of findings) {
      await ctx.db.insert("researchFindings", {
        ...finding,
        researchRunId: runId,
        targetType: run.targetType,
        drugId: run.drugId,
        companyId: run.companyId,
        retrievedAt: now,
        status: "pending",
      });
    }
    await ctx.db.patch(runId, {
      status: "completed",
      provider,
      model,
      rawOutput: rawOutput.slice(0, 100_000),
      sourceCount: new Set(findings.map((finding) => finding.sourceUrl)).size,
      findingCount: findings.length,
      completedAt: now,
    });
  },
});

export const failRun = internalMutation({
  args: { runId: v.id("researchRuns"), errorMessage: v.string() },
  handler: async (ctx, { runId, errorMessage }) =>
    await ctx.db.patch(runId, {
      status: "error",
      errorMessage,
      completedAt: Date.now(),
    }),
});

export const listByDrug = query({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }) => {
    const runs = await ctx.db
      .query("researchRuns")
      .withIndex("by_drug_and_started_at", (q) => q.eq("drugId", drugId))
      .order("desc")
      .take(10);
    const findings: Doc<"researchFindings">[] = [];
    for (const run of runs) {
      const runFindings: Doc<"researchFindings">[] = await ctx.db
        .query("researchFindings")
        .withIndex("by_research_run", (q) => q.eq("researchRunId", run._id))
        .take(20);
      findings.push(...runFindings);
    }
    findings.sort((left, right) => right.retrievedAt - left.retrievedAt);
    return { runs, findings };
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const runs = await ctx.db
      .query("researchRuns")
      .withIndex("by_company_and_started_at", (q) => q.eq("companyId", companyId))
      .order("desc")
      .take(10);
    const findings: Doc<"researchFindings">[] = [];
    for (const run of runs) {
      const runFindings: Doc<"researchFindings">[] = await ctx.db
        .query("researchFindings")
        .withIndex("by_research_run", (q) => q.eq("researchRunId", run._id))
        .take(20);
      findings.push(...runFindings);
    }
    findings.sort((left, right) => right.retrievedAt - left.retrievedAt);
    return { runs, findings };
  },
});

export const rejectFinding = mutation({
  args: { id: v.id("researchFindings") },
  handler: async (ctx, { id }) => {
    const finding = await ctx.db.get(id);
    if (!finding || finding.status !== "pending") return;
    await ctx.db.patch(id, { status: "rejected", reviewedAt: Date.now() });
  },
});

export const approveFinding = mutation({
  args: { id: v.id("researchFindings") },
  handler: async (ctx, { id }) => {
    const finding = await ctx.db.get(id);
    if (!finding || finding.status !== "pending") return;
    const sourceUrl = publicUrl(finding.sourceUrl);
    if (!sourceUrl) throw new Error("A public source URL is required before approval.");

    if (finding.kind === "ownership") {
      if (!finding.drugId || !finding.proposedCompanyId || !finding.relationshipType) {
        throw new Error("Ownership approval requires a linked product, company, and role.");
      }
      const drugId = finding.drugId;
      const proposedCompanyId = finding.proposedCompanyId;
      const relationshipType = finding.relationshipType;
      const drug = await ctx.db.get(drugId);
      if (!drug) throw new Error("The linked product no longer exists.");
      const links = await ctx.db
        .query("drugEntityLinks")
        .withIndex("by_drug", (q) => q.eq("drugId", drugId))
        .take(50);
      const alreadyLinked = links.some(
        (link) =>
          link.companyId === proposedCompanyId &&
          link.relationshipType === relationshipType
      );
      if (!alreadyLinked) {
        await ctx.db.insert("drugEntityLinks", {
          drugId,
          companyId: proposedCompanyId,
          entityName: finding.proposedCompanyName,
          relationshipType,
          isPrimary: links.length === 0,
          source: finding.sourceTitle,
          url: sourceUrl,
          confidence: "confirmed",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await ctx.db.patch(drugId, {
        companyId: proposedCompanyId,
        productProfile: { ...drug.productProfile, ownershipConfidence: "confirmed" },
      });
    }

    if (finding.kind === "contact") {
      const companyId = finding.proposedCompanyId ?? finding.companyId;
      if (!companyId || !finding.contactName || !finding.contactTitle || (!finding.contactEmail && !finding.contactLinkedinUrl)) {
        throw new Error("Contact approval requires a named person, role, company, and public route.");
      }
      const existing = await ctx.db
        .query("leadContacts")
        .withIndex("by_company_and_source_url", (q) => q.eq("companyId", companyId).eq("sourceUrl", sourceUrl))
        .unique();
      const next = {
        companyId,
        name: finding.contactName,
        title: finding.contactTitle,
        role: roleFromTitle(finding.contactTitle),
        email: finding.contactEmail,
        linkedinUrl: finding.contactLinkedinUrl,
        sourceUrl,
        sourceKind: finding.sourceKind === "linkedin" ? ("linkedin" as const) : ("company_website" as const),
        verifiedAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (existing) await ctx.db.patch(existing._id, next);
      else await ctx.db.insert("leadContacts", { ...next, createdAt: Date.now() });
    }

    if (finding.kind === "registration") {
      if (!finding.drugId || !finding.country || !finding.registrationStatus || finding.sourceKind !== "official_registry") {
        throw new Error("Registration approval requires an official registry source.");
      }
      const drug = await ctx.db.get(finding.drugId);
      if (!drug) throw new Error("The linked product no longer exists.");
      const registrations = drug.menaRegistrations ?? [];
      const withoutCountry = registrations.filter((entry) => entry.country !== finding.country);
      await ctx.db.patch(finding.drugId, {
        menaRegistrations: [
          ...withoutCountry,
          {
            country: finding.country,
            status: finding.registrationStatus,
            source: finding.sourceTitle,
            url: sourceUrl,
            verifiedAt: Date.now(),
          },
        ],
        menaRegistrationCount: [...withoutCountry, finding].filter((entry) => entry.status === "registered").length,
      });
    }

    if (["product_profile", "company_profile", "market_signal", "partner"].includes(finding.kind)) {
      const existingEvidence = await ctx.db
        .query("approvedResearchEvidence")
        .withIndex("by_research_finding", (q) => q.eq("researchFindingId", id))
        .unique();
      if (!existingEvidence) {
        await ctx.db.insert("approvedResearchEvidence", {
          researchFindingId: id,
          drugId: finding.drugId,
          companyId: finding.companyId,
          kind: finding.kind,
          claim: finding.claim,
          excerpt: finding.excerpt,
          sourceUrl,
          sourceTitle: finding.sourceTitle,
          sourceKind: finding.sourceKind,
          country: finding.country,
          approvedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(id, { status: "approved", reviewedAt: Date.now() });
    if (finding.kind === "ownership" || finding.kind === "contact" || finding.kind === "registration") {
      await ctx.scheduler.runAfter(0, api.leadScans.requalifyCurrentSignals, {});
    }
  },
});

export const isFreshFinding = (retrievedAt: number) => retrievedAt >= Date.now() - 90 * DAY;
