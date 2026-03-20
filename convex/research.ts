"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  createResearchClient,
  createStructuredWebSearchResponse,
} from "./openaiResearch";
import { KEMEDICA_CONTEXT } from "../src/lib/brand";
import {
  buildDisqualifierReasons,
  buildDistributorFitRationale,
  normalizePipelineStage,
} from "./distributorFit";

// ── APIFY LinkedIn helper ─────────────────────────────────────────────────────
// Finds BD-relevant employees from a LinkedIn company page if APIFY_TOKEN is set.
async function findContactsViaApify(
  linkedinCompanyUrl: string
): Promise<Array<{ name: string; title: string; linkedinUrl: string }>> {
  const token = process.env.APIFY_TOKEN;
  if (!token || !linkedinCompanyUrl) return [];
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~linkedin-company-employee-search/runs?token=${token}&waitForFinish=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyUrl: linkedinCompanyUrl,
          maxItems: 25,
          keywords:
            "business development international export licensing partnerships commercial",
        }),
      }
    );
    if (!runRes.ok) return [];
    const run = (await runRes.json()) as { data: { defaultDatasetId: string } };
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${run.data.defaultDatasetId}/items?token=${token}&limit=25`
    );
    if (!dataRes.ok) return [];
    const items = (await dataRes.json()) as Record<string, unknown>[];
    const BD_KW = [
      "business development",
      "international",
      "export",
      "licensing",
      "partnerships",
      "commercial",
      "bd director",
      "bd manager",
      "out-licensing",
      "in-licensing",
      "strategic alliances",
    ];
    return items
      .filter((item) => {
        const title = String(item.title ?? item.jobTitle ?? "").toLowerCase();
        return BD_KW.some((k) => title.includes(k));
      })
      .slice(0, 5)
      .map((item) => ({
        name: String(item.fullName ?? item.name ?? ""),
        title: String(item.title ?? item.jobTitle ?? ""),
        linkedinUrl: String(item.profileUrl ?? item.linkedInUrl ?? ""),
      }));
  } catch {
    return [];
  }
}

// ── JSON schemas for structured AI responses ──────────────────────────────────

const COMPANY_INTELLIGENCE_SCHEMA = {
  type: "object",
  required: [
    "bdScore",
    "menaPresence",
    "companySize",
    "rationale",
    "evidenceItems",
    "linkedinCompanyUrl",
    "entityRoles",
    "commercialControlLevel",
    "existingMenaPartners",
    "menaPartnershipStrength",
    "approachTargetRecommendation",
    "approachTargetReason",
    "notApproachableReason",
    "topDrugCandidates",
  ],
  additionalProperties: false,
  properties: {
    bdScore: { type: "number", minimum: 0, maximum: 10 },
    menaPresence: { type: "string", enum: ["none", "limited", "established"] },
    companySize: { type: "string", enum: ["sme", "mid", "large"] },
    revenueEstimate: { type: ["string", "null"] },
    employeeCount: { type: ["string", "null"] },
    rationale: {
      type: "string",
      description: "2-3 sentence BD suitability summary for KEMEDICA",
    },
    linkedinCompanyUrl: {
      type: ["string", "null"],
      description: "LinkedIn company page URL e.g. https://www.linkedin.com/company/...",
    },
    evidenceItems: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        required: ["claim", "source"],
        additionalProperties: false,
        properties: {
          claim: { type: "string" },
          source: { type: "string" },
          url: { type: ["string", "null"] },
        },
      },
    },
    entityRoles: {
      type: "array",
      maxItems: 4,
      items: {
        type: "string",
        enum: [
          "manufacturer",
          "market_authorization_holder",
          "licensor",
          "regional_partner",
          "distributor",
        ],
      },
    },
    commercialControlLevel: {
      type: "string",
      enum: ["full", "shared", "limited", "unknown"],
    },
    existingMenaPartners: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        required: ["name", "role", "geographies", "confidence", "source", "url"],
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          role: {
            type: "string",
            enum: [
              "affiliate",
              "distributor",
              "local_mah_partner",
              "licensee",
              "co_marketing_partner",
              "tender_partner",
              "other",
            ],
          },
          geographies: {
            type: "array",
            items: { type: "string" },
            maxItems: 10,
          },
          exclusivity: {
            type: ["string", "null"],
            enum: ["exclusive", "non_exclusive", "unknown", null],
          },
          confidence: {
            type: "string",
            enum: ["confirmed", "likely", "inferred"],
          },
          source: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
        },
      },
    },
    menaPartnershipStrength: {
      type: "string",
      enum: ["none", "limited", "moderate", "entrenched"],
    },
    approachTargetRecommendation: {
      type: "string",
      enum: ["approach", "watch", "deprioritize"],
    },
    approachTargetReason: { type: "string" },
    notApproachableReason: { type: ["string", "null"] },
    topDrugCandidates: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
  },
} as const;

const DRUG_MENA_SCHEMA = {
  type: "object",
  required: ["registrations"],
  additionalProperties: false,
  properties: {
    registrations: {
      type: "array",
      items: {
        type: "object",
        required: ["drugName", "country", "status", "source"],
        additionalProperties: false,
        properties: {
          drugName: { type: "string" },
          country: { type: "string" },
          status: {
            type: "string",
            enum: ["registered", "not_found", "unverified"],
          },
          registrationNumber: { type: ["string", "null"] },
          source: { type: "string" },
          url: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const CONTACT_RESEARCH_SCHEMA = {
  type: "object",
  required: ["contacts"],
  additionalProperties: false,
  properties: {
    contacts: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        required: ["name", "title", "confidence", "source"],
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          title: { type: "string" },
          email: { type: ["string", "null"] },
          linkedinUrl: { type: ["string", "null"] },
          confidence: {
            type: "string",
            enum: ["confirmed", "likely", "inferred"],
          },
          source: {
            type: ["string", "null"],
            description: "Where this contact was found (URL or publication)",
          },
        },
      },
    },
  },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompanyIntelResult {
  bdScore: number;
  menaPresence: "none" | "limited" | "established";
  companySize: "sme" | "mid" | "large";
  revenueEstimate: string | null;
  employeeCount: string | null;
  rationale: string;
  linkedinCompanyUrl: string | null;
  evidenceItems: Array<{ claim: string; source: string; url?: string | null }>;
  entityRoles: Array<
    | "manufacturer"
    | "market_authorization_holder"
    | "licensor"
    | "regional_partner"
    | "distributor"
  >;
  commercialControlLevel: "full" | "shared" | "limited" | "unknown";
  existingMenaPartners: Array<{
    name: string;
    role:
      | "affiliate"
      | "distributor"
      | "local_mah_partner"
      | "licensee"
      | "co_marketing_partner"
      | "tender_partner"
      | "other";
    geographies: string[];
    exclusivity?: "exclusive" | "non_exclusive" | "unknown" | null;
    confidence: "confirmed" | "likely" | "inferred";
    source: string | null;
    url: string | null;
  }>;
  menaPartnershipStrength: "none" | "limited" | "moderate" | "entrenched";
  approachTargetRecommendation: "approach" | "watch" | "deprioritize";
  approachTargetReason: string;
  notApproachableReason: string | null;
  topDrugCandidates: string[];
}

interface DrugMenaResult {
  registrations: Array<{
    drugName: string;
    country: string;
    status: "registered" | "not_found" | "unverified";
    registrationNumber: string | null;
    source: string;
    url: string | null;
  }>;
}

interface ContactResult {
  contacts: Array<{
    name: string;
    title: string;
    email: string | null;
    linkedinUrl: string | null;
    confidence: "confirmed" | "likely" | "inferred";
    source: string | null;
  }>;
}

// ── Main dossier action ───────────────────────────────────────────────────────

/**
 * buildProspectDossier — 3-stage deep research on a prospect company:
 *   1. Company intelligence: distributor fit, MENA presence, revenue, evidence items
 *   2. Drug MENA registration: per-drug check across SFDA, UAE, Egypt, Jordan, GCC
 *   3. Contact research: find BD/international decision-makers via LinkedIn + web
 *
 * Saves all findings to the company record and drug records.
 * Optionally uses APIFY (APIFY_TOKEN env) for LinkedIn employee scraping.
 */
export const buildProspectDossier = action({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }): Promise<Id<"discoveryJobs">> => {
    const company = await ctx.runQuery(api.companies.get, { id: companyId });
    if (!company) throw new Error("Company not found");
    const drugs = await ctx.runQuery(api.drugs.listByCompany, { companyId });

    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "prospect_research",
      companyId,
      companyName: company.name,
    });

    const log = (
      msg: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => ctx.runMutation(api.discoveryJobs.appendLog, { id: jobId, message: msg, level });

    const client = createResearchClient(process.env.OPENAI_API_KEY!);

    try {
      // ── Stage 1: Company Intelligence ────────────────────────────────────────
      await log("Stage 1/3 — Company intelligence & BD qualification…");

      const drugSummary = drugs
        .slice(0, 8)
        .map(
          (d) =>
            `${d.name} (${d.genericName}${d.patentExpiryYear ? `, patent ~${d.patentExpiryYear}` : ""})`
        )
        .join("; ");

      const intel = await createStructuredWebSearchResponse<CompanyIntelResult>(
        client,
        {
          instructions: `You are a pharmaceutical distributor-target analyst for KEMEDICA. Research this EU pharma company to determine its suitability as a MENA distribution partner. ${KEMEDICA_CONTEXT} Always cite specific source URLs for factual claims. If something cannot be verified, say "not found" rather than guessing.`,
          input: `Research ${company.name} (${company.country}, website: ${company.website ?? "unknown"}).
