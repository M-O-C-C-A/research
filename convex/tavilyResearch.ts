"use node";

const TAVILY_API_BASE = "https://api.tavily.com";
const DEFAULT_RETRIEVAL_MODE = "hybrid";
const UAE_COUNTRY = "united arab emirates";

export type RetrievalMode = "openai" | "hybrid";

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchEvidence {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  sourceKind:
    | "official_registry"
    | "ema"
    | "government_publication"
    | "tender_portal"
    | "who_or_gbd"
    | "market_report";
  confidence: "confirmed" | "likely" | "inferred";
}

export interface TavilySearchRequest {
  query: string;
  search_depth: "advanced";
  topic: "general";
  country: string;
  include_answer: false;
  include_raw_content: "markdown";
  max_results: number;
  include_domains?: string[];
}

interface TavilySearchResponse {
  request_id?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    raw_content?: string | null;
    score?: number;
  }>;
}

interface TavilyExtractResponse {
  request_id?: string;
  results?: Array<{
    url?: string;
    raw_content?: string;
  }>;
}

interface SearchAndExtractOptions {
  queries: string[];
  officialDomains?: string[];
  preferredCountry?: string;
  maxResults?: number;
  fetchImpl?: typeof fetch;
}

export interface TavilyHybridResult {
  provider: "tavily_hybrid";
  requestIds: string[];
  sources: ResearchSource[];
  evidence: ResearchEvidence[];
}

export const UAE_OFFICIAL_EVIDENCE_DOMAINS = [
  "mohap.gov.ae",
  "u.ae",
  "moh.gov.sa",
  "sfda.gov.sa",
  "nupco.com",
  "gccdrug.com",
  "emro.who.int",
  "who.int",
  "edaegypt.gov.eg",
  "eda.gov.eg",
  "mohealth.gov.eg",
  "jfda.jo",
  "moph.gov.qa",
] as const;

export function getRetrievalMode(value = process.env.RESEARCH_RETRIEVAL_MODE): RetrievalMode {
  return value === "openai" ? "openai" : DEFAULT_RETRIEVAL_MODE;
}

export function hasTavilyApiKey(apiKey = process.env.TAVILY_API_KEY): boolean {
  return Boolean(apiKey?.trim());
}

export function buildOfficialEvidenceDomains(extraDomains: string[] = []): string[] {
  return uniqueStrings([...UAE_OFFICIAL_EVIDENCE_DOMAINS, ...extraDomains]);
}

export function buildTavilyUaeSearchRequest(args: {
  query: string;
  includeDomains?: string[];
  maxResults?: number;
  country?: string;
}): TavilySearchRequest {
  return {
    query: args.query,
    search_depth: "advanced",
    topic: "general",
    country: args.country ?? UAE_COUNTRY,
    include_answer: false,
    include_raw_content: "markdown",
    max_results: args.maxResults ?? 6,
    ...(args.includeDomains?.length ? { include_domains: args.includeDomains } : {}),
  };
}

export async function searchAndExtractEvidence(
  options: SearchAndExtractOptions
): Promise<TavilyHybridResult | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey || getRetrievalMode() !== "hybrid") return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const requestIds: string[] = [];
  const officialDomains = buildOfficialEvidenceDomains(options.officialDomains);
  const preferredCountry = options.preferredCountry ?? UAE_COUNTRY;
  const maxResults = options.maxResults ?? 6;

  const officialResults = await runSearches({
    queries: options.queries,
    includeDomains: officialDomains,
    preferredCountry,
    maxResults,
    apiKey,
    fetchImpl,
    requestIds,
  });

  const broaderResults =
    officialResults.length > 0
      ? []
      : await runSearches({
          queries: options.queries,
          preferredCountry,
          maxResults,
          apiKey,
          fetchImpl,
          requestIds,
        });

  const combinedResults = dedupeSearchResults([...officialResults, ...broaderResults]).slice(
    0,
    maxResults
  );
  if (combinedResults.length === 0) return null;

  const extractedByUrl = await extractSearchResults({
    results: combinedResults,
    query: options.queries.join(" | "),
    apiKey,
    fetchImpl,
    requestIds,
  });

  const evidence = combinedResults
    .map((result) => {
      const normalizedUrl = normalizeExternalUrl(result.url);
      if (!normalizedUrl) return null;
      const domain = getDomain(normalizedUrl);
      const extractedContent = extractedByUrl.get(normalizedUrl)?.trim();
      const searchSnippet = firstNonEmpty(result.raw_content, result.content);
      const snippet = clipText(extractedContent ?? searchSnippet ?? "", 1600);
      if (!snippet) return null;

      return {
        title: result.title?.trim() || normalizedUrl,
        url: normalizedUrl,
        domain,
        snippet,
        sourceKind: inferSourceKind(domain),
        confidence: inferConfidence(domain),
      } satisfies ResearchEvidence;
    })
    .filter((item): item is ResearchEvidence => item !== null);

  if (evidence.length === 0) return null;

  return {
    provider: "tavily_hybrid",
    requestIds: requestIds.filter(Boolean),
    sources: dedupeSources(
      evidence.map((item) => ({ title: item.title, url: item.url }))
    ),
    evidence,
  };
}

