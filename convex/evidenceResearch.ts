"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { createResearchClient, createStructuredWebSearchResponse, RESEARCH_MODEL } from "./openaiResearch";
import { canStoreResearchFinding } from "./researchEvidencePolicy";

type FindingDraft = {
  kind: "product_profile" | "company_profile" | "ownership" | "registration" | "market_signal" | "partner" | "contact";
  claim: string;
  excerpt: string;
  sourceUrl: string;
  sourceTitle: string;
  confidence: "confirmed" | "likely" | "inferred";
  companyName?: string | null;
  relationshipType?: "manufacturer" | "market_authorization_holder" | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactLinkedinUrl?: string | null;
  country?: "Saudi Arabia" | "UAE" | "Egypt" | null;
  registrationStatus?: "registered" | "not_found" | "unverified" | null;
};

const RESEARCH_FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind", "claim", "excerpt", "sourceUrl", "sourceTitle", "confidence", "companyName",
          "relationshipType", "contactName", "contactTitle", "contactEmail", "contactLinkedinUrl",
          "country", "registrationStatus",
        ],
        properties: {
          kind: { type: "string", enum: ["product_profile", "company_profile", "ownership", "registration", "market_signal", "partner", "contact"] },
          claim: { type: "string" },
          excerpt: { type: "string" },
          sourceUrl: { type: "string" },
          sourceTitle: { type: "string" },
          confidence: { type: "string", enum: ["confirmed", "likely", "inferred"] },
          companyName: { type: ["string", "null"] },
          relationshipType: { type: ["string", "null"], enum: ["manufacturer", "market_authorization_holder", null] },
          contactName: { type: ["string", "null"] },
          contactTitle: { type: ["string", "null"] },
          contactEmail: { type: ["string", "null"] },
          contactLinkedinUrl: { type: ["string", "null"] },
          country: { type: ["string", "null"], enum: ["Saudi Arabia", "UAE", "Egypt", null] },
          registrationStatus: { type: ["string", "null"], enum: ["registered", "not_found", "unverified", null] },
        },
      },
    },
  },
} as const;

function normalize(value?: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") ?? "";
}

function normalizeUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function sourceKind(url: string, companyWebsite?: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  if (/eps-gags\.gov\.eg|upa\.gov\.eg/.test(hostname)) return "official_signal" as const;
  if (/sfda\.gov\.sa|mohap\.gov\.ae|nupco\.com|etimad\.sa|edaegypt\.gov\.eg/.test(hostname)) return "official_registry" as const;
  if (hostname.includes("linkedin.com")) return "linkedin" as const;
  if (companyWebsite && normalizeUrl(companyWebsite) === normalizeUrl(url)) return "company_website" as const;
  if (/press|news|media|release/.test(url)) return "company_press_release" as const;
  if (/conference|cphi|bio\.org/.test(hostname)) return "conference" as const;
  return "public_web" as const;
}

function persistableFindings(args: {
  drafts: FindingDraft[];
  sources: Array<{ title: string; url: string }>;
  knownCompanies: Array<{ _id: Id<"companies">; name: string }>;
  companyWebsite?: string;
}) {
  const sourceByUrl = new Map(
    args.sources
      .map((source) => [normalizeUrl(source.url), source] as const)
      .filter((entry): entry is readonly [string, { title: string; url: string }] => Boolean(entry[0]))
  );
  return args.drafts.flatMap((draft) => {
    const normalizedSourceUrl = normalizeUrl(draft.sourceUrl);
    if (!normalizedSourceUrl) return [];
    const source = sourceByUrl.get(normalizedSourceUrl);
    if (!source) return [];
    const proposedCompany = draft.companyName
      ? args.knownCompanies.find((company) => normalize(company.name) === normalize(draft.companyName))
      : undefined;
    const hasPublicContactRoute = Boolean(draft.contactEmail?.trim() || normalizeUrl(draft.contactLinkedinUrl));
    if (!canStoreResearchFinding({
      kind: draft.kind,
      country: draft.country,
      hasProviderSource: true,
      hasClaim: Boolean(draft.claim.trim()),
      hasExcerpt: Boolean(draft.excerpt.trim()),
      hasKnownCompany: Boolean(proposedCompany),
      knownCompanyCount: args.knownCompanies.length,
      hasNamedContact: Boolean(draft.contactName?.trim()),
      hasContactTitle: Boolean(draft.contactTitle?.trim()),
      hasPublicContactRoute,
    })) return [];
    const company = proposedCompany ?? (draft.kind === "contact" ? args.knownCompanies[0] : undefined);
    const url = normalizeUrl(source.url);
    if (!url) return [];
    return [{
      kind: draft.kind,
      claim: draft.claim.trim(),
      excerpt: draft.excerpt.trim().slice(0, 1_600),
      sourceUrl: url,
      sourceTitle: source.title.trim() || draft.sourceTitle.trim() || url,
      sourceKind: sourceKind(url, args.companyWebsite),
      confidence: draft.confidence,
      proposedCompanyId: company?._id,
      proposedCompanyName: company?.name,
      relationshipType: draft.relationshipType ?? undefined,
      contactName: draft.contactName?.trim() || undefined,
      contactTitle: draft.contactTitle?.trim() || undefined,
      contactEmail: draft.contactEmail?.trim() || undefined,
      contactLinkedinUrl: normalizeUrl(draft.contactLinkedinUrl) ?? undefined,
      country: draft.country ?? undefined,
      registrationStatus: draft.registrationStatus ?? undefined,
    }];
  });
}

