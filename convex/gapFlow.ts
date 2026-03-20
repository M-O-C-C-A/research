import { ActionCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

export async function appendFlowLog(
  ctx: ActionCtx,
  jobId: Id<"discoveryJobs">,
  message: string,
  level: "info" | "success" | "warning" | "error" = "info"
) {
  await ctx.runMutation(api.discoveryJobs.appendLog, {
    id: jobId,
    message,
    level,
  });
}

function overlapScore(gap: Doc<"gapOpportunities">, drug: Doc<"drugs">) {
  let score = 0;
  if (drug.therapeuticArea === gap.therapeuticArea) score += 3;
  const gapText = `${gap.indication} ${gap.suggestedDrugClasses.join(" ")}`.toLowerCase();
  if (gapText.includes(drug.genericName.toLowerCase())) score += 3;
  if (gapText.includes(drug.name.toLowerCase())) score += 2;
  if (gapText.includes(drug.indication.toLowerCase())) score += 2;
  return score;
}

export async function linkRelevantDrugsToGap(args: {
  ctx: ActionCtx;
  gap: Doc<"gapOpportunities">;
  companyId: Id<"companies">;
}) {
  const drugs = await args.ctx.runQuery(api.drugs.listByCompany, {
    companyId: args.companyId,
  });
  const linkedDrugIds = new Set(args.gap.linkedDrugIds ?? []);
  const candidates = drugs
    .map((drug) => ({
      drug,
      score: overlapScore(args.gap, drug),
    }))
    .filter((entry) => entry.score > 0 && !linkedDrugIds.has(entry.drug._id))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return (right.drug.patentUrgencyScore ?? 0) - (left.drug.patentUrgencyScore ?? 0);
    })
    .slice(0, 5);

  for (const entry of candidates) {
    await args.ctx.runMutation(api.gapOpportunities.linkDrug, {
      id: args.gap._id,
      drugId: entry.drug._id,
    });
  }

  return candidates.length;
}

export async function runCompanyDrugLinkAndRebuild(args: {
  ctx: ActionCtx;
  gap: Doc<"gapOpportunities">;
  companyIds: Id<"companies">[];
  log?: (
    message: string,
    level?: "info" | "success" | "warning" | "error"
  ) => Promise<void>;
}) {
  let suppliersProcessed = 0;
  let productsLinked = 0;

  for (const companyId of args.companyIds) {
    suppliersProcessed += 1;
    const existingDrugs = await args.ctx.runQuery(api.drugs.listByCompany, {
      companyId,
    });
    if (existingDrugs.length === 0) {
      await args.log?.(`Discovering drugs for linked supplier ${companyId}...`);
      await args.ctx.runAction(api.discovery.findDrugsForCompany, { companyId });
    }

    const refreshedGap = await args.ctx.runQuery(api.gapOpportunities.get, {
      id: args.gap._id,
    });
    const latestGap = refreshedGap ?? args.gap;
    const linkedCount = await linkRelevantDrugsToGap({
      ctx: args.ctx,
      gap: latestGap,
      companyId,
    });
    productsLinked += linkedCount;
  }

  const beforeStats = await args.ctx.runQuery(api.decisionOpportunities.stats, {});
  const rebuildResult = await args.ctx.runAction(api.decisionOpportunities.rebuildFromResearch, {});
  const afterStats = await args.ctx.runQuery(api.decisionOpportunities.stats, {});
  const promotedDelta = Math.max(0, afterStats.active - beforeStats.active);

  return {
    suppliersProcessed,
    productsLinked,
    promotedDelta,
    rebuildResult,
  };
}
