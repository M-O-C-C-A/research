import React from "react";
import { ConvexHttpClient } from "convex/browser";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: "#17211d",
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#9fb7a9",
    paddingBottom: 14,
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: "#557366",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 11,
    color: "#506159",
    lineHeight: 1.4,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  stat: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#d5dfd9",
    padding: 10,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 7,
    letterSpacing: 1.2,
    color: "#6b7b73",
    textTransform: "uppercase",
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: "#557366",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.45,
    color: "#2f3b36",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#edf1ee",
    paddingVertical: 5,
  },
  label: {
    width: 110,
    color: "#6b7b73",
  },
  value: {
    flex: 1,
    color: "#25312c",
  },
});

type AssetExportPayload = {
  opportunity: {
    productName: string;
    genericName?: string;
    approachEntityName: string;
    priorityScore: number;
    commercialRationale: string;
    approvalSummary?: string;
    contactName?: string;
    targetRole?: string;
    howToEnterExplanation: string;
  };
  drug: {
    genericName: string;
    indication?: string;
  };
  latestRunItem?: {
    indication?: string;
    peakSalesUsd?: number;
    riskAdjustedMargin?: number;
    approvalsSummary?: string;
    menaRightsSummary?: string;
    cascadeBasis?: string;
  } | null;
  sizingInputs?: Array<{
    basis?: string;
  }>;
};

function money(value?: number) {
  if (!value) return "UNVALIDATED";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  return new ConvexHttpClient(convexUrl);
}

function AssetBrief({ payload }: { payload: AssetExportPayload }): React.ReactElement<React.ComponentProps<typeof Document>> {
  const opportunity = payload.opportunity;
  const drug = payload.drug;
  const runItem = payload.latestRunItem;
  const firstSizing = payload.sizingInputs?.[0];

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.eyebrow }, "KEMEDICA Asset Brief"),
        React.createElement(Text, { style: styles.title }, `${opportunity.productName} / ${drug.genericName}`),
        React.createElement(
          Text,
          { style: styles.subtitle },
          `${opportunity.approachEntityName} · ${runItem?.indication ?? drug.indication ?? "Indication UNKNOWN"}`
        )
      ),
      React.createElement(
        View,
        { style: styles.grid },
        React.createElement(
          View,
          { style: styles.stat },
          React.createElement(Text, { style: styles.statValue }, money(runItem?.peakSalesUsd)),
          React.createElement(Text, { style: styles.statLabel }, "Peak sales")
        ),
        React.createElement(
          View,
          { style: styles.stat },
          React.createElement(Text, { style: styles.statValue }, money(runItem?.riskAdjustedMargin)),
          React.createElement(Text, { style: styles.statLabel }, "Risk-adjusted margin")
        ),
        React.createElement(
          View,
          { style: styles.stat },
          React.createElement(Text, { style: styles.statValue }, opportunity.priorityScore.toFixed(1)),
          React.createElement(Text, { style: styles.statLabel }, "Opportunity score")
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Thesis"),
        React.createElement(Text, { style: styles.body }, opportunity.commercialRationale)
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Identity and rights"),
        React.createElement(Row, { label: "INN", value: drug.genericName }),
        React.createElement(Row, { label: "Company", value: opportunity.approachEntityName }),
        React.createElement(Row, { label: "Approvals", value: runItem?.approvalsSummary ?? opportunity.approvalSummary ?? "UNKNOWN" }),
        React.createElement(Row, { label: "MENA rights", value: runItem?.menaRightsSummary ?? "UNVALIDATED" }),
        React.createElement(Row, { label: "Contact", value: opportunity.contactName ?? opportunity.targetRole ?? "UNKNOWN" })
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Sizing basis"),
        React.createElement(
          Text,
          { style: styles.body },
          runItem?.cascadeBasis ?? firstSizing?.basis ?? "UNVALIDATED"
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Next action"),
        React.createElement(Text, { style: styles.body }, opportunity.howToEnterExplanation)
      )
    )
  ) as React.ReactElement<React.ComponentProps<typeof Document>>;
}

function Row({ label, value }: { label: string; value?: string }) {
  return React.createElement(
    View,
    { style: styles.row },
    React.createElement(Text, { style: styles.label }, label),
    React.createElement(Text, { style: styles.value }, value || "UNKNOWN")
  );
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

  const buffer = await renderToBuffer(AssetBrief({ payload }));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payload.opportunity.productName}-asset-brief.pdf"`,
    },
  });
}
