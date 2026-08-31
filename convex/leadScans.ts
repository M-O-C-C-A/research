"use node";

import { action, ActionCtx, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  contentHash,
  parseEgyptEprocurementHtml,
  parseEtimadTenderHtml,
  parseNupcoTendersHtml,
  parseSfdaShortageHtml,
  type LeadSourceSystem,
  type ParsedLeadSignal,
} from "./leadSourceParsers";

const SOURCES: Array<{
  sourceSystem: LeadSourceSystem;
  sourceUrl: string;
  title: string;
  country: "Saudi Arabia" | "Egypt";
  parse: (html: string, sourceUrl: string) => ParsedLeadSignal[];
}> = [
  {
    sourceSystem: "sfda_current_shortage",
    sourceUrl: "https://www.sfda.gov.sa/en/currentlyInShortageList",
    title: "SFDA current drug shortage list",
    country: "Saudi Arabia",
    parse: (html, sourceUrl) => parseSfdaShortageHtml({ html, sourceUrl }),
  },
  {
    sourceSystem: "sfda_anticipated_shortage",
    sourceUrl: "https://www.sfda.gov.sa/en/anticipatedShortage",
    title: "SFDA anticipated drug shortage list",
    country: "Saudi Arabia",
    parse: (html, sourceUrl) => parseSfdaShortageHtml({ html, sourceUrl, anticipated: true }),
  },
  {
    sourceSystem: "nupco_tenders",
    sourceUrl: "https://www.nupco.com/tenders/tenders-list/",
    title: "NUPCO current tenders",
    country: "Saudi Arabia",
    parse: (html, sourceUrl) => parseNupcoTendersHtml({ html, sourceUrl }),
  },
  {
    sourceSystem: "nupco_tender_plan",
    sourceUrl: "https://www.nupco.com/tenders/tenders-plan/",
    title: "NUPCO tender plan",
    country: "Saudi Arabia",
    parse: (html, sourceUrl) => parseNupcoTendersHtml({ html, sourceUrl, plan: true }),
  },
  {
    sourceSystem: "etimad",
    sourceUrl: "https://tenders.etimad.sa/Tender/AllTendersForVisitor",
    title: "Etimad public tenders",
    country: "Saudi Arabia",
    parse: (html, sourceUrl) => parseEtimadTenderHtml({ html, sourceUrl }),
  },
  {
    sourceSystem: "egypt_eprocurement",
    sourceUrl: "https://www.eps-gags.gov.eg/pt/main.do",
    title: "Egypt public e-procurement notices",
    country: "Egypt",
    parse: (html, sourceUrl) => parseEgyptEprocurementHtml({ html, sourceUrl }),
  },
];

type SourceFetchResult = {
  source: (typeof SOURCES)[number];
  html?: string;
  status?: number;
  warning?: string;
};

