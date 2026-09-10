import { describe, it, expect } from "vitest";
import { extractSources, createStructuredResponse } from "./openaiResearch";
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

it("serializes object research context into supported API input", async () => {
  let input: unknown;
  const client = {
    responses: {
      create: async (args: { input: unknown }) => {
        input = args.input;
        return { output_text: '{"findings":[]}', output: [] };
      },
    },
  };
  await createStructuredResponse(client as never, {
    instructions: "Extract evidence",
    input: { report: "cited report", sources: [] },
    formatName: "test",
    schema: { type: "object" },
    maxOutputTokens: 100,
  });
  expect(input).toBe(JSON.stringify({ report: "cited report", sources: [] }));
});