async function runSearches(args: {
  queries: string[];
  includeDomains?: string[];
  preferredCountry: string;
  maxResults: number;
  apiKey: string;
  fetchImpl: typeof fetch;
  requestIds: string[];
}) {
  const aggregate: TavilySearchResponse["results"] = [];

  for (const query of uniqueStrings(args.queries.map((value) => value.trim()).filter(Boolean))) {
    const body = buildTavilyUaeSearchRequest({
      query,
      includeDomains: args.includeDomains,
      maxResults: args.maxResults,
      country: args.preferredCountry,
    });
    const response = await postJson<TavilySearchResponse>({
      path: "/search",
      body,
      apiKey: args.apiKey,
      fetchImpl: args.fetchImpl,
    });
    if (response.request_id) args.requestIds.push(response.request_id);
    aggregate?.push(...(response.results ?? []));
  }

  return aggregate ?? [];
}

async function extractSearchResults(args: {
  results: NonNullable<TavilySearchResponse["results"]>;
  query: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  requestIds: string[];
}) {
  const urls = uniqueStrings(
    args.results
      .map((result) => normalizeExternalUrl(result.url))
      .filter((value): value is string => Boolean(value))
  ).slice(0, 5);

  if (urls.length === 0) return new Map<string, string>();

  const response = await postJson<TavilyExtractResponse>({
    path: "/extract",
    body: {
      urls,
      query: args.query,
      chunks_per_source: 3,
      extract_depth: "advanced",
      format: "markdown",
    },
    apiKey: args.apiKey,
    fetchImpl: args.fetchImpl,
  });
  if (response.request_id) args.requestIds.push(response.request_id);

  return new Map(
    (response.results ?? [])
      .map((item) => {
        const url = normalizeExternalUrl(item.url);
        if (!url || !item.raw_content) return null;
        return [url, item.raw_content] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)
  );
}

async function postJson<T>(args: {
  path: string;
  body: unknown;
  apiKey: string;
  fetchImpl: typeof fetch;
}): Promise<T> {
  let response = await args.fetchImpl(`${TAVILY_API_BASE}${args.path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(args.body),
  });

  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "1");
    await sleep(Math.max(1, retryAfterSeconds) * 1000);
    response = await args.fetchImpl(`${TAVILY_API_BASE}${args.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify(args.body),
    });
  }

  if (!response.ok) {
    throw new Error(`Tavily request failed (${response.status}) for ${args.path}`);
  }

  return (await response.json()) as T;
}

function dedupeSearchResults(results: NonNullable<TavilySearchResponse["results"]>) {
  const byUrl = new Map<string, NonNullable<TavilySearchResponse["results"]>[number]>();
  for (const result of results) {
    const normalizedUrl = normalizeExternalUrl(result.url);
    if (!normalizedUrl) continue;
    const existing = byUrl.get(normalizedUrl);
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      byUrl.set(normalizedUrl, result);
    }
  }
  return [...byUrl.values()].sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}

function dedupeSources(sources: ResearchSource[]): ResearchSource[] {
  const byUrl = new Map<string, ResearchSource>();
  for (const source of sources) {
    const normalizedUrl = normalizeExternalUrl(source.url);
    if (!normalizedUrl || byUrl.has(normalizedUrl)) continue;
    byUrl.set(normalizedUrl, {
      title: source.title || normalizedUrl,
      url: normalizedUrl,
    });
  }
  return [...byUrl.values()];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeExternalUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw) && !/\s/.test(raw)) {
    return `https://${raw}`;
  }
  return null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function inferSourceKind(domain: string): ResearchEvidence["sourceKind"] {
  if (domain.includes("sfda.gov.sa") || domain.includes("gccdrug.com") || domain.includes("jfda")) {
    return "official_registry";
  }
  if (domain.includes("who.int")) return "who_or_gbd";
  if (domain.includes("nupco") || domain.includes("tender")) return "tender_portal";
  if (
    domain.includes("mohap.gov.ae") ||
    domain.endsWith(".gov.ae") ||
    domain.endsWith(".gov.sa") ||
    domain.endsWith(".gov.eg") ||
    domain.endsWith(".gov.qa") ||
    domain.endsWith(".jo")
  ) {
    return "government_publication";
  }
  return "market_report";
}

function inferConfidence(domain: string): ResearchEvidence["confidence"] {
  const sourceKind = inferSourceKind(domain);
  return sourceKind === "market_report" ? "likely" : "confirmed";
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function clipText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
