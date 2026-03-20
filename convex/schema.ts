import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    country: v.string(),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    therapeuticAreas: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_name", ["name"])
    .index("by_country", ["country"])
    .index("by_status", ["status"]),

  drugs: defineTable({
    // companyId is optional — drugs can be added standalone without a registered company
    companyId: v.optional(v.id("companies")),
    manufacturerName: v.optional(v.string()), // used when no company is registered
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
  })
    .index("by_company", ["companyId"])
    .index("by_therapeutic_area", ["therapeuticArea"]),

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
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
        })
      )
    ),
  }).index("by_drug", ["drugId"]),
});
