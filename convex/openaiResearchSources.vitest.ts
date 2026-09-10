import { describe, it, expect } from "vitest";
import { extractSources } from "./openaiResearch";
describe("web-search citation extraction", () => {
  it("retains message citations when preview search omits action sources", () => {
    expect(
      extractSources({
        output: [
          { type: "web_search_call", action: { type: "search" } },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Evidence",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://www.ema.europa.eu/medicine",
                    title: "EMA",
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        title: "https://www.ema.europa.eu/medicine",
        url: "https://www.ema.europa.eu/medicine",
      },
    ]);
  });
  it("deduplicates cited and consulted URLs and rejects unsafe protocols", () => {
    const result = extractSources({
      output: [
        {
          type: "web_search_call",
          action: { sources: [{ url: "https://example.com/evidence" }] },
        },
        {
          type: "message",
          content: [
            {
              annotations: [
                { type: "url_citation", url: "https://example.com/evidence" },
                { type: "url_citation", url: "javascript:bad" },
              ],
            },
          ],
        },
      ],
    });
    expect(result).toHaveLength(1);
  });
});
