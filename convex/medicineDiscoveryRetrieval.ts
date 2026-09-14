"use node";
import { cleanText, normalizedSourceUrl } from "./medicineDiscoveryPolicy";

// Only public URLs already cited by the search provider reach this function.
export async function retrieveEvidencePages(urls: string[]) {
  const pages = new Map<string, string>();
  const selected = [...new Set(urls)]
    .filter((url) => {
      try {
        const h = new URL(url).hostname;
        return !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(h);
      } catch {
        return false;
      }
    })
    .slice(0, 32);
  if (process.env.TAVILY_API_KEY) {
    await Promise.all(
      Array.from({ length: Math.ceil(selected.length / 5) }, async (_, i) => {
        try {
          const r = await fetch("https://api.tavily.com/extract", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              urls: selected.slice(i * 5, i * 5 + 5),
              extract_depth: "advanced",
              format: "markdown",
            }),
            signal: AbortSignal.timeout(45_000),
          });
          if (!r.ok) return;
          const data = (await r.json()) as {
            results?: Array<{ url: string; raw_content: string }>;
          };
          for (const row of data.results ?? []) {
            const url = normalizedSourceUrl(row.url);
            if (url && row.raw_content?.length > 200)
              pages.set(url, row.raw_content.slice(0, 18000));
          }
        } catch {
          /* Direct public-page retrieval below remains available. */
        }
      }),
    );
  }
  await Promise.all(
    selected
      .filter((url) => !pages.has(url))
      .map(async (url) => {
        try {
          const r = await fetch(url, {
            signal: AbortSignal.timeout(20_000),
            headers: { Accept: "text/html" },
          });
          if (!r.ok || !r.headers.get("content-type")?.includes("text/html"))
            return;
          const html = await r.text();
          const text = cleanText(
            html
              .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
              .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " "),
          );
          if (text.length > 200) pages.set(url, text.slice(0, 18000));
        } catch {
          /* Unretrievable source claims are not admitted as verified evidence. */
        }
      }),
  );
  return pages;
}
