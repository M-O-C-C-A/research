import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const logEntry = v.object({
  timestamp: v.number(),
  message: v.string(),
  level: v.union(
    v.literal("info"),
    v.literal("success"),
    v.literal("warning"),
    v.literal("error")
  ),
});

const menaPartner = v.object({
  name: v.string(),
  role: v.union(
    v.literal("affiliate"),
    v.literal("distributor"),
    v.literal("local_mah_partner"),
    v.literal("licensee"),
    v.literal("co_marketing_partner"),
    v.literal("tender_partner"),
    v.literal("other")
  ),
  geographies: v.array(v.string()),
  exclusivity: v.optional(v.union(
    v.literal("exclusive"),
    v.literal("non_exclusive"),
    v.literal("unknown")
  )),
  confidence: v.union(
    v.literal("confirmed"),
    v.literal("likely"),
    v.literal("inferred")
  ),
  source: v.optional(v.string()),
  url: v.optional(v.string()),
});

const scoreBreakdown = v.object({
  gapValidity: v.number(),
  commercialValue: v.number(),
  urgency: v.number(),
  feasibility: v.number(),
  partnerReachability: v.number(),
  evidenceConfidence: v.number(),
});

const registrationImportStatus = v.union(
  v.literal("uploaded"),
  v.literal("parsed"),
  v.literal("needs_review"),
  v.literal("ready"),
  v.literal("applied"),
  v.literal("failed")
);

const registrationImportMatchStatus = v.union(
  v.literal("matched"),
  v.literal("unmatched"),
  v.literal("ambiguous"),
  v.literal("skipped")
);

const registrationImportApplyState = v.union(
  v.literal("pending"),
  v.literal("applied"),
  v.literal("skipped")
);

const evidenceConfidence = v.union(
  v.literal("confirmed"),
  v.literal("likely"),
  v.literal("inferred")
);

const companyRoleType = v.union(
  v.literal("business_development"),
  v.literal("international_markets"),
  v.literal("regional_commercial"),
  v.literal("regulatory"),
  v.literal("licensing"),
  v.literal("other")
);

const contactSeniority = v.union(
  v.literal("executive"),
  v.literal("director"),
  v.literal("manager"),
  v.literal("individual_contributor"),
  v.literal("unknown")
);

const productSourceRegion = v.union(
  v.literal("eu"),
  v.literal("us"),
  v.literal("mena"),
  v.literal("other")
);

const productSourceSystem = v.union(
  v.literal("drugs_fda"),
  v.literal("openfda_label"),
  v.literal("orange_book"),
  v.literal("purple_book"),
  v.literal("ndc"),
  v.literal("ema_central"),
  v.literal("eu_national_bfarm")
);

const canonicalProductStatus = v.union(
  v.literal("active"),
  v.literal("withdrawn"),
  v.literal("discontinued"),
  v.literal("under_review"),
  v.literal("unavailable")
);

const productApplicationType = v.union(
  v.literal("NDA"),
  v.literal("ANDA"),
  v.literal("BLA"),
  v.literal("CAP"),
  v.literal("national")
);

const canonicalProductType = v.union(
  v.literal("small_molecule"),
  v.literal("biologic"),
  v.literal("biosimilar"),
  v.literal("generic"),
  v.literal("unknown")
);

const canonicalProductLinkRelationship = v.union(
  v.literal("same_product"),
  v.literal("presentation_variant"),
  v.literal("biosimilar_of"),
  v.literal("reference_product"),
  v.literal("regional_variant")
);

const canonicalEntityRole = v.union(
  v.literal("manufacturer"),
  v.literal("mah"),
  v.literal("applicant"),
  v.literal("licensor")
);

const productIdentityEvidenceItem = v.object({
  claim: v.string(),
  sourceKind: v.union(
    v.literal("official_registry"),
    v.literal("regulator"),
    v.literal("company"),
    v.literal("market_report"),
    v.literal("internal")
  ),
  title: v.optional(v.string()),
  url: v.optional(v.string()),
  confidence: evidenceConfidence,
});

const opportunityAvailabilityStatus = v.union(
  v.literal("formally_registered"),
  v.literal("tender_formulary_only"),
  v.literal("shortage_listed"),
  v.literal("hospital_import_only"),
  v.literal("not_found"),
  v.literal("ambiguous"),
  v.literal("unverified")
);

const marketAccessRoute = v.union(
  v.literal("public_tender"),
  v.literal("private_hospital"),
  v.literal("retail_pharmacy"),
  v.literal("specialty_center"),
  v.literal("named_patient")
);

const commercialOpportunityKind = v.union(
  v.literal("commercial_opportunity"),
  v.literal("tender_opportunity"),
  v.literal("commercial_and_tender"),
  v.literal("no_clear_opportunity"),
  v.literal("insufficient_commercial_evidence")
);

const pricingConfidence = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("unknown")
);

const pricePositioning = v.union(
  v.literal("premium"),
  v.literal("parity"),
  v.literal("discount"),
  v.literal("unknown")
);

const competitionIntensity = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("unknown")
);

const commercialEvidenceStatus = v.union(
  v.literal("strong"),
  v.literal("partial"),
  v.literal("proxy_only"),
  v.literal("insufficient")
);

const tenderSignalStrength = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none")
);

