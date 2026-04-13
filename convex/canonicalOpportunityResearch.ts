"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  createResearchClient,
  createStructuredWebSearchResponse,
} from "./openaiResearch";
import { KEMEDICA_CONTEXT } from "../src/lib/brand";

const GCC_PLUS_COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Kuwait",
  "Qatar",
  "Egypt",
  "Algeria",
] as const;

const COUNTRY_SOURCE_CONFIG: Record<string, {
  tier: "anchor" | "secondary";
  sourceSystem:
    | "mohap_uae"
    | "sfda"
    | "eda_egypt"
    | "kuwait_moh"
    | "qatar_moph"
    | "algeria_moh";
  sourceTitle: string;
  allowedDomains: string[];
}> = {
  UAE: {
    tier: "anchor",
    sourceSystem: "mohap_uae",
    sourceTitle: "MOHAP Drug Registration",
    allowedDomains: ["mohap.gov.ae"],
  },
  "Saudi Arabia": {
    tier: "anchor",
    sourceSystem: "sfda",
    sourceTitle: "SFDA Drug Registration",
    allowedDomains: ["sfda.gov.sa"],
  },
  Egypt: {
    tier: "anchor",
    sourceSystem: "eda_egypt",
    sourceTitle: "EDA Drug Registration",
    allowedDomains: ["edaegypt.gov.eg", "eda.mohealth.gov.eg"],
  },
  Kuwait: {
    tier: "anchor",
    sourceSystem: "kuwait_moh",
    sourceTitle: "Kuwait MOH Drug Registration",
    allowedDomains: ["moh.gov.kw"],
  },
  Qatar: {
    tier: "secondary",
    sourceSystem: "qatar_moph",
    sourceTitle: "Qatar MOPH Drug Registration",
    allowedDomains: ["moph.gov.qa"],
  },
  Algeria: {
    tier: "secondary",
    sourceSystem: "algeria_moh",
    sourceTitle: "Algeria MOH Drug Registration",
    allowedDomains: ["sante.gov.dz"],
  },
};

const COUNTRY_FINDING_SCHEMA = {
  type: "object",
  required: [
    "country",
    "result",
    "availabilityStatus",
    "genericAvailability",
    "confidence",
    "sourceCategory",
    "sourceUrl",
    "summary",
    "marketedNames",
    "skippedReason",
    "sources",
  ],
  additionalProperties: false,
  properties: {
    country: {
      type: "string",
      enum: ["UAE", "Saudi Arabia", "Kuwait", "Qatar", "Egypt", "Algeria"],
    },
    result: {
      type: "string",
      enum: [
        "present",
        "absent",
        "present_under_different_brand",
        "inn_or_generic_present",
        "ambiguous",
        "insufficient_official_evidence",
        "skipped",
      ],
    },
    availabilityStatus: {
      type: "string",
      enum: [
        "formally_registered",
        "tender_formulary_only",
        "shortage_listed",
        "hospital_import_only",
        "not_found",
        "ambiguous",
        "unverified",
      ],
    },
    genericAvailability: {
      type: "string",
      enum: [
        "originator_only",
        "originator_plus_generics",
        "generic_only",
        "not_available",
        "unclear",
      ],
    },
    confidence: {
      type: "string",
      enum: ["confirmed", "likely", "inferred"],
    },
    sourceCategory: {
      type: "string",
      enum: ["official", "commercial_database", "proxy"],
    },
    sourceUrl: { type: ["string", "null"] },
    summary: { type: "string" },
    marketedNames: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    skippedReason: { type: ["string", "null"] },
    sources: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        required: ["title", "url", "claim", "confidence"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          claim: { type: "string" },
          confidence: {
            type: "string",
            enum: ["confirmed", "likely", "inferred"],
          },
        },
      },
    },
  },
} as const;