Drug portfolio: ${drugSummary || "None discovered yet"}

Find and document with REAL SOURCES AND URLS:
1. Revenue range, headcount → classify: sme (<€100M), mid (€100M–€1B), large (>€1B)
2. MENA presence: search "[company name] GCC distributor", "[company name] Middle East partner", "[company name] MENA licensing", site:linkedin.com "${company.name}" Gulf — report any distributors, subsidiaries, or partners found
3. BD signals: out-licensing deals, CPHI/BIO attendance, partnering press releases
4. LinkedIn company page URL (linkedin.com/company/...)
5. Patent cliff: which of their drugs face expiry in the next 6 years
6. Whether this entity is a manufacturer, MAH/commercial owner, both, or another role
7. Known MENA partner entities by type: affiliate, distributor, local MAH partner, licensee, co-marketing, tender
8. Whether this entity should be approached directly, watched, or deprioritized

Scoring guide (0–10): 10 = SME/mid, zero MENA presence, strong export/partnering signals, EMA drugs near patent expiry, active BD team.
Deduct points for: large multinational, established MENA distribution, no visible partnering appetite.`,
          formatName: "company_intelligence",
          schema: COMPANY_INTELLIGENCE_SCHEMA,
          maxOutputTokens: 2000,
          searchContextSize: "high",
          maxToolCalls: 8,
        }
      );

      const score = Math.min(10, Math.max(0, intel.data.bdScore));
      await log(
        `Distributor fit ${score}/10 · ${intel.data.menaPresence} MENA presence · ${intel.data.companySize} size · ${intel.data.evidenceItems?.length ?? 0} evidence items`,
        "success"
      );

      // ── Stage 2: Per-drug MENA registration verification ─────────────────────
      await log("Stage 2/3 — Verifying MENA drug registration status…");

      type MenaReg = {
        drugId: Id<"drugs">;
        country: string;
        status: "registered" | "not_found" | "unverified";
        registrationNumber?: string;
        source: string;
        url?: string;
        verifiedAt: number;
      };
      const menaRegistrations: MenaReg[] = [];

      const drugsToCheck = [...drugs]
        .sort((a, b) => (b.patentUrgencyScore ?? 0) - (a.patentUrgencyScore ?? 0))
        .slice(0, 5);

      if (drugsToCheck.length > 0) {
        const drugCheckList = drugsToCheck
          .map((d) => `"${d.name}" / INN: "${d.genericName}"`)
          .join(", ");

        const menaCheck =
          await createStructuredWebSearchResponse<DrugMenaResult>(client, {
            instructions: `You are a pharmaceutical regulatory researcher specialising in MENA drug approvals. Check actual government databases — do not infer or assume. Only report what you find in official sources.`,
            input: `Check MENA registration status for drugs from ${company.name}: ${drugCheckList}