const commercialSummaryMode = v.union(
  v.literal("auto"),
  v.literal("manual")
);

const marketModelLevel = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("unknown")
);

const entryStrategyChannel = v.union(
  v.literal("private_hospital"),
  v.literal("retail_pharmacy"),
  v.literal("public_tender"),
  v.literal("specialty_center"),
  v.literal("hybrid"),
  v.literal("unknown")
);

const entryStrategySequencing = v.union(
  v.literal("private_first"),
  v.literal("private_to_tender"),
  v.literal("tender_led"),
  v.literal("hybrid_launch"),
  v.literal("watch")
);

const priceSourceCategory = v.union(
  v.literal("official"),
  v.literal("commercial_database"),
  v.literal("proxy")
);

const priceEvidenceSourceSystem = v.union(
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
);

const priceType = v.union(
  v.literal("registered"),
  v.literal("list"),
  v.literal("tariff"),
  v.literal("reimbursement"),
  v.literal("asp"),
  v.literal("tender"),
  v.literal("retail"),
  v.literal("hospital"),
  v.literal("other")
);

const commercialSignalType = v.union(
  v.literal("tender"),
  v.literal("procurement"),
  v.literal("reimbursement"),
  v.literal("tariff"),
  v.literal("channel"),
  v.literal("competition"),
  v.literal("proxy")
);

const signalStrength = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
);

const marketEvidenceItem = v.object({
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
  confidence: evidenceConfidence,
  sourceSystem: v.optional(priceEvidenceSourceSystem),
  sourceCategory: v.optional(priceSourceCategory),
  observedAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  sourceRecordId: v.optional(v.string()),
});

const productMarketChannelMix = v.object({
  privateShare: v.optional(v.number()),
  tenderShare: v.optional(v.number()),
  hospitalShare: v.optional(v.number()),
});

const productGenericAvailability = v.union(
  v.literal("originator_only"),
  v.literal("originator_plus_generics"),
  v.literal("generic_only"),
  v.literal("not_available"),
  v.literal("unclear")
);

const productMarketEvidenceItem = v.object({
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
  confidence: evidenceConfidence,
  country: v.optional(v.string()),
  sourceSystem: v.optional(priceEvidenceSourceSystem),
  sourceCategory: v.optional(priceSourceCategory),
  observedAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  sourceRecordId: v.optional(v.string()),
});

const countryScoreBreakdown = v.object({
  demand: v.number(),
  competition: v.number(),
  regulatory: v.number(),
  price: v.number(),
  partnerability: v.number(),
});

const outreachReadiness = v.object({
  gapConfirmed: v.boolean(),
  ownershipConfirmed: v.boolean(),
  contactConfirmed: v.boolean(),
  reachableChannelAvailable: v.boolean(),
  readyToSend: v.boolean(),
});

const outreachPackage = v.object({
  shortEmail: v.string(),
  longEmail: v.string(),
  linkedinMessage: v.string(),
  callOpening: v.string(),
  attachmentBrief: v.string(),
});