const ENTITY_FOOTPRINT_SCHEMA = {
  type: "object",
  required: ["entityFindings"],
  additionalProperties: false,
  properties: {
    entityFindings: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        required: [
          "entityName",
          "role",
          "presenceStatus",
          "commercialControl",
          "partnerStrength",
          "summary",
          "recommendedPursuit",
          "evidenceItems",
          "partners",
        ],
        additionalProperties: false,
        properties: {
          entityName: { type: "string" },
          role: {
            type: "string",
            enum: ["commercial_owner", "manufacturer"],
          },
          presenceStatus: {
            type: "string",
            enum: ["blocked", "connected", "weak_absent", "unknown"],
          },
          commercialControl: {
            type: "string",
            enum: ["full", "shared", "limited", "unknown"],
          },
          partnerStrength: {
            type: "string",
            enum: ["none", "limited", "moderate", "entrenched"],
          },
          summary: { type: "string" },
          recommendedPursuit: { type: "boolean" },
          evidenceItems: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              required: ["claim", "source", "url", "confidence"],
              additionalProperties: false,
              properties: {
                claim: { type: "string" },
                source: { type: "string" },
                url: { type: ["string", "null"] },
                confidence: {
                  type: "string",
                  enum: ["confirmed", "likely", "inferred"],
                },
              },
            },
          },
          partners: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              required: ["name", "role", "geographies", "exclusivity", "confidence", "source", "url"],
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
                  maxItems: 10,
                  items: { type: "string" },
                },
                exclusivity: {
                  type: ["string", "null"],
                  enum: ["exclusive", "non_exclusive", "unknown", null],
                },
                confidence: {
                  type: "string",
                  enum: ["confirmed", "likely", "inferred"],
                },
                source: { type: "string" },
                url: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  },
} as const;

async function fetchOfficialCountryFinding(
  client: ReturnType<typeof createResearchClient>,
  args: {
    country: string;
    brandName: string;
    inn: string;
    manufacturerName?: string | null;
    mahName?: string | null;
  }
) {
  const config = COUNTRY_SOURCE_CONFIG[args.country];
  const response = await createStructuredWebSearchResponse<{
    country: string;
    result:
      | "present"
      | "absent"
      | "present_under_different_brand"
      | "inn_or_generic_present"
      | "ambiguous"
      | "insufficient_official_evidence"
      | "skipped";
    availabilityStatus:
      | "formally_registered"
      | "tender_formulary_only"
      | "shortage_listed"
      | "hospital_import_only"
      | "not_found"
      | "ambiguous"
      | "unverified";
    genericAvailability:
      | "originator_only"
      | "originator_plus_generics"
      | "generic_only"
      | "not_available"
      | "unclear";
    confidence: "confirmed" | "likely" | "inferred";
    sourceCategory: "official" | "commercial_database" | "proxy";
    sourceUrl?: string | null;
    summary: string;
    marketedNames: string[];
    skippedReason?: string | null;
    sources: Array<{
      title: string;
      url: string;
      claim: string;
      confidence: "confirmed" | "likely" | "inferred";
    }>;
  }>(client, {
    instructions: `You are a pharmaceutical regulatory analyst. Use only official regulator or ministry sources from these domains when possible: ${config.allowedDomains.join(", ")}. Return strict JSON only. If the official source does not provide enough evidence, return insufficient_official_evidence instead of guessing. Match exact brand first, then INN plus manufacturer/MAH context. ${KEMEDICA_CONTEXT}`,
    input: `Check the official registration status for this medicine in ${args.country}.

Product
- Brand: ${args.brandName}
- INN: ${args.inn}
- Manufacturer: ${args.manufacturerName ?? "unknown"}
- MAH/applicant: ${args.mahName ?? "unknown"}

Rules
- Prefer these official domains only: ${config.allowedDomains.join(", ")}.
- If the medicine is directly registered, return present with formally_registered unless the evidence supports a narrower availability state.
- If only INN/generic presence is evidenced, return inn_or_generic_present.
- If the molecule appears under another local brand, return present_under_different_brand.
- If the official source is inaccessible or inconclusive, return insufficient_official_evidence or skipped.
- Include up to 4 supporting official-source URLs.`,
    formatName: `official_${config.sourceSystem.replaceAll("_", "_")}`,
    schema: COUNTRY_FINDING_SCHEMA,
    maxOutputTokens: 1200,
    searchContextSize: "high",
    maxToolCalls: 4,
  });

  return {
    country: args.country,
    tier: config.tier,
    result: response.data.result,
    availabilityStatus: response.data.availabilityStatus,
    genericAvailability: response.data.genericAvailability,
    confidence: response.data.confidence,
    sourceCategory: response.data.sourceCategory,
    sourceSystem: config.sourceSystem,
    sourceTitle: config.sourceTitle,
    sourceUrl: response.data.sourceUrl ?? response.sources[0]?.url ?? null,
    summary: response.data.summary,
    marketedNames: response.data.marketedNames,
    skippedReason: response.data.skippedReason ?? null,
    sources: response.data.sources,
  };
}

