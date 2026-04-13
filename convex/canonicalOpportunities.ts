import {
  action,
  ActionCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { normalizeText } from "./productIntelligenceHelpers";

const PIPELINE_STATUS_VALIDATOR = v.union(
  v.literal("candidate"),
  v.literal("confirmed_absent"),
  v.literal("present_in_gcc"),
  v.literal("ambiguous_match"),
  v.literal("present_in_gcc_anchor"),
  v.literal("absent_in_anchor_markets"),
  v.literal("ambiguous_requires_review"),
  v.literal("insufficient_official_evidence"),
  v.literal("presence_blocked"),
  v.literal("ready_for_market_research"),
  v.literal("ranked")
);

const CONFIRMATION_STATUS_VALIDATOR = v.union(
  v.literal("candidate"),
  v.literal("confirmed_absent"),
  v.literal("present_in_gcc"),
  v.literal("likely_present_under_different_brand"),
  v.literal("likely_generic_equivalent_present"),
  v.literal("ambiguous_match"),
  v.literal("present_in_gcc_anchor"),
  v.literal("absent_in_anchor_markets"),
  v.literal("present_under_different_brand"),
  v.literal("inn_or_generic_present"),
  v.literal("ambiguous_requires_review"),
  v.literal("insufficient_official_evidence")
);

const PRESENCE_STATUS_VALIDATOR = v.union(
  v.literal("unknown"),
  v.literal("weak_absent"),
  v.literal("connected"),
  v.literal("blocked")
);

const PURSUIT_ROLE_VALIDATOR = v.union(
  v.literal("mah"),
  v.literal("applicant"),
  v.literal("licensor"),
  v.literal("manufacturer"),
  v.literal("unknown")
);

const EVIDENCE_STAGE_VALIDATOR = v.union(
  v.literal("confirmation"),
  v.literal("presence"),
  v.literal("ranking")
);

const EVIDENCE_SOURCE_TYPE_VALIDATOR = v.union(
  v.literal("official_registry"),
  v.literal("company"),
  v.literal("internal")
);

const GCC_PLUS_COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Kuwait",
  "Qatar",
  "Egypt",
  "Algeria",
] as const;

const ANCHOR_GCC_COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Egypt",
  "Kuwait",
] as const;

const COUNTRY_RESEARCH_VALIDATOR = v.object({
  country: v.string(),
  tier: v.union(v.literal("anchor"), v.literal("secondary")),
  result: v.union(
    v.literal("present"),
    v.literal("absent"),
    v.literal("present_under_different_brand"),
    v.literal("inn_or_generic_present"),
    v.literal("ambiguous"),
    v.literal("insufficient_official_evidence"),
    v.literal("skipped")
  ),
  availabilityStatus: v.union(
    v.literal("formally_registered"),
    v.literal("tender_formulary_only"),
    v.literal("shortage_listed"),
    v.literal("hospital_import_only"),
    v.literal("not_found"),
    v.literal("ambiguous"),
    v.literal("unverified")
  ),
  genericAvailability: v.union(
    v.literal("originator_only"),
    v.literal("originator_plus_generics"),
    v.literal("generic_only"),
    v.literal("not_available"),
    v.literal("unclear")
  ),
  confidence: v.union(v.literal("confirmed"), v.literal("likely"), v.literal("inferred")),
  sourceCategory: v.optional(v.union(
    v.literal("official"),
    v.literal("commercial_database"),
    v.literal("proxy")
  )),
  sourceSystem: v.optional(v.union(
    v.literal("cms"),
    v.literal("nhsbsa"),
    v.literal("sfda"),
    v.literal("eda_egypt"),
    v.literal("mohap_uae"),
    v.literal("kuwait_moh"),
    v.literal("qatar_moph"),
    v.literal("algeria_moh"),
    v.literal("bfarm_amice"),
    v.literal("who"),
    v.literal("nupco"),
    v.literal("evaluate"),
    v.literal("clarivate"),
    v.literal("lauer_taxe"),
    v.literal("manual"),
    v.literal("other")
  )),
  sourceTitle: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  summary: v.string(),
  marketedNames: v.array(v.string()),
  checkedAt: v.number(),
  skippedReason: v.optional(v.string()),
});

type CanonicalEntity = Doc<"canonicalProductEntities">;
type CanonicalOpportunity = Doc<"canonicalProductOpportunities">;
type CompanyDoc = Doc<"companies">;
type CanonicalProductDoc = Doc<"canonicalProducts">;
type CanonicalMarketRow = Doc<"canonicalProductMarketAnalyses">;
type LinkedDrugDoc = Doc<"drugs">;

type HydratedEntity = CanonicalEntity & {
  company: CompanyDoc | null;
};

type OpportunityEvidenceInput = {
  stage: "confirmation" | "presence" | "ranking";
  title?: string;
  claim: string;
  url?: string;
  sourceType: "official_registry" | "company" | "internal";
  confidence: "confirmed" | "likely" | "inferred";
  country?: string;
  sourceSystem?:
    | "cms"
    | "nhsbsa"
    | "sfda"
    | "eda_egypt"
    | "mohap_uae"
    | "kuwait_moh"
    | "qatar_moph"
    | "algeria_moh"
    | "bfarm_amice"
    | "who"
    | "nupco"
    | "evaluate"
    | "clarivate"
    | "lauer_taxe"
    | "manual"
    | "other";
};

type PipelineInputs = {
  product: CanonicalProductDoc;
  entities: HydratedEntity[];
  linkedDrugs: LinkedDrugDoc[];
  marketRows: CanonicalMarketRow[];
};

type CountryResearch = {
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
  sourceCategory?: "official" | "commercial_database" | "proxy";
  sourceSystem?:
    | "cms"
    | "nhsbsa"
    | "sfda"
    | "eda_egypt"
    | "mohap_uae"
    | "kuwait_moh"
    | "qatar_moph"
    | "algeria_moh"
    | "bfarm_amice"
    | "who"
    | "nupco"
    | "evaluate"
    | "clarivate"
    | "lauer_taxe"
    | "manual"
    | "other";
  sourceTitle?: string;
  sourceUrl?: string;
  summary: string;
  marketedNames: string[];
  checkedAt: number;
  skippedReason?: string;
};

type ExternalEntityFinding = {
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
};

type ExternalResearchResult = {
  countryFindings: CountryResearch[];
  entityFindings: ExternalEntityFinding[];
};

function normalizeName(value?: string | null) {
  return normalizeText(value);
}

function dedupeEvidence(items: OpportunityEvidenceInput[]) {
  return [
    ...new Map(
      items.map((item) => [
        `${item.stage}|${item.title ?? ""}|${item.claim}|${item.url ?? ""}|${item.country ?? ""}`,
        item,
      ])
    ).values(),
  ].slice(0, 12);
}

function sourceCategoryPriority(value?: "official" | "commercial_database" | "proxy") {
  return value === "official" ? 3 : value === "commercial_database" ? 2 : value === "proxy" ? 1 : 0;
}

function evidenceConfidencePriority(value: "confirmed" | "likely" | "inferred") {
  return value === "confirmed" ? 3 : value === "likely" ? 2 : 1;
}

