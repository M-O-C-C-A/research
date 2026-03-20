"use node";

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const contentType = blob.type || "application/octet-stream";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return Buffer.from(await blob.arrayBuffer()).toString("base64");
}

export function extractSeedTerms(text: string, maxTerms = 20): string[] {
  const matches =
    text.match(
      /\b[A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,}){0,2}\b/g
    ) ?? [];

  return [...new Set(matches.map((value) => value.trim()))].slice(0, maxTerms);
}