async function fetchEntityFootprintFindings(
  client: ReturnType<typeof createResearchClient>,
  args: {
    commercialOwnerEntityName?: string | null;
    manufacturerEntityName?: string | null;
    brandName: string;
    inn: string;
  }
) {
  const response = await createStructuredWebSearchResponse<{
    entityFindings: Array<{
      entityName: string;
      role: "commercial_owner" | "manufacturer";
      presenceStatus: "blocked" | "connected" | "weak_absent" | "unknown";
      commercialControl: "full" | "shared" | "limited" | "unknown";
      partnerStrength: "none" | "limited" | "moderate" | "entrenched";
      summary: string;
      recommendedPursuit: boolean;
      evidenceItems: Array<{
        claim: string;
        source: string;
        url?: string | null;
        confidence: "confirmed" | "likely" | "inferred";
      }>;
      partners: Array<{
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
        source: string;
        url?: string | null;
      }>;
    }>;
  }>(client, {
    instructions: `You are a pharmaceutical market-entry analyst for KEMEDICA. Use live web search and return strict JSON only. Check GCC++ legal entities, affiliates, distributors, authorized representatives, local MAH partners, licensees, and commercialization footprint for the named entities. Prefer official company pages, partner pages, regulator listings, and credible press releases. ${KEMEDICA_CONTEXT}`,
    input: `Assess GCC++ company footprint for this medicine.

Product
- Brand: ${args.brandName}
- INN: ${args.inn}

Entities
- Commercial owner candidate: ${args.commercialOwnerEntityName ?? "unknown"}
- Manufacturer candidate: ${args.manufacturerEntityName ?? "unknown"}

Return up to two findings, one for commercial_owner and one for manufacturer. Keep them separate and evidence-backed.`,
    formatName: "entity_footprint_refresh",
    schema: ENTITY_FOOTPRINT_SCHEMA,
    maxOutputTokens: 2200,
    searchContextSize: "high",
    maxToolCalls: 8,
  });
  return response.data.entityFindings;
}

export const refreshCanonicalProductResearch = internalAction({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    targetCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { canonicalProductId, targetCountries }) => {
    const inputs = await ctx.runQuery(internal.canonicalOpportunities.getPipelineInputs, {
      canonicalProductId,
    });
    if (!inputs) {
      throw new Error("Canonical product not found");
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for fresh external research.");
    }

    const client = createResearchClient(process.env.OPENAI_API_KEY);
    const countries =
      targetCountries && targetCountries.length > 0
        ? targetCountries
        : [...GCC_PLUS_COUNTRIES];

    const commercialOwnerEntity =
      inputs.entities.find((entity) =>
        entity.role === "mah" || entity.role === "applicant" || entity.role === "licensor"
      ) ?? null;
    const manufacturerEntity =
      inputs.entities.find((entity) => entity.role === "manufacturer") ?? null;

    const countryFindings: Array<{
      country: string;
      tier: "anchor" | "secondary";
      result:
        | "present"
        | "absent"
        | "present_under_different_brand"
        | "inn_or_generic_present"
        | "ambiguous"
        | "insufficient_official_evidence"
        | "skipped";
      availabilityStatus:
        | "formally_registered"
        | "tender_formulary_only"
        | "shortage_listed"
        | "hospital_import_only"
        | "not_found"
        | "ambiguous"
        | "unverified";
      genericAvailability:
        | "originator_only"
        | "originator_plus_generics"
        | "generic_only"
        | "not_available"
        | "unclear";
      confidence: "confirmed" | "likely" | "inferred";
      sourceCategory: "official" | "commercial_database" | "proxy";
      sourceSystem:
        | "mohap_uae"
        | "sfda"
        | "eda_egypt"
        | "kuwait_moh"
        | "qatar_moph"
        | "algeria_moh";
      sourceTitle: string;
      sourceUrl: string | null;
      summary: string;
      marketedNames: string[];
      skippedReason: string | null;
      sources: Array<{
        title: string;
        url: string;
        claim: string;
        confidence: "confirmed" | "likely" | "inferred";
      }>;
    }> = [];
    for (const country of countries) {
      const finding = await fetchOfficialCountryFinding(client, {
        country,
        brandName: inputs.product.brandName,
        inn: inputs.product.inn,
        manufacturerName: inputs.product.primaryManufacturerName,
        mahName: inputs.product.primaryMahName ?? inputs.product.primaryApplicantName,
      });
      countryFindings.push(finding);
    }

    const entityFindings = await fetchEntityFootprintFindings(client, {
      commercialOwnerEntityName: commercialOwnerEntity?.entityName,
      manufacturerEntityName: manufacturerEntity?.entityName,
      brandName: inputs.product.brandName,
      inn: inputs.product.inn,
    });

    return {
      countryFindings,
      entityFindings,
    };
  },
});
