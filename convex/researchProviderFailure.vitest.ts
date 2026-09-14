import { describe, it, expect } from "vitest";
import { isRetryableRateLimit, extractCitedSources } from "./openaiResearch";
import { researchFailureMessage } from "./medicineDiscoveryReviewPolicy";

describe("research provider failures", () => {
  it("does not retry the production no-credit response or describe it as temporary congestion", () => {
    const error = {
      status: 429,
      message:
        "You have no credits remaining. Add credits to continue using the API.",
    };
    expect(isRetryableRateLimit(error)).toBe(false);
    expect(researchFailureMessage(new Error(error.message))).toContain(
      "account owner must add API credits",
    );
    expect(researchFailureMessage(new Error(error.message))).not.toMatch(
      /busy|Retry/,
    );
  });
  it("still permits bounded retries for temporary rate limits", () => {
    expect(
      isRetryableRateLimit({
        status: 429,
        code: "rate_limit_exceeded",
        message: "Tokens per minute exceeded",
      }),
    ).toBe(true);
  });
  it("does not retry insufficient quota even without a readable message", () => {
    expect(
      isRetryableRateLimit({ status: 429, code: "insufficient_quota" }),
    ).toBe(false);
  });
  it("separates cited evidence from search results that were never cited", () => {
    const sources = extractCitedSources({
      output: [
        {
          type: "web_search_call",
          action: { sources: [{ url: "https://example.org/search-result" }] },
        },
        {
          type: "message",
          content: [
            {
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.org/used",
                  title: "Original announcement",
                },
              ],
            },
          ],
        },
      ],
    });
    expect(sources.map((s) => s.url)).toEqual(["https://example.org/used"]);
  });
});