Search these OFFICIAL government databases and report only what you actually find:
- Saudi Arabia SFDA: sfda.gov.sa/en/drug/drugdatabases (search brand name and INN)
- UAE MoHAP approved medicines: mohap.gov.ae/en/medicines
- GCC unified registration: gccdrug.com
- Egypt EDA: eda.mohealth.gov.eg
- Jordan JFDA: jfda.jo/EchoBusV3.0/SystemAssets/PDFs
- NUPCO Saudi Arabia tenders: nupco.com (check if drug appears in active procurement)

For each drug × country combination where you find definitive evidence:
- status = "registered" if found in database with approval
- status = "not_found" if you searched and found no listing
- status = "unverified" if search was inconclusive
Include the exact database URL and registration number when available.
Check Saudi Arabia, UAE, Egypt, Jordan, Qatar at minimum for each drug.`,
            formatName: "drug_mena_status",
            schema: DRUG_MENA_SCHEMA,
            maxOutputTokens: 2500,
            searchContextSize: "high",
            maxToolCalls: 10,
          });

        const now = Date.now();
        for (const reg of menaCheck.data.registrations) {
          const matched = drugsToCheck.find(
            (d) =>
              d.name.toLowerCase().includes(reg.drugName.toLowerCase()) ||
              d.genericName.toLowerCase().includes(reg.drugName.toLowerCase()) ||
              reg.drugName.toLowerCase().includes(d.genericName.toLowerCase())
          );
          if (matched) {
            menaRegistrations.push({
              drugId: matched._id,
              country: reg.country,
              status: reg.status,
              registrationNumber: reg.registrationNumber ?? undefined,
              source: reg.source,
              url: reg.url ?? undefined,
              verifiedAt: now,
            });
          }
        }

        // Persist per-drug
        const byDrug = new Map<Id<"drugs">, MenaReg[]>();
        for (const r of menaRegistrations) {
          if (!byDrug.has(r.drugId)) byDrug.set(r.drugId, []);
          byDrug.get(r.drugId)!.push(r);
        }
        for (const [drugId, regs] of byDrug) {
          await ctx.runMutation(api.drugs.updateMenaRegistrations, {
            id: drugId,
            menaRegistrations: regs.map((reg) => ({
              country: reg.country,
              status: reg.status,
              registrationNumber: reg.registrationNumber,
              source: reg.source,
              url: reg.url,
              verifiedAt: reg.verifiedAt,
            })),
            menaRegistrationCount: regs.filter((r) => r.status === "registered").length,
          });
        }

        const registeredCount = menaRegistrations.filter(
          (r) => r.status === "registered"
        ).length;
        const notFoundCount = menaRegistrations.filter(
          (r) => r.status === "not_found"
        ).length;
        await log(
          `${registeredCount} registrations found · ${notFoundCount} confirmed absent · ${drugsToCheck.length} drugs checked`,
          registeredCount > 0 ? "warning" : "success"
        );
        if (registeredCount > 0) {
          await log(
            "Some drugs already registered in MENA — opportunity may be limited for those",
            "warning"
          );
        }
      } else {
        await log("  Skipped — no drugs in portfolio yet. Run drug discovery first.");
      }

      // ── Stage 3: Contact Research ─────────────────────────────────────────────
      await log("Stage 3/3 — Finding BD decision-maker contacts…");

      // Try APIFY first if token available
      let apifyContacts: Array<{ name: string; title: string; linkedinUrl: string }> = [];
      if (process.env.APIFY_TOKEN && intel.data.linkedinCompanyUrl) {
        await log("  Querying APIFY LinkedIn scraper…");
        apifyContacts = await findContactsViaApify(intel.data.linkedinCompanyUrl);
        if (apifyContacts.length > 0) {
          await log(
            `  APIFY returned ${apifyContacts.length} BD-relevant employee profiles`,
            "success"
          );
        } else {
          await log("  APIFY returned no matching profiles — falling back to web search");
        }
      }

      const apifyContext =
        apifyContacts.length > 0
          ? `\n\nAPIFY LinkedIn already found these employees — verify details and add emails where possible:\n${apifyContacts.map((c) => `- ${c.name}: ${c.title} (${c.linkedinUrl})`).join("\n")}`
          : "";

      const contactRes = await createStructuredWebSearchResponse<ContactResult>(
        client,
        {
          instructions: `You are a B2B contact researcher. Find specific, real decision-makers who handle international BD, licensing, and market expansion at pharmaceutical companies. Always cite where you found each contact.`,
          input: `Find contacts at ${company.name} (${company.country}, ${company.website ?? ""}) responsible for:
