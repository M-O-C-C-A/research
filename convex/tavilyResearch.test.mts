import test from "node:test";
import assert from "node:assert/strict";

const tavilyModulePath = "./tavilyResearch.ts";
const tavilyModule = (await import(tavilyModulePath)) as typeof import("./tavilyResearch");

test("buildTavilyUaeSearchRequest defaults to UAE-focused advanced search", () => {
  const request = tavilyModule.buildTavilyUaeSearchRequest({
    query: "trastuzumab UAE MOHAP registration",
    includeDomains: ["mohap.gov.ae", "gccdrug.com"],
  });

  assert.equal(request.search_depth, "advanced");
  assert.equal(request.topic, "general");
  assert.equal(request.country, "united arab emirates");
  assert.equal(request.include_answer, false);
  assert.equal(request.include_raw_content, "markdown");
  assert.deepEqual(request.include_domains, ["mohap.gov.ae", "gccdrug.com"]);
});

test("buildOfficialEvidenceDomains includes UAE and GCC official presets", () => {
  const domains = tavilyModule.buildOfficialEvidenceDomains(["mohap.gov.ae", "custom.example"]);

  assert.ok(domains.includes("mohap.gov.ae"));
  assert.ok(domains.includes("sfda.gov.sa"));
  assert.ok(domains.includes("gccdrug.com"));
  assert.ok(domains.includes("custom.example"));
  assert.equal(domains.filter((value) => value === "mohap.gov.ae").length, 1);
});

test("searchAndExtractEvidence prefers official UAE evidence and preserves citations", async () => {
  process.env.TAVILY_API_KEY = "tvly-test";
  process.env.RESEARCH_RETRIEVAL_MODE = "hybrid";

  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const mockFetch: typeof fetch = (async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url, body });

    if (url.endsWith("/search")) {
      return new Response(
        JSON.stringify({
          request_id: "search-1",
          results: [
            {
              title: "MOHAP Product Directory",
              url: "https://mohap.gov.ae/en/services/drug-directory",
              content: "Official UAE medicines listing for trastuzumab.",
              score: 0.99,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.endsWith("/extract")) {
      return new Response(
        JSON.stringify({
          request_id: "extract-1",
          results: [
            {
              url: "https://mohap.gov.ae/en/services/drug-directory",
              raw_content:
                "Trastuzumab appears in the official UAE medicine directory with product and registration context.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;

  const result = await tavilyModule.searchAndExtractEvidence({
    queries: ['"trastuzumab" UAE MOHAP approved medicines'],
    fetchImpl: mockFetch,
  });

  assert.ok(result);
  assert.equal(result.provider, "tavily_hybrid");
  assert.deepEqual(result.requestIds, ["search-1", "extract-1"]);
  assert.equal(result.sources[0]?.url, "https://mohap.gov.ae/en/services/drug-directory");
  assert.equal(result.evidence[0]?.sourceKind, "government_publication");
  assert.match(result.evidence[0]?.snippet ?? "", /official UAE medicine directory/i);
  assert.deepEqual(calls[0]?.body.include_domains, tavilyModule.buildOfficialEvidenceDomains());
});

test("searchAndExtractEvidence falls back to broader search after empty official results", async () => {
  process.env.TAVILY_API_KEY = "tvly-test";
  process.env.RESEARCH_RETRIEVAL_MODE = "hybrid";

  let searchCallCount = 0;
  const mockFetch: typeof fetch = (async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

    if (url.endsWith("/search")) {
      searchCallCount += 1;
      const results =
        searchCallCount === 1
          ? []
          : [
              {
                title: "Wider market source",
                url: "https://example.com/report",
                content: "Fallback source mentioning UAE oncology access.",
                score: 0.55,
              },
            ];
      return new Response(
        JSON.stringify({
          request_id: `search-${searchCallCount}`,
          results,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.endsWith("/extract")) {
      return new Response(
        JSON.stringify({
          request_id: "extract-1",
          results: [
            {
              url: "https://example.com/report",
              raw_content: "Fallback evidence for UAE oncology access.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;

  const result = await tavilyModule.searchAndExtractEvidence({
    queries: ["UAE oncology formulary gap trastuzumab"],
    fetchImpl: mockFetch,
  });

  assert.ok(result);
  assert.equal(searchCallCount, 2);
  assert.equal(result.evidence[0]?.url, "https://example.com/report");
});

test("searchAndExtractEvidence returns null when Tavily is unavailable", async () => {
  delete process.env.TAVILY_API_KEY;
  process.env.RESEARCH_RETRIEVAL_MODE = "hybrid";

  const result = await tavilyModule.searchAndExtractEvidence({
    queries: ["UAE oncology opportunity"],
  });

  assert.equal(result, null);
});
