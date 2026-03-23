"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const CLINICALTRIALS_BASE = "https://clinicaltrials.gov/api/v2";

interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
}

interface ClinicalTrial {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  interventions: string[];
}

async function searchPubMed(
  indication: string,
  targetCountries: string[]
): Promise<PubMedArticle[]> {
  const countryTerms = targetCountries
    .slice(0, 3)
    .map((c) => `"${c}"[Affiliation]`)
    .join(" OR ");
  const query = `(${indication}[Title/Abstract]) AND (${countryTerms}) AND ("disease burden"[Title/Abstract] OR "epidemiology"[MeSH Terms] OR "prevalence"[Title/Abstract] OR "incidence"[Title/Abstract])`;

  const searchRes = await fetch(
    `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=5&retmode=json&sort=relevance`
  );
  if (!searchRes.ok) return [];

  const searchData = (await searchRes.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  const ids = searchData.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const summaryRes = await fetch(
    `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`
  );
  if (!summaryRes.ok) return [];

  const summaryData = (await summaryRes.json()) as {
    result?: Record<
      string,
      {
        title?: string;
        authors?: { name: string }[];
        pubdate?: string;
        fulljournalname?: string;
        source?: string;
      }
    >;
  };

  return ids
    .map((id: string) => {
      const doc = summaryData.result?.[id];
      if (!doc) return null;
      return {
        pmid: id,
        title: doc.title ?? `PubMed article ${id}`,
        authors: (doc.authors ?? [])
          .slice(0, 3)
          .map((a) => a.name)
          .join(", "),
        year: doc.pubdate?.split(" ")?.[0] ?? "",
        journal: doc.fulljournalname ?? doc.source ?? "",
      };
    })
    .filter((a): a is PubMedArticle => a !== null);
}

async function searchClinicalTrials(
  indication: string,
  targetCountries: string[]
): Promise<{ totalCount: number; studies: ClinicalTrial[] }> {
  const locationQuery = targetCountries.slice(0, 5).join(" OR ");
  const url =
    `${CLINICALTRIALS_BASE}/studies` +
    `?query.cond=${encodeURIComponent(indication)}` +
    `&query.locn=${encodeURIComponent(locationQuery)}` +
    `&fields=NCTId,BriefTitle,OverallStatus,Phase,InterventionName` +
    `&pageSize=10&countTotal=true`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return { totalCount: 0, studies: [] };

  const data = (await res.json()) as {
    totalCount?: number;
    studies?: Array<{
      protocolSection?: {
        identificationModule?: { nctId?: string; briefTitle?: string };
        statusModule?: { overallStatus?: string };
        designModule?: { phases?: string[] };
        armsInterventionsModule?: { interventions?: { name?: string }[] };
      };
    }>;
  };

  const studies = (data.studies ?? []).map((s) => {
    const proto = s.protocolSection ?? {};
    return {
      nctId: proto.identificationModule?.nctId ?? "",
      title: proto.identificationModule?.briefTitle ?? "",
      status: proto.statusModule?.overallStatus ?? "",
      phase: proto.designModule?.phases?.[0] ?? "",
      interventions: (proto.armsInterventionsModule?.interventions ?? [])
        .slice(0, 3)
        .map((i) => i.name ?? "")
        .filter(Boolean),
    };
  });

  return { totalCount: data.totalCount ?? 0, studies };
}

export const enrichGapWithEvidence = action({
  args: { gapOpportunityId: v.id("gapOpportunities") },
  handler: async (ctx, { gapOpportunityId }): Promise<Id<"discoveryJobs">> => {
    const gap = await ctx.runQuery(api.gapOpportunities.get, {
      id: gapOpportunityId,
    });
    if (!gap) throw new Error("Gap not found");

    const jobId = await ctx.runMutation(api.discoveryJobs.create, {
      type: "gap_evidence_enrichment",
      gapOpportunityId,
      therapeuticArea: gap.therapeuticArea,
      targetCountries: gap.targetCountries,
    });

    const log = async (
      message: string,
      level: "info" | "success" | "warning" | "error" = "info"
    ) => {
      await ctx.runMutation(api.discoveryJobs.appendLog, {
        id: jobId,
        message,
        level,
      });
    };

    try {
      await log(`Enriching: ${gap.indication} · ${gap.targetCountries.join(", ")}`);

      // 1. PubMed — disease burden literature
      await log("Searching PubMed for disease burden literature...");
      let pubmedArticles: PubMedArticle[] = [];
      try {
        pubmedArticles = await searchPubMed(gap.indication, gap.targetCountries);
        await log(
          pubmedArticles.length > 0
            ? `Found ${pubmedArticles.length} PubMed article${pubmedArticles.length !== 1 ? "s" : ""}`
            : "No PubMed articles found — try a broader indication term",
          pubmedArticles.length > 0 ? "success" : "warning"
        );
      } catch (e) {
        await log(
          `PubMed search failed: ${e instanceof Error ? e.message : String(e)}`,
          "warning"
        );
      }

      // 2. ClinicalTrials.gov — pipeline landscape
      await log("Querying ClinicalTrials.gov for active trials in the region...");
      let trialsData: { totalCount: number; studies: ClinicalTrial[] } = {
        totalCount: 0,
        studies: [],
      };
      try {
        trialsData = await searchClinicalTrials(gap.indication, gap.targetCountries);
        await log(
          trialsData.totalCount > 0
            ? `Found ${trialsData.totalCount} trial${trialsData.totalCount !== 1 ? "s" : ""} (showing top ${trialsData.studies.length})`
            : "No trials found in target markets",
          trialsData.totalCount > 0 ? "success" : "info"
        );
      } catch (e) {
        await log(
          `ClinicalTrials search failed: ${e instanceof Error ? e.message : String(e)}`,
          "warning"
        );
      }

      // Build new evidence items + sources
      const newEvidenceItems: Array<{
        claim: string;
        title: string;
        url: string;
        sourceKind: "pubmed" | "clinical_trial";
        country?: string;
        productOrClass?: string;
        confidence: "confirmed" | "likely" | "inferred";
      }> = [];
      const newSources: Array<{ title: string; url: string }> = [];

      for (const article of pubmedArticles) {
        const url = `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
        newEvidenceItems.push({
          claim: `Peer-reviewed research on ${gap.indication} in the region${article.year ? ` (${article.year})` : ""}${article.journal ? ` — ${article.journal}` : ""}`,
          title: article.title,
          url,
          sourceKind: "pubmed",
          confidence: "likely",
        });
        newSources.push({ title: article.title, url });
      }

      for (const study of trialsData.studies) {
        const url = `https://clinicaltrials.gov/study/${study.nctId}`;
        const isActive = [
          "RECRUITING",
          "ACTIVE_NOT_RECRUITING",
          "ENROLLING_BY_INVITATION",
        ].includes(study.status);
        const intervention = study.interventions[0];
        newEvidenceItems.push({
          claim: [
            `Clinical trial ${study.status.toLowerCase().replace(/_/g, " ")}`,
            study.phase ? study.phase.toLowerCase().replace(/_/g, " ") : null,
            intervention ?? null,
          ]
            .filter(Boolean)
            .join(" · "),
          title: study.title || study.nctId,
          url,
          sourceKind: "clinical_trial",
          confidence: isActive ? "confirmed" : "likely",
        });
        newSources.push({ title: `${study.nctId}: ${study.title}`, url });
      }

      // Dedup against existing
      const existingUrls = new Set((gap.sources ?? []).map((s) => s.url));
      const existingItemUrls = new Set((gap.evidenceItems ?? []).map((i) => i.url));
      const filteredSources = newSources.filter((s) => !existingUrls.has(s.url));
      const filteredItems = newEvidenceItems.filter((i) => !existingItemUrls.has(i.url));

      // Build updated narrative fields
      let whoDiseaseBurden = gap.whoDiseaseBurden;
      if (pubmedArticles.length > 0) {
        const articleList = pubmedArticles
          .map(
            (a) =>
              `• ${a.title}${a.authors ? ` — ${a.authors}` : ""}${a.year ? ` (${a.year})` : ""}`
          )
          .join("\n");
        const header = `${pubmedArticles.length} peer-reviewed publication${pubmedArticles.length !== 1 ? "s" : ""} identified via PubMed:\n`;
        whoDiseaseBurden = gap.whoDiseaseBurden
          ? `${gap.whoDiseaseBurden}\n\n${header}${articleList}`
          : `${header}${articleList}`;
      }

      let competitorLandscape = gap.competitorLandscape;
      if (trialsData.totalCount > 0) {
        const activeTrials = trialsData.studies.filter((s) =>
          ["RECRUITING", "ACTIVE_NOT_RECRUITING"].includes(s.status)
        );
        const trialLines = trialsData.studies
          .slice(0, 5)
          .map(
            (s) =>
              `• ${s.nctId}: ${s.title.slice(0, 80)}${s.title.length > 80 ? "…" : ""} [${s.status.replace(/_/g, " ")}]`
          )
          .join("\n");
        competitorLandscape =
          competitorLandscape +
          `\n\nClinicalTrials.gov: ${trialsData.totalCount} trial${trialsData.totalCount !== 1 ? "s" : ""} found (${activeTrials.length} active in region):\n${trialLines}`;
      }

      await log("Saving enriched evidence to gap record...");
      await ctx.runMutation(api.gapOpportunities.update, {
        id: gapOpportunityId,
        ...(whoDiseaseBurden !== undefined && { whoDiseaseBurden }),
        competitorLandscape,
        sources: [...(gap.sources ?? []), ...filteredSources],
        evidenceItems: [...(gap.evidenceItems ?? []), ...filteredItems],
        lastEnrichedAt: Date.now(),
      });

      const summary = `Added ${filteredItems.length} evidence item${filteredItems.length !== 1 ? "s" : ""}: ${pubmedArticles.length} PubMed + ${trialsData.studies.length} ClinicalTrials.gov`;
      await ctx.runMutation(api.discoveryJobs.complete, {
        id: jobId,
        newItemsFound: filteredItems.length,
        skippedDuplicates: newEvidenceItems.length - filteredItems.length,
        summary,
      });

      return jobId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.discoveryJobs.fail, {
        id: jobId,
        errorMessage,
      });
      return jobId;
    }
  },
});