function mergeCountryResearchRows(
  existing: CountryResearch[] | undefined,
  incoming: CountryResearch[] | undefined
) {
  const merged = new Map<string, CountryResearch>();
  for (const row of [...(existing ?? []), ...(incoming ?? [])]) {
    const key = normalizeName(row.country);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, row);
      continue;
    }

    const previousScore =
      sourceCategoryPriority(previous.sourceCategory) * 10 +
      evidenceConfidencePriority(previous.confidence);
    const nextScore =
      sourceCategoryPriority(row.sourceCategory) * 10 +
      evidenceConfidencePriority(row.confidence);

    if (nextScore > previousScore || (nextScore === previousScore && row.checkedAt >= previous.checkedAt)) {
      merged.set(key, row);
    }
  }
  return [...merged.values()];
}

function rolePriority(role: CanonicalEntity["role"]) {
  switch (role) {
    case "mah":
      return 0;
    case "applicant":
      return 1;
    case "licensor":
      return 2;
    case "manufacturer":
      return 3;
    default:
      return 9;
  }
}

function entityConfidenceWeight(confidence: CanonicalEntity["confidence"]) {
  return confidence === "confirmed" ? 0 : confidence === "likely" ? 1 : 2;
}

function sortEntities(left: CanonicalEntity, right: CanonicalEntity) {
  const roleDelta = rolePriority(left.role) - rolePriority(right.role);
  if (roleDelta !== 0) return roleDelta;
  const primaryDelta = Number(right.isPrimary) - Number(left.isPrimary);
  if (primaryDelta !== 0) return primaryDelta;
  const confidenceDelta = entityConfidenceWeight(left.confidence) - entityConfidenceWeight(right.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;
  return left.entityName.localeCompare(right.entityName);
}

function pickManufacturerEntity(entities: HydratedEntity[]) {
  return [...entities]
    .filter((entity) => entity.role === "manufacturer")
    .sort(sortEntities)[0];
}

function pickCommercialOwnerEntity(entities: HydratedEntity[]) {
  return [...entities]
    .filter((entity) => entity.role === "mah" || entity.role === "applicant" || entity.role === "licensor")
    .sort(sortEntities)[0];
}

function pickUaeRow(rows: CanonicalMarketRow[]) {
  return rows.find((row) => normalizeName(row.country) === "uae");
}

function summarizeCountryResearchEvidence(countryFindings: CountryResearch[]) {
  return countryFindings.flatMap((finding) => {
    if (finding.result === "skipped" && !finding.sourceTitle && !finding.sourceUrl) {
      return [];
    }
    return [
      {
        stage: "confirmation" as const,
        title: finding.sourceTitle ?? `${finding.country} external refresh`,
        claim: finding.summary,
        url: finding.sourceUrl ?? undefined,
        sourceType: "official_registry" as const,
        confidence: finding.confidence,
        country: finding.country,
        sourceSystem: finding.sourceSystem,
      },
    ];
  });
}

function determineConfirmation(args: {
  product: CanonicalProductDoc;
  uaeRow?: CanonicalMarketRow;
  countryResearch?: CountryResearch[];
}) {
  const externalCountryFindings = args.countryResearch?.filter((finding) =>
    ANCHOR_GCC_COUNTRIES.some((country) => normalizeName(country) === normalizeName(finding.country))
  );
  if (externalCountryFindings && externalCountryFindings.length > 0) {
    const hasConfirmedPresence = externalCountryFindings.some((finding) => finding.result === "present");
    if (hasConfirmedPresence) {
      return {
        confirmationStatus: "present_in_gcc_anchor" as const,
        pipelineStatus: "present_in_gcc_anchor" as const,
        confirmationReason:
          "Fresh anchor-market research confirms that this product is already present in at least one GCC++ anchor market.",
        evidence: summarizeCountryResearchEvidence(externalCountryFindings),
      };
    }

    const hasDifferentBrand = externalCountryFindings.some(
      (finding) => finding.result === "present_under_different_brand"
    );
    if (hasDifferentBrand) {
      return {
        confirmationStatus: "present_under_different_brand" as const,
        pipelineStatus: "present_in_gcc_anchor" as const,
        confirmationReason:
          "Fresh anchor-market research suggests this molecule is already present locally under a different brand identity.",
        evidence: summarizeCountryResearchEvidence(externalCountryFindings),
      };
    }

    const hasGenericPresence = externalCountryFindings.some(
      (finding) => finding.result === "inn_or_generic_present"
    );
    if (hasGenericPresence) {
      return {
        confirmationStatus: "inn_or_generic_present" as const,
        pipelineStatus: "present_in_gcc_anchor" as const,
        confirmationReason:
          "Fresh anchor-market research suggests the INN is already present generically or through a non-originator route.",
        evidence: summarizeCountryResearchEvidence(externalCountryFindings),
      };
    }

    const hasAmbiguous = externalCountryFindings.some((finding) => finding.result === "ambiguous");
    if (hasAmbiguous) {
      return {
        confirmationStatus: "ambiguous_requires_review" as const,
        pipelineStatus: "ambiguous_requires_review" as const,
        confirmationReason:
          "Fresh anchor-market research found ambiguous matches, so this product still needs review before ranking as whitespace.",
        evidence: summarizeCountryResearchEvidence(externalCountryFindings),
      };
    }

    const absentAnchors = externalCountryFindings.filter((finding) => finding.result === "absent");
    const hasUaeAbsent = absentAnchors.some((finding) => normalizeName(finding.country) === "uae");
    const hasAnyAnchorAbsent = absentAnchors.length > 0;
    if (hasUaeAbsent || hasAnyAnchorAbsent) {
      return {
        confirmationStatus: "absent_in_anchor_markets" as const,
        pipelineStatus: "absent_in_anchor_markets" as const,
        confirmationReason:
          hasUaeAbsent
            ? "Fresh anchor-market research confirms UAE whitespace for this product."
            : "Fresh anchor-market research found no confirmed presence in the checked GCC++ anchor markets.",
        evidence: summarizeCountryResearchEvidence(externalCountryFindings),
      };
    }

    return {
      confirmationStatus: "insufficient_official_evidence" as const,
      pipelineStatus: "insufficient_official_evidence" as const,
      confirmationReason:
        "Fresh anchor-market research did not surface enough official evidence to promote or block this product confidently.",
      evidence: summarizeCountryResearchEvidence(externalCountryFindings),
    };
  }

  const row = args.uaeRow;
  if (!row) {
    return {
      confirmationStatus: "candidate" as const,
      pipelineStatus: "candidate" as const,
      confirmationReason: "UAE official registry evidence has not been applied to this product yet.",
      evidence: [] as OpportunityEvidenceInput[],
    };
  }

  const productBrand = normalizeName(args.product.brandName);
  const productInn = normalizeName(args.product.inn);
  const marketedNames = row.marketedNames.map((name) => normalizeName(name));
  const hasBrandMatch = marketedNames.includes(productBrand);
  const hasInnMatch = marketedNames.includes(productInn);

  const evidence = (row.evidenceItems ?? []).map((item) => ({
    stage: "confirmation" as const,
    title: item.title,
    claim: item.claim,
    url: item.url,
    sourceType: "official_registry" as const,
    confidence: item.confidence,
    country: item.country,
    sourceSystem: item.sourceSystem,
  }));

  if (row.availabilityStatus === "ambiguous") {
    return {
      confirmationStatus: "ambiguous_match" as const,
      pipelineStatus: "ambiguous_match" as const,
      confirmationReason: "UAE evidence is ambiguous, so this product still needs manual confirmation before promotion.",
      evidence,
    };
  }

  if (row.availabilityStatus === "not_found") {
    return {
      confirmationStatus: "confirmed_absent" as const,
      pipelineStatus: "confirmed_absent" as const,
      confirmationReason: "UAE official evidence currently shows no confirmed local registration for this product identity.",
      evidence,
    };
  }

  if (row.availabilityStatus === "unverified") {
    return {
      confirmationStatus: "candidate" as const,
      pipelineStatus: "candidate" as const,
      confirmationReason:
        "UAE market evidence exists for this product, but it is still unverified and should not be promoted until registry confirmation is stronger.",
      evidence,
    };
  }

  if (row.genericAvailability === "generic_only" || (!hasBrandMatch && hasInnMatch)) {
    return {
      confirmationStatus: "likely_generic_equivalent_present" as const,
      pipelineStatus: "present_in_gcc" as const,
      confirmationReason: "UAE evidence suggests the INN is present generically or under a non-originator identity.",
      evidence,
    };
  }

  if (!hasBrandMatch && row.marketedNames.length > 0) {
    return {
      confirmationStatus: "likely_present_under_different_brand" as const,
      pipelineStatus: "present_in_gcc" as const,
      confirmationReason: "UAE evidence suggests the product is already present locally under a different brand identity.",
      evidence,
    };
  }

  return {
    confirmationStatus: "present_in_gcc" as const,
    pipelineStatus: "present_in_gcc" as const,
    confirmationReason: "UAE evidence indicates that this branded product is already present in the market.",
    evidence,
  };
}

function companyPresenceSummary(company: CompanyDoc) {
  const partnerHits = (company.existingMenaPartners ?? []).filter((partner) =>
    partner.geographies.some((geography) =>
      GCC_PLUS_COUNTRIES.some((country) => normalizeName(geography).includes(normalizeName(country)))
    )
  );

  const hasExplicitGccLink = partnerHits.length > 0;
  const menaPresence = company.menaPresence ?? company.menaChannelStatus;
  const partnershipStrength = company.menaPartnershipStrength;

  if (
    menaPresence === "established" ||
    partnershipStrength === "entrenched" ||
    partnershipStrength === "moderate" ||
    hasExplicitGccLink
  ) {
    const reason = hasExplicitGccLink
      ? `${company.name} already has GCC++ partner or affiliate signals (${partnerHits.map((partner) => partner.name).slice(0, 3).join(", ")}).`
      : `${company.name} already shows established or meaningful MENA channel coverage.`;
    return {
      presenceStatus: "blocked" as const,
      presenceReason: reason,
      evidence: [
        ...(company.bdEvidenceItems ?? []).slice(0, 2).map((item) => ({
          stage: "presence" as const,
          title: item.source,
          claim: item.claim,
          url: item.url,
          sourceType: "company" as const,
          confidence: "likely" as const,
        })),
        ...partnerHits.slice(0, 3).map((partner) => ({
          stage: "presence" as const,
          title: partner.source ?? `${company.name} GCC++ partner signal`,
          claim: `${partner.name} is linked to ${company.name} as ${partner.role.replaceAll("_", " ")} across ${partner.geographies.join(", ")}.`,
          url: partner.url,
          sourceType: "company" as const,
          confidence: partner.confidence,
        })),
      ],
    };
  }

  if (menaPresence === "none" || partnershipStrength === "none") {
    return {
      presenceStatus: "weak_absent" as const,
      presenceReason: `${company.name} currently looks clear of meaningful GCC++ channel coverage in the stored company research.`,
      evidence: (company.bdEvidenceItems ?? []).slice(0, 2).map((item) => ({
        stage: "presence" as const,
        title: item.source,
        claim: item.claim,
        url: item.url,
        sourceType: "company" as const,
        confidence: "likely" as const,
      })),
    };
  }

  if (menaPresence === "limited" || partnershipStrength === "limited") {
    return {
      presenceStatus: "connected" as const,
      presenceReason: `${company.name} shows some MENA connectivity, but not enough to fully close the opportunity.`,
      evidence: (company.bdEvidenceItems ?? []).slice(0, 2).map((item) => ({
        stage: "presence" as const,
        title: item.source,
        claim: item.claim,
        url: item.url,
        sourceType: "company" as const,
        confidence: "likely" as const,
      })),
    };
  }

  return {
    presenceStatus: "unknown" as const,
    presenceReason: `${company.name} is linked to the product, but the stored company record does not yet contain enough GCC++ presence detail for a hard gate.`,
    evidence: [] as OpportunityEvidenceInput[],
  };
}

function determinePresence(args: {
  commercialOwnerEntity?: HydratedEntity;
  manufacturerEntity?: HydratedEntity;
  externalEntityFindings?: ExternalEntityFinding[];
}) {
  const externalOwnerFinding = args.externalEntityFindings?.find(
    (finding) => finding.role === "commercial_owner"
  );
  if (externalOwnerFinding && args.commercialOwnerEntity) {
    return {
      presenceStatus: externalOwnerFinding.presenceStatus,
      presenceReason: externalOwnerFinding.summary,
      evidence: externalOwnerFinding.evidenceItems.map((item) => ({
        stage: "presence" as const,
        title: item.source,
        claim: item.claim,
        url: item.url ?? undefined,
        sourceType: "company" as const,
        confidence: item.confidence,
      })),
      recommendedEntity: args.commercialOwnerEntity,
      recommendedRole:
        args.commercialOwnerEntity.role === "mah"
          ? ("mah" as const)
          : args.commercialOwnerEntity.role === "applicant"
            ? ("applicant" as const)
            : args.commercialOwnerEntity.role === "licensor"
              ? ("licensor" as const)
              : ("unknown" as const),
    };
  }

  const externalManufacturerFinding = args.externalEntityFindings?.find(
    (finding) => finding.role === "manufacturer"
  );
  if (externalManufacturerFinding && args.manufacturerEntity) {
    return {
      presenceStatus: externalManufacturerFinding.presenceStatus,
      presenceReason: externalManufacturerFinding.summary,
      evidence: externalManufacturerFinding.evidenceItems.map((item) => ({
        stage: "presence" as const,
        title: item.source,
        claim: item.claim,
        url: item.url ?? undefined,
        sourceType: "company" as const,
        confidence: item.confidence,
      })),
      recommendedEntity:
        externalOwnerFinding?.recommendedPursuit === true && args.commercialOwnerEntity
          ? args.commercialOwnerEntity
          : args.manufacturerEntity,
      recommendedRole:
        externalOwnerFinding?.recommendedPursuit === true && args.commercialOwnerEntity
          ? (args.commercialOwnerEntity.role === "mah"
              ? ("mah" as const)
              : args.commercialOwnerEntity.role === "applicant"
                ? ("applicant" as const)
                : args.commercialOwnerEntity.role === "licensor"
                  ? ("licensor" as const)
                  : ("unknown" as const))
          : ("manufacturer" as const),
    };
  }

  const ownerCompany = args.commercialOwnerEntity?.company;
  if (ownerCompany) {
    const ownerPresence = companyPresenceSummary(ownerCompany);
    return {
      ...ownerPresence,
      recommendedEntity: args.commercialOwnerEntity,
      recommendedRole:
        args.commercialOwnerEntity?.role === "mah"
          ? ("mah" as const)
          : args.commercialOwnerEntity?.role === "applicant"
            ? ("applicant" as const)
            : args.commercialOwnerEntity?.role === "licensor"
              ? ("licensor" as const)
              : ("unknown" as const),
    };
  }

  const manufacturerCompany = args.manufacturerEntity?.company;
  if (manufacturerCompany) {
    const manufacturerPresence = companyPresenceSummary(manufacturerCompany);
    return {
      ...manufacturerPresence,
      recommendedEntity: args.manufacturerEntity,
      recommendedRole: "manufacturer" as const,
    };
  }

  if (args.commercialOwnerEntity) {
    return {
      presenceStatus: "unknown" as const,
      presenceReason: `${args.commercialOwnerEntity.entityName} is recognized as the commercial owner, but it is not yet linked to a structured company record.`,
      evidence: [] as OpportunityEvidenceInput[],
      recommendedEntity: args.commercialOwnerEntity,
      recommendedRole:
        args.commercialOwnerEntity.role === "mah"
          ? ("mah" as const)
          : args.commercialOwnerEntity.role === "applicant"
            ? ("applicant" as const)
            : args.commercialOwnerEntity.role === "licensor"
              ? ("licensor" as const)
              : ("unknown" as const),
    };
  }

  if (args.manufacturerEntity) {
    return {
      presenceStatus: "unknown" as const,
      presenceReason: `${args.manufacturerEntity.entityName} is the best-known linked manufacturer, but it is not yet linked to a structured company record.`,
      evidence: [] as OpportunityEvidenceInput[],
      recommendedEntity: args.manufacturerEntity,
      recommendedRole: "manufacturer" as const,
    };
  }

  return {
    presenceStatus: "unknown" as const,
    presenceReason: "No structured commercial-owner or manufacturer entity is linked to this canonical product yet.",
    evidence: [] as OpportunityEvidenceInput[],
    recommendedEntity: undefined,
    recommendedRole: "unknown" as const,
  };
}

function averagePatentUrgency(linkedDrugs: LinkedDrugDoc[]) {
  const values = linkedDrugs
    .map((drug) => drug.patentUrgencyScore)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildRanking(args: {
  confirmationStatus:
    | "candidate"
    | "confirmed_absent"
    | "present_in_gcc"
    | "likely_present_under_different_brand"
    | "likely_generic_equivalent_present"
    | "ambiguous_match"
    | "present_in_gcc_anchor"
    | "absent_in_anchor_markets"
    | "present_under_different_brand"
    | "inn_or_generic_present"
    | "ambiguous_requires_review"
    | "insufficient_official_evidence";
  presenceStatus: "unknown" | "weak_absent" | "connected" | "blocked";
  recommendedRole: "mah" | "applicant" | "licensor" | "manufacturer" | "unknown";
  product: CanonicalProductDoc;
  linkedDrugs: LinkedDrugDoc[];
  marketRows: CanonicalMarketRow[];
}) {
  const bestMarketScore = Math.max(
    0,
    ...args.marketRows.map((row) => row.priorityScore ?? row.commercialOpportunityScore ?? 0)
  );
  const whitespaceMarkets = args.marketRows.filter((row) => row.availabilityStatus === "not_found").length;
  const patentUrgency = averagePatentUrgency(args.linkedDrugs);
  const needLevel =
    bestMarketScore >= 8 ? "high" : bestMarketScore >= 5 ? "moderate" : "early";

  const whitespaceComponent =
    args.confirmationStatus === "confirmed_absent" || args.confirmationStatus === "absent_in_anchor_markets"
      ? 4.5
      : args.confirmationStatus === "candidate" || args.confirmationStatus === "insufficient_official_evidence"
        ? 1
        : args.confirmationStatus === "ambiguous_match" || args.confirmationStatus === "ambiguous_requires_review"
          ? -2
          : args.confirmationStatus === "likely_present_under_different_brand" ||
              args.confirmationStatus === "present_under_different_brand"
            ? -1
            : args.confirmationStatus === "likely_generic_equivalent_present" ||
                args.confirmationStatus === "inn_or_generic_present"
              ? -1.5
              : -3.5;

  const presenceComponent =
    args.presenceStatus === "weak_absent"
      ? 3.5
      : args.presenceStatus === "connected"
        ? -0.75
        : args.presenceStatus === "unknown"
          ? 0.5
          : -3;

  const roleComponent =
    args.recommendedRole === "mah" || args.recommendedRole === "applicant" || args.recommendedRole === "licensor"
      ? 1.5
      : args.recommendedRole === "manufacturer"
        ? 1
        : 0;

  const postureComponent =
    (args.product.productType === "biosimilar" ? -0.5 : 0) +
    (patentUrgency >= 8 ? 1.5 : patentUrgency >= 6 ? 1 : 0) +
    (whitespaceMarkets >= 3 ? 1 : whitespaceMarkets >= 1 ? 0.5 : 0);

  const marketComponent = Math.min(3.5, bestMarketScore / 2.5);
  const rankingScore = Math.max(
    0,
    Math.min(10, Number((whitespaceComponent + presenceComponent + roleComponent + postureComponent + marketComponent).toFixed(2)))
  );

  const topCountries = [...args.marketRows]
    .sort((left, right) => (right.priorityScore ?? 0) - (left.priorityScore ?? 0))
    .slice(0, 3)
    .map((row) => row.country);

  return {
    rankingScore,
    rankingReason: `Score ${rankingScore}/10 because this product looks ${args.confirmationStatus.replaceAll("_", " ")}, GCC++ partner coverage is ${args.presenceStatus.replaceAll("_", " ")}, market need is ${needLevel}, and the best current GCC++ markets are ${topCountries.join(", ") || "still being derived"}.`,
    marketSignalsSummary:
      topCountries.length > 0
        ? `Top GCC++ priorities are ${topCountries.join(", ")} based on current market analysis and whitespace evidence.`
        : "No prioritized GCC++ markets are available yet for this product.",
  };
}

async function refreshLinkedCompanyFromExternalFinding(
  ctx: ActionCtx,
  entity: HydratedEntity | undefined,
  finding: ExternalEntityFinding | undefined
) {
  if (!entity?.company || !finding) return;

  await ctx.runMutation(api.companies.update, {
    id: entity.company._id,
    researchedAt: Date.now(),
    menaPresence:
      finding.presenceStatus === "blocked"
        ? "established"
        : finding.presenceStatus === "connected"
          ? "limited"
          : finding.presenceStatus === "weak_absent"
            ? "none"
            : undefined,
    menaChannelStatus:
      finding.presenceStatus === "blocked"
        ? "established"
        : finding.presenceStatus === "connected"
          ? "limited"
          : finding.presenceStatus === "weak_absent"
            ? "none"
            : undefined,
    entityRoles:
      finding.role === "commercial_owner"
        ? ["market_authorization_holder"]
        : ["manufacturer"],
    commercialControlLevel: finding.commercialControl,
    existingMenaPartners: finding.partners.map((partner) => ({
      name: partner.name,
      role: partner.role,
      geographies: partner.geographies,
      exclusivity: partner.exclusivity ?? undefined,
      confidence: partner.confidence,
      source: partner.source,
      url: partner.url ?? undefined,
    })),
    menaPartnershipStrength: finding.partnerStrength,
    approachTargetRecommendation:
      finding.presenceStatus === "blocked"
        ? "deprioritize"
        : finding.recommendedPursuit
          ? "approach"
          : "watch",
    approachTargetReason: finding.summary,
    notApproachableReason:
      finding.presenceStatus === "blocked" ? finding.summary : undefined,
    bdEvidenceItems: finding.evidenceItems.map((item) => ({
      claim: item.claim,
      source: item.source,
      url: item.url ?? undefined,
    })),
  });
}

async function persistCountryResearchEvidence(
  ctx: ActionCtx,
  canonicalProductId: Id<"canonicalProducts">,
  countryFindings: CountryResearch[] | undefined
) {
  if (!countryFindings) return;
  for (const finding of countryFindings) {
    if (!finding.sourceUrl) continue;
    await ctx.runMutation(api.opportunities.upsertWebsiteEvidence, {
      canonicalProductId,
      country: finding.country,
      claim: finding.summary,
      title: finding.sourceTitle ?? `${finding.country} external refresh`,
      url: finding.sourceUrl,
      sourceType: "official_registry",
      sourceSystem: finding.sourceSystem ?? "manual",
      sourceCategory: finding.sourceCategory ?? "proxy",
      confidence: finding.confidence,
      observedAt: finding.checkedAt,
      notes:
        finding.tier === "secondary" && finding.result === "insufficient_official_evidence"
          ? "Secondary-market refresh recorded insufficient official evidence."
          : undefined,
    });
  }
}

export const backfillCanonicalEntityCompanyLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").collect();
    const companyIdByName = new Map<string, Id<"companies">>();
    const duplicateNames = new Set<string>();

    for (const company of companies) {
      const key = normalizeName(company.name);
      if (companyIdByName.has(key)) {
        duplicateNames.add(key);
        continue;
      }
      companyIdByName.set(key, company._id);
    }

    let updated = 0;
    for (const entity of await ctx.db.query("canonicalProductEntities").collect()) {
      if (entity.companyId) continue;
      const key = normalizeName(entity.entityName);
      if (!key || duplicateNames.has(key)) continue;
      const companyId = companyIdByName.get(key);
      if (!companyId) continue;
      await ctx.db.patch(entity._id, { companyId, updatedAt: Date.now() });
      updated += 1;
    }

    return { updated };
  },
});

