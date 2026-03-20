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
      email: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      confidence: v.union(v.literal("confirmed"), v.literal("likely"), v.literal("inferred")),
      source: v.optional(v.string()),
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
    manufacturerName: v.optional(v.string()),
    primaryManufacturerName: v.optional(v.string()),
    primaryMarketAuthorizationHolderName: v.optional(v.string()),
    name: v.string(),
    genericName: v.string(),
    therapeuticArea: v.string(),
    indication: v.string(),
    mechanism: v.optional(v.string()),
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
    }))),
  })
    .index("by_company", ["companyId"])
    .index("by_therapeutic_area", ["therapeuticArea"]),

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
    .index("by_drug_and_relationship_type", ["drugId", "relationshipType"]),

  opportunities: defineTable({
    drugId: v.id("drugs"),
    country: v.string(),
    competitorPresence: v.optional(v.string()),
    regulatoryStatus: v.optional(v.string()),
    marketSizeEstimate: v.optional(v.string()),
    opportunityScore: v.optional(v.number()),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
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
      v.literal("demand_signals"),
      v.literal("prospect_research"),
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
    sources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))),
    createdAt: v.number(),
    updatedAt: v.number(),
    linkedDrugIds: v.optional(v.array(v.id("drugs"))),
    linkedCompanyIds: v.optional(v.array(v.id("companies"))),
  })
    .index("by_therapeutic_area", ["therapeuticArea"])
    .index("by_gap_score", ["gapScore"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

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
});
