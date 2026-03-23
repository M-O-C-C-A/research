import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  buildGapDedupeKey,
  mergeMultilineText,
  mergeUniqueStrings,
} from "./gapIdentity";
import { normalizeDrugEntityLinks } from "./drugEntityLinkUtils";

function mergeSources(
  existing?: Array<{ title: string; url: string }>,
  incoming?: Array<{ title: string; url: string }>
) {
  return [
    ...new Map([...(existing ?? []), ...(incoming ?? [])].map((item) => [item.url, item])).values(),
  ];
}

export const repairData = mutation({
  args: {},
  handler: async (ctx) => {
    const [drugs, existingLinks, gaps, gapMatches, opportunities] = await Promise.all([
      ctx.db.query("drugs").collect(),
      ctx.db.query("drugEntityLinks").collect(),
      ctx.db.query("gapOpportunities").collect(),
      ctx.db.query("gapCompanyMatches").collect(),
      ctx.db.query("decisionOpportunities").collect(),
    ]);

    let drugsNormalized = 0;
    let gapsMerged = 0;

    const linksByDrugId = new Map<Id<"drugs">, typeof existingLinks>();
    for (const link of existingLinks) {
      const current = linksByDrugId.get(link.drugId) ?? [];
      current.push(link);
      linksByDrugId.set(link.drugId, current);
    }

    for (const drug of drugs) {
      const normalizedLinks = normalizeDrugEntityLinks([
        ...(linksByDrugId.get(drug._id) ?? []).map((link) => ({
          companyId: link.companyId,
          entityName: link.entityName,
          relationshipType: link.relationshipType,
          jurisdiction: link.jurisdiction,
          isPrimary: link.isPrimary,
          notes: link.notes,
          source: link.source,
          url: link.url,
          confidence: link.confidence,
        })),
        ...(drug.companyId
          ? [
              {
                companyId: drug.companyId,
                relationshipType: "manufacturer" as const,
                isPrimary: true,
                confidence: "confirmed" as const,
              },
            ]
          : []),
        ...(drug.primaryManufacturerName && !drug.companyId
          ? [
              {
                entityName: drug.primaryManufacturerName,
                relationshipType: "manufacturer" as const,
                isPrimary: true,
                confidence: "likely" as const,
              },
            ]
          : []),
        ...(drug.primaryMarketAuthorizationHolderName
          ? [
              {
                entityName: drug.primaryMarketAuthorizationHolderName,
                relationshipType: "market_authorization_holder" as const,
                isPrimary: true,
                confidence: "likely" as const,
              },
            ]
          : []),
        ...(drug.manufacturerName && !drug.primaryManufacturerName && !drug.companyId
          ? [
              {
                entityName: drug.manufacturerName,
                relationshipType: "manufacturer" as const,
                isPrimary: true,
                confidence: "inferred" as const,
              },
            ]
          : []),
      ]);

      const existingCount = linksByDrugId.get(drug._id)?.length ?? 0;
      if (normalizedLinks.length > 0 && normalizedLinks.length !== existingCount) {
        await ctx.runMutation(api.drugEntityLinks.replaceForDrug, {
          drugId: drug._id,
          links: normalizedLinks,
        });
        drugsNormalized += 1;
      }
    }

    const activeGaps = gaps.filter((gap) => gap.status === "active");
    const groups = new Map<string, typeof activeGaps>();
    for (const gap of activeGaps) {
      const dedupeKey = buildGapDedupeKey({
        therapeuticArea: gap.therapeuticArea,
        indication: gap.indication,
        targetCountries: gap.targetCountries,
      });
      const current = groups.get(dedupeKey) ?? [];
      current.push(gap);
      groups.set(dedupeKey, current);
      if (gap.dedupeKey !== dedupeKey) {
        await ctx.db.patch(gap._id, { dedupeKey });
      }
    }

    for (const [dedupeKey, group] of groups.entries()) {
      if (group.length < 2) continue;

      const keeper = group.sort((left, right) => left._creationTime - right._creationTime)[0];
      for (const duplicate of group.slice(1)) {
        await ctx.db.patch(keeper._id, {
          targetCountries: mergeUniqueStrings([
            ...keeper.targetCountries,
            ...duplicate.targetCountries,
          ]),
          gapScore: Math.max(keeper.gapScore, duplicate.gapScore),
          demandEvidence: mergeMultilineText(keeper.demandEvidence, duplicate.demandEvidence),
          supplyGap: mergeMultilineText(keeper.supplyGap, duplicate.supplyGap) ?? keeper.supplyGap,
          competitorLandscape:
            mergeMultilineText(keeper.competitorLandscape, duplicate.competitorLandscape) ??
            keeper.competitorLandscape,
          suggestedDrugClasses: mergeUniqueStrings([
            ...keeper.suggestedDrugClasses,
            ...duplicate.suggestedDrugClasses,
          ]),
          tenderSignals: mergeMultilineText(keeper.tenderSignals, duplicate.tenderSignals),
          whoDiseaseBurden: mergeMultilineText(
            keeper.whoDiseaseBurden,
            duplicate.whoDiseaseBurden
          ),
          linkedDrugIds: [
            ...new Set([...(keeper.linkedDrugIds ?? []), ...(duplicate.linkedDrugIds ?? [])]),
          ],
          linkedCompanyIds: [
            ...new Set([
              ...(keeper.linkedCompanyIds ?? []),
              ...(duplicate.linkedCompanyIds ?? []),
            ]),
          ],
          sources: mergeSources(keeper.sources, duplicate.sources),
          dedupeKey,
          updatedAt: Date.now(),
        });

        for (const match of gapMatches.filter((item) => item.gapOpportunityId === duplicate._id)) {
          const keeperMatch = gapMatches.find(
            (item) =>
              item.gapOpportunityId === keeper._id && item.companyId === match.companyId
          );
          if (keeperMatch) {
            await ctx.db.patch(keeperMatch._id, {
              distributorFitScore: Math.max(
                keeperMatch.distributorFitScore,
                match.distributorFitScore
              ),
              rationale:
                mergeMultilineText(keeperMatch.rationale, match.rationale) ??
                keeperMatch.rationale,
              evidenceLinks: mergeSources(keeperMatch.evidenceLinks, match.evidenceLinks),
              updatedAt: Date.now(),
            });
            await ctx.db.delete(match._id);
          } else {
            await ctx.db.patch(match._id, {
              gapOpportunityId: keeper._id,
              updatedAt: Date.now(),
            });
          }
        }

        for (const opportunity of opportunities.filter(
          (item) => item.gapOpportunityId === duplicate._id
        )) {
          const keeperOpportunity = opportunities.find(
            (item) => item.gapOpportunityId === keeper._id && item.drugId === opportunity.drugId
          );
          if (keeperOpportunity) {
            await ctx.db.patch(opportunity._id, {
              status: "archived",
              updatedAt: Date.now(),
            });
          } else {
            await ctx.db.patch(opportunity._id, {
              gapOpportunityId: keeper._id,
              updatedAt: Date.now(),
            });
          }
        }

        await ctx.db.patch(duplicate._id, {
          status: "archived",
          updatedAt: Date.now(),
        });
        gapsMerged += 1;
      }
    }

    return { drugsNormalized, gapsMerged };
  },
});

export const runRepair = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(api.researchLifecycle.repairData, {});
  },
});