export const getPipelineInputs = internalQuery({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }): Promise<PipelineInputs | null> => {
    const [product, entities, linkedDrugs, marketRows] = await Promise.all([
      ctx.db.get(canonicalProductId),
      ctx.db
        .query("canonicalProductEntities")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("drugs")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("canonicalProductMarketAnalyses")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
    ]);

    if (!product) return null;

    const hydratedEntities = await Promise.all(
      entities.map(async (entity) => ({
        ...entity,
        company: entity.companyId ? await ctx.db.get(entity.companyId) : null,
      }))
    );

    return {
      product,
      entities: hydratedEntities.sort(sortEntities),
      linkedDrugs,
      marketRows,
    };
  },
});

export const upsert = mutation({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    pipelineStatus: PIPELINE_STATUS_VALIDATOR,
    confirmationStatus: CONFIRMATION_STATUS_VALIDATOR,
    presenceStatus: PRESENCE_STATUS_VALIDATOR,
    targetCountries: v.array(v.string()),
    focusCountry: v.optional(v.string()),
    uaeAvailabilityStatus: v.optional(v.union(
      v.literal("formally_registered"),
      v.literal("tender_formulary_only"),
      v.literal("shortage_listed"),
      v.literal("hospital_import_only"),
      v.literal("not_found"),
      v.literal("ambiguous"),
      v.literal("unverified")
    )),
    uaeGenericAvailability: v.optional(v.union(
      v.literal("originator_only"),
      v.literal("originator_plus_generics"),
      v.literal("generic_only"),
      v.literal("not_available"),
      v.literal("unclear")
    )),
    countryResearch: v.optional(v.array(COUNTRY_RESEARCH_VALIDATOR)),
    commercialOwnerEntityId: v.optional(v.id("canonicalProductEntities")),
    manufacturerEntityId: v.optional(v.id("canonicalProductEntities")),
    recommendedPursuitEntityId: v.optional(v.id("canonicalProductEntities")),
    recommendedPursuitRole: v.optional(PURSUIT_ROLE_VALIDATOR),
    recommendedPursuitCompanyId: v.optional(v.id("companies")),
    confirmationReason: v.optional(v.string()),
    presenceReason: v.optional(v.string()),
    marketSignalsSummary: v.optional(v.string()),
    rankingScore: v.optional(v.number()),
    rankingReason: v.optional(v.string()),
    lastPipelineRunAt: v.number(),
    freshResearchRunAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("canonicalProductOpportunities")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", args.canonicalProductId))
      .unique();
    const now = Date.now();
    const nextCountryResearch = mergeCountryResearchRows(existing?.countryResearch as CountryResearch[] | undefined, args.countryResearch as CountryResearch[] | undefined);

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        countryResearch: nextCountryResearch.length > 0 ? nextCountryResearch : undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("canonicalProductOpportunities", {
      ...args,
      countryResearch: nextCountryResearch.length > 0 ? nextCountryResearch : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const replaceEvidence = mutation({
  args: {
    canonicalProductOpportunityId: v.id("canonicalProductOpportunities"),
    evidence: v.array(v.object({
      stage: EVIDENCE_STAGE_VALIDATOR,
      title: v.optional(v.string()),
      claim: v.string(),
      url: v.optional(v.string()),
      sourceType: EVIDENCE_SOURCE_TYPE_VALIDATOR,
      confidence: v.union(v.literal("confirmed"), v.literal("likely"), v.literal("inferred")),
      country: v.optional(v.string()),
      sourceSystem: v.optional(v.union(
        v.literal("cms"),
        v.literal("nhsbsa"),
        v.literal("sfda"),
        v.literal("eda_egypt"),
        v.literal("mohap_uae"),
        v.literal("kuwait_moh"),
        v.literal("qatar_moph"),
        v.literal("algeria_moh"),
        v.literal("bfarm_amice"),
        v.literal("who"),
        v.literal("nupco"),
        v.literal("evaluate"),
        v.literal("clarivate"),
        v.literal("lauer_taxe"),
        v.literal("manual"),
        v.literal("other")
      )),
    })),
  },
  handler: async (ctx, { canonicalProductOpportunityId, evidence }) => {
    const existing = await ctx.db
      .query("canonicalProductOpportunityEvidence")
      .withIndex("by_canonical_product_opportunity", (q) =>
        q.eq("canonicalProductOpportunityId", canonicalProductOpportunityId)
      )
      .collect();

    const mergedEvidence = dedupeEvidence([
      ...existing.map((row) => ({
        stage: row.stage,
        title: row.title ?? undefined,
        claim: row.claim,
        url: row.url ?? undefined,
        sourceType: row.sourceType,
        confidence: row.confidence,
        country: row.country ?? undefined,
        sourceSystem: row.sourceSystem ?? undefined,
      })),
      ...evidence,
    ]);

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (const item of mergedEvidence) {
      await ctx.db.insert("canonicalProductOpportunityEvidence", {
        canonicalProductOpportunityId,
        ...item,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

async function buildOpportunityState(
  ctx: ActionCtx,
  canonicalProductId: Id<"canonicalProducts">,
  externalResearch?: ExternalResearchResult | null
) {
  await ctx.runAction(api.productMarketAnalysis.analyzeCanonicalProductMarkets, {
    canonicalProductId,
  });

  const inputs = await ctx.runQuery(internal.canonicalOpportunities.getPipelineInputs, {
    canonicalProductId,
  });

  if (!inputs) return null;

  const commercialOwnerEntity = pickCommercialOwnerEntity(inputs.entities);
  const manufacturerEntity = pickManufacturerEntity(inputs.entities);
  const confirmation = determineConfirmation({
    product: inputs.product,
    uaeRow: pickUaeRow(inputs.marketRows),
    countryResearch: externalResearch?.countryFindings,
  });
  const presence = determinePresence({
    commercialOwnerEntity,
    manufacturerEntity,
    externalEntityFindings: externalResearch?.entityFindings,
  });
  const ranking = buildRanking({
    confirmationStatus: confirmation.confirmationStatus,
    presenceStatus: presence.presenceStatus,
    recommendedRole: presence.recommendedRole,
    product: inputs.product,
    linkedDrugs: inputs.linkedDrugs,
    marketRows: inputs.marketRows,
  });

  let pipelineStatus: CanonicalOpportunity["pipelineStatus"] = confirmation.pipelineStatus;
  if (
    confirmation.confirmationStatus === "confirmed_absent" ||
    confirmation.confirmationStatus === "absent_in_anchor_markets"
  ) {
    if (presence.presenceStatus === "blocked") {
      pipelineStatus = "presence_blocked";
    } else {
      pipelineStatus = ranking.rankingScore > 0 ? "ranked" : "ready_for_market_research";
    }
  } else if (confirmation.confirmationStatus === "insufficient_official_evidence") {
    pipelineStatus = "candidate";
  }

  return {
    inputs,
    commercialOwnerEntity,
    manufacturerEntity,
    confirmation,
    presence,
    ranking,
    pipelineStatus,
  };
}

export const getByCanonicalProductInputs = query({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }) => {
    return await ctx.runQuery(internal.canonicalOpportunities.getPipelineInputs, {
      canonicalProductId,
    });
  },
});

export const getByCanonicalProduct = query({
  args: { canonicalProductId: v.id("canonicalProducts") },
  handler: async (ctx, { canonicalProductId }) => {
    const opportunity = await ctx.db
      .query("canonicalProductOpportunities")
      .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
      .unique();

    if (!opportunity) return null;

    const [entities, evidence] = await Promise.all([
      ctx.db
        .query("canonicalProductEntities")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", canonicalProductId))
        .collect(),
      ctx.db
        .query("canonicalProductOpportunityEvidence")
        .withIndex("by_canonical_product_opportunity", (q) => q.eq("canonicalProductOpportunityId", opportunity._id))
        .collect(),
    ]);

    const entityIds = [
      opportunity.commercialOwnerEntityId,
      opportunity.manufacturerEntityId,
      opportunity.recommendedPursuitEntityId,
    ].filter((value): value is Id<"canonicalProductEntities"> => Boolean(value));

    const selectedEntities = new Map(
      entities
        .filter((entity) => entityIds.includes(entity._id))
        .map((entity) => [entity._id, entity])
    );

    const companyIds = [
      ...new Set(
        [...selectedEntities.values()]
          .map((entity) => entity.companyId)
          .filter((value): value is Id<"companies"> => Boolean(value))
      ),
    ];
    const companies = await Promise.all(companyIds.map(async (id) => await ctx.db.get(id)));
    const companiesById = new Map(
      companies.filter((company): company is CompanyDoc => Boolean(company)).map((company) => [company._id, company])
    );

    function hydrateEntity(entityId?: Id<"canonicalProductEntities">) {
      if (!entityId) return null;
      const entity = selectedEntities.get(entityId);
      if (!entity) return null;
      return {
        ...entity,
        company: entity.companyId ? companiesById.get(entity.companyId) ?? null : null,
      };
    }

    return {
      ...opportunity,
      commercialOwnerEntity: hydrateEntity(opportunity.commercialOwnerEntityId),
      manufacturerEntity: hydrateEntity(opportunity.manufacturerEntityId),
      recommendedPursuitEntity: hydrateEntity(opportunity.recommendedPursuitEntityId),
      evidence: evidence.sort((left, right) => left.stage.localeCompare(right.stage)),
    };
  },
});

async function listByPipelineStatus(
  ctx: QueryCtx,
  statuses: CanonicalOpportunity["pipelineStatus"][],
  limit: number
) {
  const rows = await ctx.db.query("canonicalProductOpportunities").take(Math.max(limit * 6, 120));
  return rows
    .filter((row) => statuses.includes(row.pipelineStatus))
    .sort((left, right) => (right.rankingScore ?? 0) - (left.rankingScore ?? 0))
    .slice(0, limit);
}

function confirmationRank(status: CanonicalOpportunity["confirmationStatus"]) {
  switch (status) {
    case "confirmed_absent":
    case "absent_in_anchor_markets":
      return 4;
    case "candidate":
    case "insufficient_official_evidence":
      return 2;
    case "ambiguous_match":
    case "ambiguous_requires_review":
      return 1;
    default:
      return 0;
  }
}

function presenceRank(status: CanonicalOpportunity["presenceStatus"]) {
  switch (status) {
    case "weak_absent":
      return 3;
    case "unknown":
      return 2;
    case "connected":
      return 1;
    case "blocked":
    default:
      return 0;
  }
}

function marketNeedScore(rows: CanonicalMarketRow[]) {
  return Math.max(0, ...rows.map((row) => row.priorityScore ?? row.commercialOpportunityScore ?? 0));
}

function marketNeedLabel(score: number) {
  if (score >= 8) return "high";
  if (score >= 5) return "moderate";
  return "early";
}

function deriveProductPriorityScore(args: {
  confirmationStatus: CanonicalOpportunity["confirmationStatus"];
  presenceStatus: CanonicalOpportunity["presenceStatus"];
  needScore: number;
  existingRankingScore?: number;
}) {
  if ((args.existingRankingScore ?? 0) > 0) {
    return args.existingRankingScore ?? 0;
  }

  return Number(
    Math.max(
      0,
      Math.min(
        10,
        (
          confirmationRank(args.confirmationStatus) * 1.75 +
          presenceRank(args.presenceStatus) * 1.25 +
          Math.min(3.5, args.needScore / 2.5)
        )
      )
    ).toFixed(2)
  );
}

async function hydrateEntitiesForOpportunities(
  ctx: QueryCtx,
  rows: CanonicalOpportunity[]
) {
  const entityIds = [
    ...new Set(
      rows.flatMap((row) =>
        [row.commercialOwnerEntityId, row.manufacturerEntityId, row.recommendedPursuitEntityId].filter(
          (value): value is Id<"canonicalProductEntities"> => Boolean(value)
        )
      )
    ),
  ];
  const entities = await Promise.all(entityIds.map(async (id) => await ctx.db.get(id)));
  const entitiesById = new Map(
    entities.filter((entity): entity is CanonicalEntity => Boolean(entity)).map((entity) => [entity._id, entity])
  );
  const companyIds = [
    ...new Set(
      [...entitiesById.values()]
        .map((entity) => entity.companyId)
        .filter((value): value is Id<"companies"> => Boolean(value))
    ),
  ];
  const companies = await Promise.all(companyIds.map(async (id) => await ctx.db.get(id)));
  const companiesById = new Map(
    companies.filter((company): company is CompanyDoc => Boolean(company)).map((company) => [company._id, company])
  );

  function hydrateEntity(entityId?: Id<"canonicalProductEntities"> | null) {
    if (!entityId) return null;
    const entity = entitiesById.get(entityId);
    if (!entity) return null;
    return {
      ...entity,
      company: entity.companyId ? companiesById.get(entity.companyId) ?? null : null,
    };
  }

  return { hydrateEntity };
}

export const listCandidates = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(
      ctx,
      ["candidate", "confirmed_absent", "absent_in_anchor_markets", "ready_for_market_research", "insufficient_official_evidence"],
      limit
    ),
});

export const listConfirmed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(
      ctx,
      ["confirmed_absent", "absent_in_anchor_markets", "ready_for_market_research", "ranked"],
      limit
    ),
});

export const listBlocked = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(
      ctx,
      ["presence_blocked", "present_in_gcc", "present_in_gcc_anchor", "ambiguous_match", "ambiguous_requires_review"],
      limit
    ),
});

export const listBlockedByAnchor = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["present_in_gcc", "present_in_gcc_anchor"], limit),
});

