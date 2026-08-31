import { ConvexHttpClient } from "convex/browser";
import * as XLSX from "xlsx";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SizingInputExport = {
  country: string;
  eligiblePatients: number;
  diagnosedReachableRate: number;
  brandedTreatmentRate: number;
  kemedicaShareRate: number;
  netPricePerPatientYearUsd: number;
  marketMarginRate: number;
  licenseSignedProbability: number;
  registrationGrantedProbability: number;
  inputStatus: string;
  basis: string;
};

type DealScenarioExport = {
  model: string;
  market: string;
  netRevenueLowUsd: number;
  netRevenueHighUsd: number;
  expectedGrossMarginPct: number;
  operatingCostUsd: number;
  probabilityOfSuccessPct: number;
  expectedValueUsd: number;
  assumptions: string[];
};

type EvidenceExport = {
  claim?: string;
  sourceType?: string;
  sourceTier?: string;
  url?: string;
  excerpt?: string;
  confidence?: string;
  retrievalDate?: string;
};

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  return new ConvexHttpClient(convexUrl);
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "kemedica-asset";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getConvexClient();
  const payload = await client.query(api.continuousOpportunityEngine.getAssetExportPayload, {
    decisionOpportunityId: id as Id<"decisionOpportunities">,
  });
  if (!payload?.opportunity || !payload?.drug) {
    return Response.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const workbook = XLSX.utils.book_new();
  const opportunity = payload.opportunity;
  const drug = payload.drug;
  const runItem = payload.latestRunItem;

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        product: opportunity.productName,
        inn: drug.genericName,
        company: opportunity.approachEntityName,
        indication: runItem?.indication ?? drug.indication ?? "UNKNOWN",
        priorityScore: opportunity.priorityScore,
        peakSalesUsd: runItem?.peakSalesUsd ?? "UNVALIDATED",
        riskAdjustedMarginUsd: runItem?.riskAdjustedMargin ?? "UNVALIDATED",
        approvals: runItem?.approvalsSummary ?? opportunity.approvalSummary ?? "UNKNOWN",
        menaRights: runItem?.menaRightsSummary ?? "UNVALIDATED",
        nextAction: opportunity.howToEnterExplanation,
      },
    ]),
    "Summary"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      ((payload.sizingInputs ?? []) as SizingInputExport[]).map((row) => ({
        country: row.country,
        eligiblePatients: row.eligiblePatients,
        diagnosedReachableRate: row.diagnosedReachableRate,
        brandedTreatmentRate: row.brandedTreatmentRate,
        kemedicaShareRate: row.kemedicaShareRate,
        netPricePerPatientYearUsd: row.netPricePerPatientYearUsd,
        marketMarginRate: row.marketMarginRate,
        licenseSignedProbability: row.licenseSignedProbability,
        registrationGrantedProbability: row.registrationGrantedProbability,
        inputStatus: row.inputStatus,
        basis: row.basis,
      }))
    ),
    "Sizing"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      Object.entries(runItem?.peakSalesByMarket ?? {}).map(([market, peakSalesUsd]) => ({
        market,
        peakSalesUsd,
      }))
    ),
    "Market Output"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      ((payload.dealScenarios ?? []) as DealScenarioExport[]).map((scenario) => ({
        model: scenario.model,
        market: scenario.market,
        netRevenueLowUsd: scenario.netRevenueLowUsd,
        netRevenueHighUsd: scenario.netRevenueHighUsd,
        expectedGrossMarginPct: scenario.expectedGrossMarginPct,
        operatingCostUsd: scenario.operatingCostUsd,
        probabilityOfSuccessPct: scenario.probabilityOfSuccessPct,
        expectedValueUsd: scenario.expectedValueUsd,
        assumptions: scenario.assumptions.join(" | "),
      }))
    ),
    "Deal Economics"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      ((payload.evidence ?? []) as EvidenceExport[]).map((evidence) => ({
        claim: evidence.claim,
        sourceType: evidence.sourceType,
        sourceTier: evidence.sourceTier,
        url: evidence.url,
        excerpt: evidence.excerpt,
        confidence: evidence.confidence,
        retrievalDate: evidence.retrievalDate,
      }))
    ),
    safeSheetName("Evidence")
  );

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(opportunity.productName)}-model.xlsx"`,
    },
  });
}