async function fetchOfficialSource(source: (typeof SOURCES)[number]): Promise<SourceFetchResult> {
  try {
    const response = await fetch(source.sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "KEMEDICA evidence monitor/1.0",
      },
    });
    if (!response.ok) {
      return { source, status: response.status, warning: `${source.title} returned ${response.status}.` };
    }
    return { source, status: response.status, html: await response.text() };
  } catch (error) {
    return {
      source,
      warning: `${source.title} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runScan(ctx: ActionCtx, trigger: "manual" | "scheduled") {
  const scanId: Id<"leadScanRuns"> = await ctx.runMutation(
    internal.actionableLeads.createScanRun,
    {
      trigger,
      sourceSystems: [...SOURCES.map((source) => source.sourceSystem), "mohap_import"],
    }
  );
  const warnings: string[] = [];
  let signalsFound = 0;
  let leadsPublished = 0;
  let successfulSources = 0;

  try {
    await ctx.runMutation(internal.actionableLeads.syncExistingCompanyContacts, {});
    const results = await Promise.all(SOURCES.map(fetchOfficialSource));
    const signalIds: Id<"marketSignals">[] = [];

    for (const result of results) {
      if (!result.html) {
        if (result.warning) warnings.push(result.warning);
        continue;
      }
      successfulSources += 1;
      const signals = result.source.parse(result.html, result.source.sourceUrl);
      const ingestedSignals = signals.map((signal) => ({
        externalId: signal.externalId,
        country: signal.country,
        signalType: signal.signalType,
        status: signal.status,
        title: signal.title,
        productTerms: signal.productTerms,
        sourceUrl: signal.sourceUrl,
        publishedAt: signal.publishedAt,
        deadline: signal.deadline,
        parsedFacts: signal.parsedFacts,
      }));
      signalsFound += signals.length;
      const ingested: { signalIds: Id<"marketSignals">[] } = await ctx.runMutation(
        internal.actionableLeads.ingestOfficialSignals,
        {
          sourceSystem: result.source.sourceSystem,
          sourceRecordId: `${result.source.sourceSystem}:${contentHash(result.html)}`,
          sourceUrl: result.source.sourceUrl,
          country: result.source.country,
          title: result.source.title,
          rawContent: result.html,
          contentHash: contentHash(result.html),
          parserVersion: result.source.country === "Egypt" ? "egypt-public-v1" : "saudi-public-v1",
          httpStatus: result.status,
          signals: ingestedSignals,
        }
      );
      signalIds.push(...ingested.signalIds);
      if (signals.length === 0) {
        warnings.push(`${result.source.title} was fetched but did not expose parseable signals.`);
      }
    }

    const mohap: { signals: number } = await ctx.runMutation(
      internal.actionableLeads.syncLatestMohapImport,
      {}
    );
    signalsFound += mohap.signals;
    if (signalIds.length > 0) {
      const qualification: { published: number } = await ctx.runMutation(
        internal.actionableLeads.requalifySignals,
        { signalIds }
      );
      leadsPublished = qualification.published;
    }
    const leadsExpired: number = await ctx.runMutation(internal.actionableLeads.expireStale, {});
    const status =
      successfulSources === 0 ? "error" : warnings.length > 0 ? "partial" : "completed";
    await ctx.runMutation(internal.actionableLeads.completeScanRun, {
      id: scanId,
      status,
      signalsFound,
      leadsPublished,
      leadsExpired,
      warnings,
      ...(successfulSources === 0 ? { errorMessage: "No official source could be fetched." } : {}),
    });
    return { scanId, status, signalsFound, leadsPublished, leadsExpired, warnings };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.runMutation(internal.actionableLeads.completeScanRun, {
      id: scanId,
      status: "error",
      signalsFound,
      leadsPublished,
      leadsExpired: 0,
      warnings,
      errorMessage,
    });
    throw error;
  }
}

export const runWeekly = action({
  args: {},
  handler: async (ctx) => await runScan(ctx, "manual"),
});

export const refreshLead = action({
  args: { id: v.id("actionableLeads") },
  handler: async (ctx, { id }) => {
    await runScan(ctx, "manual");
    return await ctx.runQuery(api.actionableLeads.get, { id });
  },
});

export const requalifySignal = action({
  args: { signalId: v.id("marketSignals") },
  handler: async (ctx, { signalId }) =>
    await ctx.runMutation(internal.actionableLeads.requalifySignals, { signalIds: [signalId] }),
});

export const requalifyCurrentSignals = action({
  args: {},
  handler: async (ctx) => {
    const signalIds: Id<"marketSignals">[] = await ctx.runQuery(
      internal.actionableLeads.listCurrentSignalIds,
      {}
    );
    return await ctx.runMutation(internal.actionableLeads.requalifySignals, { signalIds });
  },
});

export const runWeeklyInternal = internalAction({
  args: {},
  handler: async (ctx) => await runScan(ctx, "scheduled"),
});