const companyFootprintStatus = v.union(
  v.literal("clean_whitespace"),
  v.literal("regional_representation_detected"),
  v.literal("portfolio_presence_detected"),
  v.literal("regional_representation_and_portfolio_presence"),
  v.literal("unclear_company_presence")
);

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    country: v.string(),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    therapeuticAreas: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // BD qualification fields
    bdStatus: v.optional(v.union(
      v.literal("screened"),
      v.literal("qualified"),
      v.literal("prospect"),
      v.literal("contacted"),
      v.literal("intro_call"),
      v.literal("data_shared"),
      v.literal("partner_discussion"),
      v.literal("engaged"),
      v.literal("negotiating"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("contracted"),
      v.literal("disqualified"),
    )),
    bdScore: v.optional(v.number()),
    bdScoreRationale: v.optional(v.string()),
    companySize: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaPresence: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    revenueEstimate: v.optional(v.string()),
    employeeCount: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    bdNotes: v.optional(v.string()),
    bdScoredAt: v.optional(v.number()),
    bdEvidenceItems: v.optional(v.array(v.object({
      claim: v.string(),
      source: v.string(),
      url: v.optional(v.string()),
    }))),
    keyContacts: v.optional(v.array(v.object({
      name: v.string(),
      title: v.string(),
      roleType: v.optional(companyRoleType),
      seniority: v.optional(contactSeniority),
      geographies: v.optional(v.array(v.string())),
      email: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      confidence: evidenceConfidence,
      source: v.optional(v.string()),
      lastVerifiedAt: v.optional(v.number()),
    }))),
    researchedAt: v.optional(v.number()),
    linkedinCompanyUrl: v.optional(v.string()),
    distributorFitScore: v.optional(v.number()),
    distributorFitRationale: v.optional(v.string()),
    targetSegment: v.optional(v.union(
      v.literal("sme"),
      v.literal("mid"),
      v.literal("large"),
    )),
    menaChannelStatus: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("established"),
    )),
    exportReadiness: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    )),
    dealModelFit: v.optional(v.union(v.literal("distributor"))),
    priorityTier: v.optional(v.union(
      v.literal("tier_1"),
      v.literal("tier_2"),
      v.literal("tier_3"),
      v.literal("deprioritized"),
    )),
    partnerabilitySignals: v.optional(v.array(v.string())),
    disqualifierReasons: v.optional(v.array(v.string())),
    ownershipType: v.optional(v.string()),
    exportMarketsKnown: v.optional(v.array(v.string())),
    partneringHistory: v.optional(v.string()),
    manufacturingFootprint: v.optional(v.string()),
    primaryCommercialModel: v.optional(v.string()),
    entityRoles: v.optional(v.array(v.union(
      v.literal("manufacturer"),
      v.literal("market_authorization_holder"),
      v.literal("licensor"),
      v.literal("regional_partner"),
      v.literal("distributor")
    ))),
    commercialControlLevel: v.optional(v.union(
      v.literal("full"),
      v.literal("shared"),
      v.literal("limited"),
      v.literal("unknown")
    )),
    existingMenaPartners: v.optional(v.array(menaPartner)),
    menaPartnershipStrength: v.optional(v.union(
      v.literal("none"),
      v.literal("limited"),
      v.literal("moderate"),
      v.literal("entrenched")
    )),
    approachTargetRecommendation: v.optional(v.union(
      v.literal("approach"),
      v.literal("watch"),
      v.literal("deprioritize")
    )),
    approachTargetReason: v.optional(v.string()),
    notApproachableReason: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_country", ["country"])
    .index("by_status", ["status"])
    .index("by_bd_status", ["bdStatus"])
    .index("by_bd_score", ["bdScore"]),

  drugs: defineTable({
    companyId: v.optional(v.id("companies")),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    manufacturerName: v.optional(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMarketAuthorizationHolderName: v.optional(v.string()),
    name: v.string(),
    genericName: v.string(),
    therapeuticArea: v.string(),
    indication: v.string(),
    mechanism: v.optional(v.string()),
    productProfile: v.optional(v.object({
      strength: v.optional(v.string()),
      dosageForm: v.optional(v.string()),
      route: v.optional(v.string()),
      productFamily: v.optional(v.string()),
      canonicalKey: v.optional(v.string()),
      sourceRegions: v.optional(v.array(productSourceRegion)),
      ownershipConfidence: v.optional(v.union(
        v.literal("confirmed"),
        v.literal("likely"),
        v.literal("uncertain")
      )),
    })),
    identityEvidenceItems: v.optional(v.array(productIdentityEvidenceItem)),
    approvalStatus: v.union(
      v.literal("approved"),
      v.literal("pending"),
      v.literal("withdrawn")
    ),
    approvalDate: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // Patent & MENA registration intelligence
    patentExpiryYear: v.optional(v.number()),
    patentExpirySource: v.optional(v.string()),
    emaApprovalDate: v.optional(v.string()),
    menaRegistrationCount: v.optional(v.number()),
    patentUrgencyScore: v.optional(v.number()),
    menaRegistrations: v.optional(v.array(v.object({
      country: v.string(),
      status: v.union(v.literal("registered"), v.literal("not_found"), v.literal("unverified")),
      registrationNumber: v.optional(v.string()),
      source: v.string(),
      url: v.optional(v.string()),
      verifiedAt: v.number(),
      sourceSystem: v.optional(priceEvidenceSourceSystem),
      sourceTitle: v.optional(v.string()),
      sourceRecordId: v.optional(v.string()),
      observedAt: v.optional(v.number()),
      strength: v.optional(v.string()),
      form: v.optional(v.string()),
      packSize: v.optional(v.string()),
      notes: v.optional(v.string()),
    }))),
  })
    .index("by_company", ["companyId"])
    .index("by_therapeutic_area", ["therapeuticArea"])
    .index("by_canonical_product", ["canonicalProductId"]),

  productSources: defineTable({
    sourceSystem: productSourceSystem,
    sourceRecordId: v.string(),
    sourceUrl: v.optional(v.string()),
    sourceStatus: canonicalProductStatus,
    geography: v.string(),
    sourceUpdatedAt: v.optional(v.number()),
    sourceSnapshot: v.optional(v.string()),
    brandName: v.optional(v.string()),
    inn: v.optional(v.string()),
    activeIngredient: v.optional(v.string()),
    strength: v.optional(v.string()),
    dosageForm: v.optional(v.string()),
    route: v.optional(v.string()),
    atcCode: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    applicationType: v.optional(productApplicationType),
    applicantName: v.optional(v.string()),
    mahName: v.optional(v.string()),
    manufacturerName: v.optional(v.string()),
    approvalDate: v.optional(v.string()),
    productType: v.optional(canonicalProductType),
    referenceProductSourceRecordId: v.optional(v.string()),
    patentsSummary: v.optional(v.string()),
    exclusivitiesSummary: v.optional(v.string()),
    packageSummary: v.optional(v.string()),
    interchangeability: v.optional(v.string()),
    rawSourceUpdatedLabel: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source_system_and_source_record_id", ["sourceSystem", "sourceRecordId"])
    .index("by_geography", ["geography"])
    .index("by_brand_name", ["brandName"])
    .index("by_inn", ["inn"]),

  canonicalProducts: defineTable({
    canonicalKey: v.string(),
    normalizedBrandName: v.optional(v.string()),
    normalizedInn: v.optional(v.string()),
    brandName: v.string(),
    inn: v.string(),
    activeIngredient: v.optional(v.string()),
    strength: v.optional(v.string()),
    dosageForm: v.optional(v.string()),
    route: v.optional(v.string()),
    atcCode: v.optional(v.string()),
    therapeuticArea: v.optional(v.string()),
    applicationTypes: v.optional(v.array(productApplicationType)),
    applicationTypeSummary: v.optional(v.string()),
    status: canonicalProductStatus,
    productType: canonicalProductType,
    geographies: v.array(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMahName: v.optional(v.string()),
    primaryApplicantName: v.optional(v.string()),
    approvalDate: v.optional(v.string()),
    sourceSystems: v.array(productSourceSystem),
    matchConfidence: evidenceConfidence,
    reviewNeeded: v.optional(v.boolean()),
    referenceCanonicalProductId: v.optional(v.id("canonicalProducts")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canonical_key", ["canonicalKey"])
    .index("by_brand_name", ["brandName"])
    .index("by_inn", ["inn"])
    .index("by_status", ["status"]),

  canonicalProductLinks: defineTable({
    canonicalProductId: v.id("canonicalProducts"),
    productSourceId: v.id("productSources"),
    relationshipType: canonicalProductLinkRelationship,
    confidence: evidenceConfidence,
    reviewNeeded: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canonical_product", ["canonicalProductId"])
    .index("by_product_source", ["productSourceId"])
    .index("by_canonical_product_and_product_source", ["canonicalProductId", "productSourceId"]),

  canonicalProductEntities: defineTable({
    canonicalProductId: v.id("canonicalProducts"),
    companyId: v.optional(v.id("companies")),
    entityName: v.string(),
    normalizedEntityName: v.string(),
    role: canonicalEntityRole,
    isPrimary: v.boolean(),
    geography: v.optional(v.string()),
    sourceSystem: productSourceSystem,
    confidence: evidenceConfidence,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canonical_product", ["canonicalProductId"])
    .index("by_company", ["companyId"])
    .index("by_canonical_product_and_role", ["canonicalProductId", "role"]),

  drugEntityLinks: defineTable({
    drugId: v.id("drugs"),
    companyId: v.optional(v.id("companies")),
    entityName: v.optional(v.string()),
    relationshipType: v.union(
      v.literal("manufacturer"),
      v.literal("market_authorization_holder"),
      v.literal("licensor"),
      v.literal("regional_partner"),
      v.literal("distributor")
    ),
    jurisdiction: v.optional(v.string()),
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
    source: v.optional(v.string()),
    url: v.optional(v.string()),
    confidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("inferred")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_drug", ["drugId"])
    .index("by_company", ["companyId"])
    .index("by_drug_and_relationship_type", ["drugId", "relationshipType"])
    .index("by_company_and_relationship_type", ["companyId", "relationshipType"]),

  opportunities: defineTable({
    drugId: v.id("drugs"),
    country: v.string(),
    competitorPresence: v.optional(v.string()),
    regulatoryStatus: v.optional(v.string()),
    marketSizeEstimate: v.optional(v.string()),
    availabilityStatus: v.optional(opportunityAvailabilityStatus),
    matchedBrandName: v.optional(v.string()),
    matchedGenericName: v.optional(v.string()),
    genericEquivalentDetected: v.optional(v.boolean()),
    addressablePopulation: v.optional(v.string()),
    treatmentVolumeProxy: v.optional(v.string()),
    priceCorridor: v.optional(v.string()),
    primaryPriceBenchmark: v.optional(v.string()),
    pricingConfidence: v.optional(pricingConfidence),
    pricePositioning: v.optional(pricePositioning),
    competitionIntensity: v.optional(competitionIntensity),
    competitivePriceSummary: v.optional(v.string()),
    euReferenceAnchor: v.optional(v.string()),
    gccRegisteredAnchor: v.optional(v.string()),
    tenderBenchmarkAnchor: v.optional(v.string()),
    priceCorridorBand: v.optional(v.string()),
    recommendedPricingBand: v.optional(v.string()),
    priceReferencingRisk: v.optional(marketModelLevel),
    tenderOpportunity: v.optional(v.boolean()),
    tenderSignalStrength: v.optional(tenderSignalStrength),
    commercialEvidenceStatus: v.optional(commercialEvidenceStatus),
    opportunityKind: v.optional(commercialOpportunityKind),
    commercialOpportunityScore: v.optional(v.number()),
    commercialSummaryMode: v.optional(commercialSummaryMode),
    annualOpportunityRange: v.optional(v.string()),
    publicChannelShare: v.optional(v.number()),
    privateChannelShare: v.optional(v.number()),
    estimatedCustomers: v.optional(v.number()),
    accessibleShare: v.optional(v.number()),
    physicianAdoptionRate: v.optional(v.number()),
    accessibleVolumeEstimate: v.optional(v.string()),
    baseVolumeCase: v.optional(v.string()),
    conservativeVolumeCase: v.optional(v.string()),
    upsideVolumeCase: v.optional(v.string()),
    publicPrivateMixSummary: v.optional(v.string()),
    physicianAdoptionSummary: v.optional(v.string()),
    reimbursementConstraintLevel: v.optional(marketModelLevel),
    tenderBarrierLevel: v.optional(marketModelLevel),
    commercialViabilityFlag: v.optional(v.boolean()),
    entryStrategyRecommendation: v.optional(v.string()),
    entryStrategyChannel: v.optional(entryStrategyChannel),
    entryStrategySequencing: v.optional(entryStrategySequencing),
    countryScoreBreakdown: v.optional(countryScoreBreakdown),
    marketAccessRoute: v.optional(marketAccessRoute),
    marketAccessNotes: v.optional(v.string()),
    regulatoryTimeline: v.optional(v.string()),
    regulatoryRequirements: v.optional(v.array(v.string())),
    evidenceItems: v.optional(v.array(marketEvidenceItem)),
    opportunityScore: v.optional(v.number()),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_drug", ["drugId"])
    .index("by_country", ["country"])
    .index("by_drug_and_country", ["drugId", "country"]),

  canonicalProductMarketAnalyses: defineTable({
    canonicalProductId: v.id("canonicalProducts"),
    country: v.string(),
    availabilityStatus: opportunityAvailabilityStatus,
    marketedNames: v.array(v.string()),
    matchedBrandName: v.optional(v.string()),
    matchedGenericName: v.optional(v.string()),
    genericAvailability: productGenericAvailability,
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
    channelMix: v.optional(productMarketChannelMix),
    channelSummary: v.optional(v.string()),
    tenderVsPrivateSummary: v.optional(v.string()),
    payerMixSummary: v.optional(v.string()),
    publicChannelShare: v.optional(v.number()),
    privateChannelShare: v.optional(v.number()),
    hospitalChannelShare: v.optional(v.number()),
    tenderOpportunity: v.optional(v.boolean()),
    tenderSignalStrength: v.optional(tenderSignalStrength),
    marketAccessRoute: v.optional(marketAccessRoute),
    opportunityKind: v.optional(commercialOpportunityKind),
    commercialOpportunityScore: v.optional(v.number()),
    annualOpportunityRange: v.optional(v.string()),
    priorityScore: v.optional(v.number()),
    priorityReason: v.optional(v.string()),
    availabilityNarrative: v.optional(v.string()),
    competitionSummary: v.optional(v.string()),
    marketAccessNotes: v.optional(v.string()),
    insuredShare: v.optional(v.number()),
    outOfPocketShare: v.optional(v.number()),
    evidenceConfidence: evidenceConfidence,
    evidenceItems: v.array(productMarketEvidenceItem),
    lastAnalyzedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canonical_product", ["canonicalProductId"])
    .index("by_canonical_product_and_country", ["canonicalProductId", "country"])
    .index("by_country", ["country"]),

  priceEvidence: defineTable({
    drugId: v.id("drugs"),
    country: v.string(),
    sourceCategory: priceSourceCategory,
    sourceSystem: priceEvidenceSourceSystem,
    priceType,
    amount: v.number(),
    currency: v.string(),
    presentation: v.optional(v.string()),
    unitBasis: v.optional(v.string()),
    observedAt: v.number(),
    sourceTitle: v.string(),
    sourceUrl: v.optional(v.string()),
    sourceRecordId: v.optional(v.string()),
    confidence: evidenceConfidence,
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_drug", ["drugId"])
    .index("by_drug_and_country", ["drugId", "country"])
    .index("by_source_system", ["sourceSystem"])
    .index("by_drug_country_and_observed_at", ["drugId", "country", "observedAt"]),

  commercialSignals: defineTable({
    drugId: v.id("drugs"),
    country: v.string(),
    signalType: commercialSignalType,
    sourceCategory: priceSourceCategory,
    sourceSystem: priceEvidenceSourceSystem,
    summary: v.string(),
    signalStrength,
    sourceTitle: v.string(),
    sourceUrl: v.optional(v.string()),
    observedAt: v.number(),
    confidence: evidenceConfidence,
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_drug", ["drugId"])
    .index("by_drug_and_country", ["drugId", "country"])
    .index("by_signal_type", ["signalType"])
    .index("by_source_system", ["sourceSystem"]),

  marketWebsiteEvidence: defineTable({
    drugId: v.optional(v.id("drugs")),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    country: v.string(),
    claim: v.string(),
    title: v.string(),
    url: v.string(),
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
    sourceSystem: priceEvidenceSourceSystem,
    sourceCategory: priceSourceCategory,
    confidence: evidenceConfidence,
    observedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_drug_and_country", ["drugId", "country"])
    .index("by_canonical_product_and_country", ["canonicalProductId", "country"])
    .index("by_country", ["country"]),

  marketSimulations: defineTable({
    drugId: v.id("drugs"),
    country: v.string(),
    exFactoryPrice: v.optional(v.number()),
    targetSellingPrice: v.optional(v.number()),
    targetSellingCurrency: v.optional(v.string()),
    distributorMarginPct: v.optional(v.number()),
    logisticsCostPerUnit: v.optional(v.number()),
    regulatoryCostTotal: v.optional(v.number()),
    tenderCostTotal: v.optional(v.number()),
    publicShare: v.optional(v.number()),
    privateShare: v.optional(v.number()),
    adoptionRate: v.optional(v.number()),
    accessiblePopulation: v.optional(v.number()),
    unitsPerCustomer: v.optional(v.number()),
    conservativeRevenue: v.optional(v.number()),
    baseRevenue: v.optional(v.number()),
    upsideRevenue: v.optional(v.number()),
    conservativeGrossMarginPct: v.optional(v.number()),
    baseGrossMarginPct: v.optional(v.number()),
    upsideGrossMarginPct: v.optional(v.number()),
    unitEconomicsSummary: v.optional(v.string()),
    viabilitySummary: v.optional(v.string()),
    recommendedChannel: v.optional(entryStrategyChannel),
    recommendedPricingBand: v.optional(v.string()),
    recommendedSequencing: v.optional(entryStrategySequencing),
    recommendationRationale: v.optional(v.string()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_drug", ["drugId"])
    .index("by_country", ["country"])
    .index("by_drug_and_country", ["drugId", "country"]),

  reports: defineTable({
    drugId: v.id("drugs"),
    content: v.optional(v.string()),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
    updatedAt: v.number(),
    sources: v.optional(
      v.array(v.object({ title: v.string(), url: v.string() }))
    ),
  }).index("by_drug", ["drugId"]),

  researchInputs: defineTable({
    drugId: v.id("drugs"),
    title: v.string(),
    sourceType: v.union(
      v.literal("pdf"),
      v.literal("image"),
      v.literal("text")
    ),
    content: v.string(),
    seedTerms: v.array(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_drug", ["drugId"]),

  discoveryJobs: defineTable({
    // "companies" = find new European pharma companies
    // "drugs" = find drugs for a specific company
    // "bd_scoring" = score a company for BD suitability
    // "gap_analysis" = analyze MENA supply/demand gaps
    // "demand_signals" = discover MENA procurement signals
    type: v.union(
      v.literal("companies"),
      v.literal("drugs"),
      v.literal("bd_scoring"),
      v.literal("gap_analysis"),
      v.literal("gap_analysis_flow"),
      v.literal("demand_signals"),
      v.literal("prospect_research"),
      v.literal("gap_evidence_enrichment"),
      v.literal("product_sync_fda"),
      v.literal("product_sync_ema"),
      v.literal("product_sync_bfarm"),
      v.literal("canonical_product_linking"),
      v.literal("canonical_gcc_pipeline"),
    ),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("error")
    ),
    // For drug-discovery jobs — which company was scanned
    companyId: v.optional(v.id("companies")),
    companyName: v.optional(v.string()),
    // For gap analysis jobs
    gapOpportunityId: v.optional(v.id("gapOpportunities")),
    therapeuticArea: v.optional(v.string()),
    targetCountries: v.optional(v.array(v.string())),
    // Results summary
    newItemsFound: v.optional(v.number()),
    skippedDuplicates: v.optional(v.number()),
    summary: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    warnings: v.optional(v.number()),
    requestIds: v.optional(v.array(v.string())),
    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Live log — appended throughout the run
    log: v.array(logEntry),
  })
    .index("by_started", ["startedAt"])
    .index("by_company", ["companyId"])
    .index("by_type", ["type"]),

  bdActivities: defineTable({
    companyId: v.id("companies"),
    type: v.union(
      v.literal("note"),
      v.literal("email_sent"),
      v.literal("email_received"),
      v.literal("call"),
      v.literal("meeting"),
      v.literal("stage_change"),
      v.literal("deal_update"),
      v.literal("outreach_update"),
      v.literal("regulatory_follow_up"),
    ),
    content: v.string(),
    previousStage: v.optional(v.string()),
    newStage: v.optional(v.string()),
    dealValue: v.optional(v.number()),
    outreachAngle: v.optional(v.string()),
    countryInterest: v.optional(v.array(v.string())),
    documentsRequested: v.optional(v.array(v.string())),
    exclusivityInterest: v.optional(v.string()),
    regulatoryFollowUp: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_created", ["createdAt"]),

  gapOpportunities: defineTable({
    therapeuticArea: v.string(),
    indication: v.string(),
    targetCountries: v.array(v.string()),
    gapScore: v.number(),
    analysisLens: v.optional(v.union(
      v.literal("demand_led"),
      v.literal("product_led"),
      v.literal("mixed"),
    )),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    gapType: v.optional(v.union(
      v.literal("regulatory_gap"),
      v.literal("formulary_gap"),
      v.literal("shortage_gap"),
      v.literal("tender_pull"),
      v.literal("channel_whitespace"),
    )),
    productGapKind: v.optional(v.union(
      v.literal("fda_absent_mena"),
      v.literal("ema_absent_mena"),
      v.literal("fda_ema_absent_mena"),
      v.literal("different_brand_present"),
      v.literal("generic_present"),
      v.literal("off_patent"),
      v.literal("near_patent_expiry"),
      v.literal("biosimilar_opportunity"),
      v.literal("reference_biologic_opportunity"),
      v.literal("unclear_presence"),
    )),
    validationStatus: v.optional(v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("insufficient_evidence"),
    )),
    evidenceSummary: v.optional(v.string()),
    verifiedRegisteredCount: v.optional(v.number()),
    verifiedMissingCount: v.optional(v.number()),
    companyFootprintStatus: v.optional(companyFootprintStatus),
    companyFootprintReason: v.optional(v.string()),
    companyFootprintCountries: v.optional(v.array(v.string())),
    companyConfirmedPortfolioCountries: v.optional(v.array(v.string())),
    companyPortfolioPresenceCount: v.optional(v.number()),
    demandEvidence: v.string(),
    supplyGap: v.string(),
    competitorLandscape: v.string(),
    suggestedDrugClasses: v.array(v.string()),
    tenderSignals: v.optional(v.string()),
    whoDiseaseBurden: v.optional(v.string()),
    regulatoryFeasibility: v.optional(v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    )),
    status: v.union(v.literal("active"), v.literal("archived")),
    dedupeKey: v.optional(v.string()),
    sources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))),
    evidenceItems: v.optional(v.array(v.object({
      claim: v.string(),
      title: v.string(),
      url: v.string(),
      sourceKind: v.union(
        v.literal("official_registry"),
        v.literal("ema"),
        v.literal("government_publication"),
        v.literal("tender_portal"),
        v.literal("who_or_gbd"),
        v.literal("market_report"),
        v.literal("pubmed"),
        v.literal("clinical_trial"),
      ),
      country: v.optional(v.string()),
      productOrClass: v.optional(v.string()),
      confidence: v.union(
        v.literal("confirmed"),
        v.literal("likely"),
        v.literal("inferred")
      ),
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastEnrichedAt: v.optional(v.number()),
    linkedDrugIds: v.optional(v.array(v.id("drugs"))),
    linkedCompanyIds: v.optional(v.array(v.id("companies"))),
  })
    .index("by_therapeutic_area", ["therapeuticArea"])
    .index("by_gap_score", ["gapScore"])
    .index("by_status", ["status"])
    .index("by_analysis_lens", ["analysisLens"])
    .index("by_canonical_product", ["canonicalProductId"])
    .index("by_created", ["createdAt"])
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_status_and_dedupe_key", ["status", "dedupeKey"]),

  gapCompanyMatches: defineTable({
    gapOpportunityId: v.id("gapOpportunities"),
    companyId: v.id("companies"),
    distributorFitScore: v.number(),
    rationale: v.string(),
    overlapSummary: v.optional(v.string()),
    overlappingDrugClasses: v.optional(v.array(v.string())),
    targetCountries: v.array(v.string()),
    estimatedEaseOfEntry: v.optional(v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    )),
    competitiveWhitespace: v.optional(v.string()),
    companyFootprintStatus: v.optional(companyFootprintStatus),
    companyFootprintReason: v.optional(v.string()),
    companyFootprintCountries: v.optional(v.array(v.string())),
    companyConfirmedPortfolioCountries: v.optional(v.array(v.string())),
    companyPortfolioPresenceCount: v.optional(v.number()),
    recommendedFirstOutreachAngle: v.optional(v.string()),
    confidence: v.optional(v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    )),
    evidenceLinks: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
    }))),
    priorityTier: v.optional(v.union(
      v.literal("tier_1"),
      v.literal("tier_2"),
      v.literal("tier_3"),
      v.literal("deprioritized"),
    )),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_gap_opportunity", ["gapOpportunityId"])
    .index("by_company", ["companyId"])
    .index("by_gap_opportunity_and_company", ["gapOpportunityId", "companyId"])
    .index("by_distributor_fit_score", ["distributorFitScore"]),

  productIdentityAliases: defineTable({
    drugId: v.id("drugs"),
    companyId: v.optional(v.id("companies")),
    alias: v.string(),
    normalizedAlias: v.string(),
    aliasType: v.union(
      v.literal("brand"),
      v.literal("generic"),
      v.literal("inn"),
      v.literal("manufacturer"),
      v.literal("market_authorization_holder"),
      v.literal("other")
    ),
    confidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("uncertain")
    ),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_drug", ["drugId"])
    .index("by_normalized_alias", ["normalizedAlias"])
    .index("by_drug_and_normalized_alias", ["drugId", "normalizedAlias"]),

  decisionOpportunities: defineTable({
    drugId: v.id("drugs"),
    companyId: v.optional(v.id("companies")),
    gapOpportunityId: v.optional(v.id("gapOpportunities")),
    gapCompanyMatchId: v.optional(v.id("gapCompanyMatches")),
    title: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("needs_validation")
    ),
    therapeuticArea: v.string(),
    productName: v.string(),
    genericName: v.string(),
    manufacturerName: v.optional(v.string()),
    marketAuthorizationHolderName: v.optional(v.string()),
    approachEntityName: v.string(),
    approachEntityRole: v.union(
      v.literal("manufacturer"),
      v.literal("market_authorization_holder"),
      v.literal("licensor"),
      v.literal("regional_partner"),
      v.literal("distributor"),
      v.literal("unknown")
    ),
    focusMarkets: v.array(v.string()),
    secondaryMarkets: v.optional(v.array(v.string())),
    blockedFocusMarkets: v.optional(v.array(v.string())),
    gapType: v.union(
      v.literal("formulary_gap"),
      v.literal("regulatory_gap"),
      v.literal("shortage_gap"),
      v.literal("tender_pull"),
      v.literal("channel_whitespace"),
      v.literal("mixed")
    ),
    productIdentityStatus: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("uncertain")
    ),
    gapSummary: v.string(),
    commercialRationale: v.string(),
    marketAttractiveness: v.string(),
    marketSizeEstimate: v.optional(v.string()),
    demandProxy: v.string(),
    companyFootprintStatus: v.optional(companyFootprintStatus),
    companyFootprintReason: v.optional(v.string()),
    companyFootprintCountries: v.optional(v.array(v.string())),
    companyConfirmedPortfolioCountries: v.optional(v.array(v.string())),
    companyPortfolioPresenceCount: v.optional(v.number()),
    competitivePressure: v.string(),
    regulatoryFeasibility: v.union(
      v.literal("easy"),
      v.literal("moderate"),
      v.literal("complex"),
      v.literal("unknown")
    ),
    timelineRange: v.string(),
    keyConstraint: v.string(),
    entryStrategy: v.union(
      v.literal("distributor"),
      v.literal("licensing"),
      v.literal("direct"),
      v.literal("watch")
    ),
    entryStrategyRationale: v.string(),
    whyThisMarket: v.string(),
    whyNow: v.string(),
    whyThisPartner: v.string(),
    targetRole: v.string(),
    companyWebsite: v.optional(v.string()),
    companyLinkedinUrl: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactLinkedinUrl: v.optional(v.string()),
    contactConfidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("inferred"),
      v.literal("none")
    ),
    outreachReadiness: v.optional(outreachReadiness),
    outreachBlockers: v.optional(v.array(v.string())),
    outreachSubject: v.string(),
    outreachDraft: v.string(),
    outreachPackage: v.optional(outreachPackage),
    confidenceLevel: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),
    confidenceSummary: v.string(),
    assumptions: v.array(v.string()),
    sourceCount: v.number(),
    priorityScore: v.number(),
    rankingPosition: v.optional(v.number()),
    scoreBreakdown,
    scoreExplanation: v.string(),
    whyThisMarketExplanation: v.string(),
    whyNowExplanation: v.string(),
    howToEnterExplanation: v.string(),
    whyThisPartnerExplanation: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastPromotedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_priority_score", ["priorityScore"])
    .index("by_status_and_priority_score", ["status", "priorityScore"])
    .index("by_drug", ["drugId"])
    .index("by_company", ["companyId"])
    .index("by_gap_opportunity", ["gapOpportunityId"])
    .index("by_drug_and_company", ["drugId", "companyId"])
    .index("by_drug_and_gap_opportunity", ["drugId", "gapOpportunityId"]),

  opportunityEvidence: defineTable({
    decisionOpportunityId: v.id("decisionOpportunities"),
    title: v.string(),
    url: v.string(),
    claim: v.string(),
    evidenceType: v.union(
      v.literal("regulatory"),
      v.literal("market"),
      v.literal("gap"),
      v.literal("company"),
      v.literal("contact"),
      v.literal("internal")
    ),
    confidence: v.union(
      v.literal("confirmed"),
      v.literal("likely"),
      v.literal("inferred")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_decision_opportunity", ["decisionOpportunityId"])
    .index("by_decision_opportunity_and_evidence_type", ["decisionOpportunityId", "evidenceType"]),

  registrationImports: defineTable({
    fileName: v.string(),
    storageId: v.id("_storage"),
    sourceMarket: v.optional(v.string()),
    sourceType: v.optional(v.string()),
    status: registrationImportStatus,
    sheetNames: v.array(v.string()),
    totalRows: v.number(),
    matchedRows: v.number(),
    unresolvedRows: v.number(),
    ambiguousRows: v.number(),
    skippedRows: v.number(),
    appliedRows: v.number(),
    parseErrorCount: v.number(),
    lastError: v.optional(v.string()),
    parsedAt: v.optional(v.number()),
    applyRequestedAt: v.optional(v.number()),
    appliedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_status", ["status"]),

  registrationImportRows: defineTable({
    importId: v.id("registrationImports"),
    source: v.optional(v.string()),
    sourceRecordId: v.optional(v.string()),
    productName: v.string(),
    genericName: v.optional(v.string()),
    manufacturerName: v.optional(v.string()),
    mahName: v.optional(v.string()),
    supplierName: v.optional(v.string()),
    supplierAddress: v.optional(v.string()),
    country: v.string(),
    registrationStatus: v.union(
      v.literal("registered"),
      v.literal("not_found"),
      v.literal("unverified")
    ),
    sourceStatus: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    approvalDate: v.optional(v.string()),
    strength: v.optional(v.string()),
    form: v.optional(v.string()),
    packSize: v.optional(v.string()),
    priceAed: v.optional(v.string()),
    classification: v.optional(v.string()),
    dispensingMode: v.optional(v.string()),
    countryOfOrigin: v.optional(v.string()),
    bodySystem: v.optional(v.string()),
    therapeuticGroup: v.optional(v.string()),
    productKind: v.optional(v.union(v.literal("medicine"), v.literal("device"))),
    matchExplanation: v.optional(v.string()),
    sourceNote: v.optional(v.string()),
    sourceSheet: v.string(),
    sourceRowNumber: v.number(),
    matchStatus: registrationImportMatchStatus,
    applyState: registrationImportApplyState,
    matchedDrugId: v.optional(v.id("drugs")),
    matchedCompanyId: v.optional(v.id("companies")),
    validationIssues: v.array(v.string()),
    rawRow: v.record(v.string(), v.string()),
    appliedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_import", ["importId"])
    .index("by_import_and_match_status", ["importId", "matchStatus"])
    .index("by_import_and_apply_state", ["importId", "applyState"])
    .index("by_import_and_match_status_and_apply_state", [
      "importId",
      "matchStatus",
      "applyState",
    ])
    .index("by_import_and_source_sheet", ["importId", "sourceSheet"])
    .index("by_import_and_source_record_id", ["importId", "sourceRecordId"]),
});