export const runProductResearch = action({
  args: { drugId: v.id("drugs") },
  handler: async (ctx, { drugId }): Promise<Id<"researchRuns">> => {
    const runId: Id<"researchRuns"> = await ctx.runMutation(internal.researchWorkflow.createRun, {
      targetType: "product",
      drugId,
    });
    try {
      const context = await ctx.runQuery(internal.researchWorkflow.getProductContext, { drugId });
      if (!context) throw new Error("Product not found.");
      if (!process.env.OPENAI_API_KEY) throw new Error("Research is not configured. Add an OpenAI API key before running product research.");
      const client = createResearchClient(process.env.OPENAI_API_KEY);
      const knownCompanies = context.companies.map((company) => ({ _id: company._id, name: company.name }));
      const linkedOwners = context.links
        .map((link) => `${link.relationshipType}: ${link.entityName ?? knownCompanies.find((company) => company._id === link.companyId)?.name ?? "unknown"}`)
        .join("; ");
      const response = await createStructuredWebSearchResponse<{ findings: FindingDraft[] }>(client, {
        instructions: "You are an evidence researcher for Saudi Arabia, the UAE, and Egypt. Return only concise, source-backed facts. A sourceUrl must be one of the web sources you actually used. Never infer a missing registration, ownership, partner, or contact. Only propose ownership for a company named in the supplied known-owner list. UAE registration status comes only from authorized MoHAP imports, so never return a UAE registration finding from web search. Egypt's registration search may be access-controlled, so do not claim Egyptian registration unless an authorized record is supplied. Return no finding when the source does not support it.",
        input: `Research product: ${context.drug.name} (${context.drug.genericName}).\nKnown owners/links: ${linkedOwners || "none"}.\nKnown companies: ${knownCompanies.map((company) => company.name).join("; ") || "none"}.\nFocus: Saudi Arabia, UAE, and Egypt. Find product identity, manufacturer/MAH confirmation, current official market context, authorized registry evidence only, conflicting local partners, and named public BD/licensing/export contacts. Existing official signal titles: ${context.matchingSignals.map((signal) => signal.title).join("; ") || "none"}.`,
        formatName: "product_research_findings",
        schema: RESEARCH_FINDINGS_SCHEMA,
        maxOutputTokens: 3_000,
        searchContextSize: "medium",
        maxToolCalls: 6,
      });
      const findings = persistableFindings({ drafts: response.data.findings, sources: response.sources, knownCompanies });
      await ctx.runMutation(internal.researchWorkflow.completeRun, {
        runId,
        rawOutput: response.text,
        provider: response.provider,
        model: RESEARCH_MODEL,
        findings,
      });
    } catch (error) {
      await ctx.runMutation(internal.researchWorkflow.failRun, {
        runId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return runId;
  },
});

export const runCompanyResearch = action({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }): Promise<Id<"researchRuns">> => {
    const runId: Id<"researchRuns"> = await ctx.runMutation(internal.researchWorkflow.createRun, {
      targetType: "company",
      companyId,
    });
    try {
      const context = await ctx.runQuery(internal.researchWorkflow.getCompanyContext, { companyId });
      if (!context) throw new Error("Company not found.");
      if (!process.env.OPENAI_API_KEY) throw new Error("Research is not configured. Add an OpenAI API key before running company research.");
      const client = createResearchClient(process.env.OPENAI_API_KEY);
      const response = await createStructuredWebSearchResponse<{ findings: FindingDraft[] }>(client, {
        instructions: "You are an evidence researcher for Saudi Arabia, the UAE, and Egypt. Return only concise, source-backed facts. A sourceUrl must be one of the web sources you actually used. Never infer market access, ownership, partners, or contacts. Focus on public company pages, press releases, conferences, and direct LinkedIn profiles. Only return named contacts when the page contains a direct public work email or direct LinkedIn profile.",
        input: `Research company: ${context.company.name} (${context.company.country}; website: ${context.company.website ?? "unknown"}).\nKnown portfolio: ${context.drugs.map((drug) => `${drug.name} (${drug.genericName})`).join("; ") || "none"}.\nFocus: company role, Saudi/UAE/Egypt partner or market presence, portfolio context, and named BD/licensing/export/commercial contacts.`,
        formatName: "company_research_findings",
        schema: RESEARCH_FINDINGS_SCHEMA,
        maxOutputTokens: 3_000,
        searchContextSize: "medium",
        maxToolCalls: 6,
      });
      const findings = persistableFindings({
        drafts: response.data.findings,
        sources: response.sources,
        knownCompanies: [{ _id: context.company._id, name: context.company.name }],
        companyWebsite: context.company.website,
      });
      await ctx.runMutation(internal.researchWorkflow.completeRun, {
        runId,
        rawOutput: response.text,
        provider: response.provider,
        model: RESEARCH_MODEL,
        findings,
      });
    } catch (error) {
      await ctx.runMutation(internal.researchWorkflow.failRun, {
        runId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return runId;
  },
});