export const listBlockedByPresence = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["presence_blocked"], limit),
});

export const listRanked = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) =>
    await listByPipelineStatus(ctx, ["ranked"], limit),
});

export const listProductRankings = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 24 }) => {
    const seedRows = await ctx.db
      .query("canonicalProductOpportunities")
      .withIndex("by_ranking_score")
      .order("desc")
      .take(Math.max(limit * 8, 160));

    const candidateRows = seedRows.filter((row) => {
      if (
        row.confirmationStatus !== "confirmed_absent" &&
        row.confirmationStatus !== "absent_in_anchor_markets" &&
        row.confirmationStatus !== "candidate" &&
        row.confirmationStatus !== "insufficient_official_evidence"
      ) {
        return false;
      }
      return row.presenceStatus === "weak_absent" || row.presenceStatus === "unknown";
    });

    const rows = candidateRows.slice(0, Math.max(limit * 3, 36));
    if (rows.length === 0) return [];

    const products = await Promise.all(rows.map(async (row) => await ctx.db.get(row.canonicalProductId)));
    const productsById = new Map(
      products.filter((product): product is CanonicalProductDoc => Boolean(product)).map((product) => [product._id, product])
    );
    const analyses = await Promise.all(
      rows.map(async (row) =>
        await ctx.db
          .query("canonicalProductMarketAnalyses")
          .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", row.canonicalProductId))
          .collect()
      )
    );
    const analysesByCanonicalId = new Map(
      rows.map((row, index) => [row.canonicalProductId, analyses[index] ?? []] as const)
    );
    const { hydrateEntity } = await hydrateEntitiesForOpportunities(ctx, rows);

    return rows
      .map((row) => {
        const product = productsById.get(row.canonicalProductId);
        if (!product) return null;
        const marketRows = analysesByCanonicalId.get(row.canonicalProductId) ?? [];
        const needScore = marketNeedScore(marketRows);
        const topMarkets = [...marketRows]
          .sort((left, right) => (right.priorityScore ?? right.commercialOpportunityScore ?? 0) - (left.priorityScore ?? left.commercialOpportunityScore ?? 0))
          .slice(0, 3)
          .map((market) => ({
            country: market.country,
            score: market.priorityScore ?? market.commercialOpportunityScore ?? 0,
            availabilityStatus: market.availabilityStatus,
          }));
        const anchorAbsence = (row.countryResearch ?? []).filter(
          (item) => item.tier === "anchor" && item.result === "absent"
        ).length;
        const displayRankingScore = deriveProductPriorityScore({
          confirmationStatus: row.confirmationStatus,
          presenceStatus: row.presenceStatus,
          needScore,
          existingRankingScore: row.rankingScore,
        });
        const commercialOwnerEntity = hydrateEntity(row.commercialOwnerEntityId);
        const manufacturerEntity = hydrateEntity(row.manufacturerEntityId);
        const recommendedEntity = hydrateEntity(row.recommendedPursuitEntityId);
        return {
          _id: row._id,
          canonicalProductId: row.canonicalProductId,
          brandName: product.brandName,
          inn: product.inn,
          therapeuticArea: product.therapeuticArea ?? null,
          productType: product.productType,
          rankingScore: displayRankingScore,
          rankingReason:
            row.rankingReason ??
            `Product-first score ${displayRankingScore}/10 because GCC++ availability is ${row.confirmationStatus.replaceAll("_", " ")}, partner coverage is ${row.presenceStatus.replaceAll("_", " ")}, and market need is ${marketNeedLabel(needScore)}.`,
          confirmationStatus: row.confirmationStatus,
          presenceStatus: row.presenceStatus,
          recommendedPursuitRole: row.recommendedPursuitRole ?? "unknown",
          needScore,
          needLevel: marketNeedLabel(needScore),
          topMarkets,
          anchorAbsenceCount: anchorAbsence,
          freshResearchRunAt: row.freshResearchRunAt ?? null,
          commercialOwnerName:
            commercialOwnerEntity?.company?.name ?? commercialOwnerEntity?.entityName ?? null,
          manufacturerName:
            manufacturerEntity?.company?.name ?? manufacturerEntity?.entityName ?? null,
          recommendedPursuitName:
            recommendedEntity?.company?.name ?? recommendedEntity?.entityName ?? null,
          presenceReason: row.presenceReason ?? null,
          confirmationReason: row.confirmationReason ?? null,
          marketSignalsSummary: row.marketSignalsSummary ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((left, right) => {
        const scoreDelta =
          confirmationRank(right.confirmationStatus) - confirmationRank(left.confirmationStatus) ||
          presenceRank(right.presenceStatus) - presenceRank(left.presenceStatus) ||
          right.needScore - left.needScore ||
          right.rankingScore - left.rankingScore;
        return scoreDelta;
      })
      .slice(0, limit);
  },
});

export const productRankingStats = query({
  args: {},
  handler: async (ctx) => {
    const seedRows = await ctx.db.query("canonicalProductOpportunities").take(250);

    const productRows = seedRows.filter(
      (row) => row.presenceStatus === "weak_absent" || row.presenceStatus === "unknown"
    );

    const confirmedWhitespace = productRows.filter(
      (row) =>
        row.confirmationStatus === "confirmed_absent" ||
        row.confirmationStatus === "absent_in_anchor_markets"
    ).length;

    const reviewBound = productRows.filter(
      (row) =>
        row.confirmationStatus === "candidate" ||
        row.confirmationStatus === "insufficient_official_evidence" ||
        row.confirmationStatus === "ambiguous_match" ||
        row.confirmationStatus === "ambiguous_requires_review"
    ).length;

    const noPartnerFootprint = seedRows.filter((row) => row.presenceStatus === "weak_absent").length;
    const productList: Array<{
      canonicalProductId: Id<"canonicalProducts">;
      rankingScore: number;
      needScore: number;
      confirmationStatus: CanonicalOpportunity["confirmationStatus"];
      presenceStatus: CanonicalOpportunity["presenceStatus"];
    }> = [];

    for (const row of productRows) {
      const marketRows = await ctx.db
        .query("canonicalProductMarketAnalyses")
        .withIndex("by_canonical_product", (q) => q.eq("canonicalProductId", row.canonicalProductId))
        .collect();
      const needScore = marketNeedScore(marketRows);
      productList.push({
        canonicalProductId: row.canonicalProductId,
        rankingScore: deriveProductPriorityScore({
          confirmationStatus: row.confirmationStatus,
          presenceStatus: row.presenceStatus,
          needScore,
          existingRankingScore: row.rankingScore,
        }),
        needScore,
        confirmationStatus: row.confirmationStatus,
        presenceStatus: row.presenceStatus,
      });
    }

    productList.sort((left, right) => right.rankingScore - left.rankingScore);
    const averageScore =
      productList.length > 0
        ? productList.reduce((sum, row) => sum + row.rankingScore, 0) / productList.length
        : 0;

    return {
      totalProductOpportunities: productList.length,
      confirmedWhitespace,
      reviewBound,
      noPartnerFootprint,
      averageScore: Number(averageScore.toFixed(1)),
    };
  },
});

export const runPipeline = action({
  args: {
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    syncReferenceSources: v.optional(v.boolean()),
    includeBfarm: v.optional(v.boolean()),
    searchTerm: v.optional(v.string()),
    limit: v.optional(v.number()),
    refreshMode: v.optional(v.union(v.literal("stored"), v.literal("fresh_external"))),
    targetCountries: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "canonical_gcc_pipeline",
      companyName: args.canonicalProductId ? "single_canonical_product" : "all_canonical_products",
      targetCountries: args.targetCountries ?? ["UAE", ...GCC_PLUS_COUNTRIES.filter((country) => country !== "UAE")],
    });

    const appendLog = async (
      message: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => {
      await ctx.runMutation(api.discoveryJobs.appendLog, { id: jobId, message, level });
    };

    try {
      if (args.syncReferenceSources) {
        await appendLog("Syncing FDA and EMA reference products before pipeline evaluation...");
        await ctx.runAction(api.productIntelligenceActions.syncFdaProducts, {
          searchTerm: args.searchTerm,
          limit: args.limit ?? 25,
        });
        await ctx.runAction(api.productIntelligenceActions.syncEmaCentralProducts, {
          searchTerm: args.searchTerm,
          limit: args.limit ?? 50,
        });
        if (args.includeBfarm) {
          await ctx.runAction(api.productIntelligenceActions.syncBfarmProducts, {
            searchTerm: args.searchTerm,
            limit: args.limit ?? 25,
          });
        }
        await ctx.runAction(api.productIntelligenceActions.rebuildCanonicalProductLinks, {});
      }

      const linkResult = await ctx.runMutation(
        internal.canonicalOpportunities.backfillCanonicalEntityCompanyLinks,
        {}
      );
      if (linkResult.updated > 0) {
        await appendLog(`Linked ${linkResult.updated} canonical entities back to structured company records.`);
      }

      const canonicalProductIds: Id<"canonicalProducts">[] = args.canonicalProductId
        ? [args.canonicalProductId]
        : (await ctx.runQuery(api.productIntelligence.listCanonicalProducts, {
            search: args.searchTerm,
          }))
            .slice(0, args.limit ?? (args.refreshMode === "fresh_external" ? 25 : undefined))
            .map((product) => product._id);

      let ranked = 0;
      let blocked = 0;
      let ambiguous = 0;
      let touched = 0;

      for (const canonicalProductId of canonicalProductIds) {
        let externalResearch: ExternalResearchResult | null = null;
        if (args.refreshMode === "fresh_external") {
          await appendLog(`Running fresh external GCC++ research for ${canonicalProductId}...`);
          const freshResearch: ExternalResearchResult = await ctx.runAction(
            internal.canonicalOpportunityResearch.refreshCanonicalProductResearch,
            {
              canonicalProductId,
              targetCountries: args.targetCountries,
            }
          );
          externalResearch = freshResearch;
          await persistCountryResearchEvidence(ctx, canonicalProductId, freshResearch.countryFindings);
        }

        const state = await buildOpportunityState(ctx, canonicalProductId, externalResearch);
        if (!state) continue;

        if (externalResearch) {
          await refreshLinkedCompanyFromExternalFinding(
            ctx,
            state.commercialOwnerEntity,
            externalResearch.entityFindings.find((finding) => finding.role === "commercial_owner")
          );
          await refreshLinkedCompanyFromExternalFinding(
            ctx,
            state.manufacturerEntity,
            externalResearch.entityFindings.find((finding) => finding.role === "manufacturer")
          );
        }

        const opportunityId = await ctx.runMutation(api.canonicalOpportunities.upsert, {
          canonicalProductId,
          pipelineStatus: state.pipelineStatus,
          confirmationStatus: state.confirmation.confirmationStatus,
          presenceStatus: state.presence.presenceStatus,
          targetCountries: args.targetCountries ?? ["UAE", ...GCC_PLUS_COUNTRIES.filter((country) => country !== "UAE")],
          focusCountry: "UAE",
          uaeAvailabilityStatus: pickUaeRow(state.inputs.marketRows)?.availabilityStatus,
          uaeGenericAvailability: pickUaeRow(state.inputs.marketRows)?.genericAvailability,
          countryResearch: externalResearch?.countryFindings.map((finding) => ({
            country: finding.country,
            tier: finding.tier,
            result: finding.result,
            availabilityStatus: finding.availabilityStatus,
            genericAvailability: finding.genericAvailability,
            confidence: finding.confidence,
            sourceCategory: finding.sourceCategory ?? undefined,
            sourceSystem: finding.sourceSystem ?? undefined,
            sourceTitle: finding.sourceTitle ?? undefined,
            sourceUrl: finding.sourceUrl ?? undefined,
            summary: finding.summary,
            marketedNames: finding.marketedNames,
            checkedAt: Date.now(),
            skippedReason: finding.skippedReason ?? undefined,
          })),
          commercialOwnerEntityId: state.commercialOwnerEntity?._id,
          manufacturerEntityId: state.manufacturerEntity?._id,
          recommendedPursuitEntityId: state.presence.recommendedEntity?._id,
          recommendedPursuitRole: state.presence.recommendedRole,
          recommendedPursuitCompanyId: state.presence.recommendedEntity?.company?._id,
          confirmationReason: state.confirmation.confirmationReason,
          presenceReason: state.presence.presenceReason,
          marketSignalsSummary: state.ranking.marketSignalsSummary,
          rankingScore: state.ranking.rankingScore,
          rankingReason: state.ranking.rankingReason,
          lastPipelineRunAt: Date.now(),
          freshResearchRunAt: externalResearch ? Date.now() : undefined,
        });

        await ctx.runMutation(api.canonicalOpportunities.replaceEvidence, {
          canonicalProductOpportunityId: opportunityId,
          evidence: dedupeEvidence([
            ...state.confirmation.evidence,
            ...state.presence.evidence,
            {
              stage: "ranking",
              title: "Canonical GCC++ opportunity ranking",
              claim: state.ranking.rankingReason,
              sourceType: "internal",
              confidence: "inferred",
            },
          ]),
        });

        touched += 1;
        if (state.pipelineStatus === "ranked") ranked += 1;
        if (
          state.pipelineStatus === "presence_blocked" ||
          state.pipelineStatus === "present_in_gcc" ||
          state.pipelineStatus === "present_in_gcc_anchor"
        ) blocked += 1;
        if (
          state.pipelineStatus === "ambiguous_match" ||
          state.pipelineStatus === "ambiguous_requires_review"
        ) ambiguous += 1;
      }

      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: touched,
        skippedDuplicates: 0,
        summary:
          args.refreshMode === "fresh_external"
            ? `Fresh external GCC++ research refreshed ${touched} products (${ranked} ranked, ${blocked} blocked/present, ${ambiguous} ambiguous).`
            : `Canonical GCC++ pipeline refreshed ${touched} products (${ranked} ranked, ${blocked} blocked/present, ${ambiguous} ambiguous).`,
      });

      return {
        jobId,
        touched,
        ranked,
        blocked,
        ambiguous,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Canonical GCC++ pipeline failed.";
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage: message,
      });
      throw error;
    }
  },
});
