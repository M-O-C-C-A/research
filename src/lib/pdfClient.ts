export async function extractPdfPreviewText(
  file: File,
  options?: {
    maxPages?: number;
    maxChars?: number;
  }
): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const maxPages = Math.min(options?.maxPages ?? 6, pdf.numPages);
  const maxChars = options?.maxChars ?? 8000;
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;
    parts.push(text);

    if (parts.join("\n\n").length >= maxChars) {
      break;
    }
  }

  return parts.join("\n\n").slice(0, maxChars);
}