- International business development / out-licensing / export
- Strategic partnerships and alliances
- Head/Director/VP of International or BD
- CEO if company is SME (<200 employees)

Search these sources in order:
1. ${company.website ?? company.name + " website"}/team OR /about OR /leadership OR /management
2. LinkedIn: site:linkedin.com/in "${company.name}" AND ("business development" OR "international" OR "licensing" OR "export")
3. Press releases mentioning named contacts: "${company.name}" AND ("appointed" OR "partnership" OR "licensing agreement")
4. CPHI / BIO International / Arab Health conference speaker lists
5. "${company.name}" annual report or investor relations page

${apifyContext}

Return up to 5 contacts. For each: full name, exact current title, professional email if publicly listed, LinkedIn URL, and the exact source URL where found.
confidence levels: "confirmed" = official company website/PR, "likely" = LinkedIn or press release, "inferred" = pattern-based.`,
          formatName: "contact_research",
          schema: CONTACT_RESEARCH_SCHEMA,
          maxOutputTokens: 1500,
          searchContextSize: "high",
          maxToolCalls: 8,
        }
      );

      const contacts = contactRes.data.contacts ?? [];
      const confirmed = contacts.filter((c) => c.confidence === "confirmed").length;
      const withEmail = contacts.filter((c) => c.email).length;
      const registeredInMena = menaRegistrations.filter(
        (r) => r.status === "registered"
      ).length;
      await log(
        `${contacts.length} contacts found · ${confirmed} confirmed · ${withEmail} with email`,
        contacts.length > 0 ? "success" : "warning"
      );

      // ── Persist all findings ──────────────────────────────────────────────────
      await ctx.runMutation(api.companies.update, {
        id: companyId,
        bdScore: score,
        bdScoreRationale: intel.data.rationale,
        distributorFitScore: score,
        distributorFitRationale: buildDistributorFitRationale({
          companyName: company.name,
          companySize: intel.data.companySize,
          menaPresence: intel.data.menaPresence,
          portfolioFit:
            intel.data.topDrugCandidates.length > 0
              ? `top molecules: ${intel.data.topDrugCandidates.slice(0, 3).join(", ")}`
              : "portfolio fit still based on company-level evidence",
          hasPartneringSignals: intel.data.evidenceItems.some((item) =>
            /partner|licens|distribution|export|commercial/i.test(item.claim)
          ),
          hasExportSignals: intel.data.evidenceItems.some((item) =>
            /international|export|market entry/i.test(item.claim)
          ),
          menaRegistrationCount: registeredInMena,
        }),
        menaPresence: intel.data.menaPresence,
        companySize: intel.data.companySize,
        targetSegment: intel.data.companySize,
        menaChannelStatus: intel.data.menaPresence,
        exportReadiness:
          intel.data.evidenceItems.some((item) =>
            /export|distribution|licens|commercial/i.test(item.claim)
          )
            ? "high"
            : "medium",
        dealModelFit: "distributor",
        priorityTier:
          score >= 8
            ? "tier_1"
            : score >= 6
              ? "tier_2"
              : score >= 4
                ? "tier_3"
                : "deprioritized",
        partnerabilitySignals: intel.data.evidenceItems
          .map((item) => item.claim)
          .filter((claim) =>
            /partner|licens|distribution|conference|international|export/i.test(claim)
          )
          .slice(0, 6),
        disqualifierReasons: buildDisqualifierReasons({
          companySize: intel.data.companySize,
          menaPresence: intel.data.menaPresence,
          menaRegistrationCount: registeredInMena,
          hasPartneringSignals: intel.data.evidenceItems.some((item) =>
            /partner|licens|distribution|conference|international|export/i.test(item.claim)
          ),
        }),
        entityRoles: intel.data.entityRoles,
        commercialControlLevel: intel.data.commercialControlLevel,
        existingMenaPartners: intel.data.existingMenaPartners.map((partner) => ({
          name: partner.name,
          role: partner.role,
          geographies: partner.geographies,
          exclusivity: partner.exclusivity ?? undefined,
          confidence: partner.confidence,
          source: partner.source ?? undefined,
          url: partner.url ?? undefined,
        })),
        menaPartnershipStrength: intel.data.menaPartnershipStrength,
        approachTargetRecommendation: intel.data.approachTargetRecommendation,
        approachTargetReason: intel.data.approachTargetReason,
        notApproachableReason: intel.data.notApproachableReason ?? undefined,
        revenueEstimate: intel.data.revenueEstimate ?? undefined,
        employeeCount: intel.data.employeeCount ?? undefined,
        linkedinCompanyUrl: intel.data.linkedinCompanyUrl ?? undefined,
        bdScoredAt: Date.now(),
        researchedAt: Date.now(),
        bdEvidenceItems: (intel.data.evidenceItems ?? []).map((e) => ({
          claim: e.claim,
          source: e.source,
          url: e.url ?? undefined,
        })),
        keyContacts: contacts.map((c) => ({
          name: c.name,
          title: c.title,
          email: c.email ?? undefined,
          linkedinUrl: c.linkedinUrl ?? undefined,
          confidence: c.confidence,
          source: c.source ?? undefined,
        })),
        // Keep legacy single-contact fields pointing to best contact
        contactName: contacts[0]?.name,
        contactTitle: contacts[0]?.title,
        contactEmail: contacts[0]?.email ?? undefined,
        linkedinUrl: contacts[0]?.linkedinUrl ?? undefined,
      });

      const summaryNote = [
        `Full dossier built. Distributor fit: ${score}/10.`,
        `${contacts.length} contacts found${withEmail > 0 ? ` (${withEmail} with email)` : ""}.`,
        registeredInMena > 0
          ? `${registeredInMena} drug/country registrations found in MENA — verify before approaching.`
          : `No MENA drug registrations found — clean market entry opportunity.`,
      ].join(" ");

      await ctx.runMutation(api.bdActivities.create, {
        companyId,
        type: "note",
        content: summaryNote,
      });

      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: contacts.length,
        skippedDuplicates: 0,
        summary: `Dossier for ${company.name}: ${score}/10, ${contacts.length} contacts, ${registeredInMena} MENA registrations`,
      });

      return jobId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.discoveryJobs.fail, { id: jobId, errorMessage: msg });
      throw err;
    }
  },
});

// ── Batch research queue ──────────────────────────────────────────────────────

/**
 * runProspectResearchQueue — processes up to `limit` unresearched prospects,
 * prioritised by BD score descending. Safe to run repeatedly.
 */
export const runProspectResearchQueue = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 3 }): Promise<string[]> => {
    const all = await ctx.runQuery(api.companies.list, {});
    const queue = all
      .filter(
        (c) =>
          !c.researchedAt &&
          normalizePipelineStage(c.bdStatus) !== "lost" &&
          c.status === "active"
      )
      .sort((a, b) => (b.bdScore ?? 0) - (a.bdScore ?? 0))
      .slice(0, limit);

    const jobIds: string[] = [];
    for (const company of queue) {
      try {
        const jobId = await ctx.runAction(api.research.buildProspectDossier, {
          companyId: company._id,
        });
        jobIds.push(jobId);
      } catch {
        // continue with next
      }
    }
    return jobIds;
  },
});
