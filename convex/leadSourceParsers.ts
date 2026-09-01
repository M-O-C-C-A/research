export type LeadSourceSystem =
  | "sfda_current_shortage"
  | "sfda_anticipated_shortage"
  | "nupco_tenders"
  | "nupco_tender_plan"
  | "etimad"
  | "egypt_eprocurement";

export type ParsedLeadSignal = {
  sourceSystem: LeadSourceSystem;
  externalId: string;
  country: "Saudi Arabia" | "Egypt";
  signalType: "shortage" | "anticipated_shortage" | "tender" | "procurement";
  status: "open" | "observed";
  title: string;
  productTerms: string[];
  sourceUrl: string;
  publishedAt?: number;
  deadline?: number;
  parsedFacts: Record<string, string>;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x27);/gi, "'")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stableId(prefix: string, value: string) {
  return `${prefix}:${normalize(value).replace(/\s+/g, "-").slice(0, 160)}`;
}

function dateFromText(value: string | undefined) {
  if (!value) return undefined;
  const iso = value.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const european = value.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (european) {
    return Date.UTC(Number(european[3]), Number(european[2]) - 1, Number(european[1]));
  }

  return undefined;
}

function firstDateAfter(block: string, label: RegExp) {
  const match = block.match(label);
  return dateFromText(match?.[1]);
}

export function parseSfdaShortageHtml(args: {
  html: string;
  sourceUrl: string;
  anticipated?: boolean;
}): ParsedLeadSignal[] {
  const sourceSystem = args.anticipated
    ? "sfda_anticipated_shortage"
    : "sfda_current_shortage";
  const signalType = args.anticipated ? "anticipated_shortage" : "shortage";
  const rows = [...args.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  const signals: Array<ParsedLeadSignal | null> = rows.map((row) => {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => decodeHtml(cell[1]))
        .filter(Boolean);
      if (cells.length < 2) return null;

      const genericName = cells[0];
      if (/generic name|trade name|availability status/i.test(genericName)) return null;
      const availability = cells[1];
      const tradeNumber = cells[2] ?? "";

      return {
        sourceSystem,
        externalId: stableId(sourceSystem, `${genericName}:${tradeNumber || availability}`),
        country: "Saudi Arabia",
        signalType,
        status: "observed",
        title: `${args.anticipated ? "Anticipated shortage" : "Current shortage"}: ${genericName}`,
        productTerms: [genericName],
        sourceUrl: args.sourceUrl,
        parsedFacts: {
          genericName,
          availability,
          tradeNumber,
        },
      } satisfies ParsedLeadSignal;
    });
  return signals.filter((item): item is ParsedLeadSignal => item !== null);
}

export function parseNupcoTendersHtml(args: {
  html: string;
  sourceUrl: string;
  plan?: boolean;
}): ParsedLeadSignal[] {
  const sourceSystem = args.plan ? "nupco_tender_plan" : "nupco_tenders";
  const text = decodeHtml(args.html);
  const matches = [...text.matchAll(/Tender ID\s*([A-Z]{2,4}\d{3,5}\/?\d{2})/gi)];

  return matches.map((match, index) => {
    const block = text.slice(match.index, matches[index + 1]?.index ?? match.index + 1600);
    const externalId = match[1].toUpperCase();
    const titleMatch = block.match(
      /(?:Tender ID\s*[A-Z]{2,4}\d{3,5}\/?\d{2}\s*)?(?:Available\s*\/\s*New|Updated|Direct Purchase|Under Studying)?\s*([^|]{10,260}?)(?=\s*(?:Submission Deadline|Bid Opening|Opening Date|Tender ID)\b)/i
    );
    const title = (titleMatch?.[1] ?? `NUPCO tender ${externalId}`).trim();
    const deadline = firstDateAfter(block, /Submission Deadline:\s*([^|]{1,60})/i);
    const openingDate = firstDateAfter(block, /Opening Date:\s*([^|]{1,60})/i);

    return {
      sourceSystem,
      externalId,
      country: "Saudi Arabia",
      signalType: "tender",
      status: "open",
      title,
      productTerms: [title],
      sourceUrl: args.sourceUrl,
      publishedAt: openingDate,
      deadline,
      parsedFacts: {
        tenderId: externalId,
        ...(deadline ? { deadline: new Date(deadline).toISOString().slice(0, 10) } : {}),
      },
    } satisfies ParsedLeadSignal;
  });
}

export function parseEtimadTenderHtml(args: {
  html: string;
  sourceUrl: string;
}): ParsedLeadSignal[] {
  const text = decodeHtml(args.html);
  const competitionId =
    text.match(/(?:Competition Number|رقم المنافسة)\s*[:：]?\s*([^|]{2,100})/i)?.[1]?.trim() ??
    "";
  const title =
    text.match(/(?:Competition Name|إسم المنافسة)\s*[:：]?\s*([^|]{5,500})/i)?.[1]?.trim() ??
    "";
  if (!competitionId || !title) return [];

  const deadline = firstDateAfter(
    text,
    /(?:Submission Deadline|آخر موعد[^|]*?)\s*[:：]?\s*([^|]{1,80})/i
  );

  return [
    {
      sourceSystem: "etimad",
      externalId: competitionId,
      country: "Saudi Arabia",
      signalType: "procurement",
      status: "open",
      title,
      productTerms: [title],
      sourceUrl: args.sourceUrl,
      deadline,
      parsedFacts: {
        competitionId,
        ...(deadline ? { deadline: new Date(deadline).toISOString().slice(0, 10) } : {}),
      },
    },
  ];
}

const EGYPT_MEDICAL_PROCUREMENT = /\b(?:medicine|medicines|drug|drugs|pharmaceuticals?|medical\s+(?:supplies|products?|devices?))\b|(?:دواء|أدوية|ادوية|عقاقير|مستلزمات\s+طبية)/i;

function egyptProductTerms(title: string) {
  const terms = new Set([title]);
  const match = title.match(
    /\b(?:medicines?|drugs?|pharmaceuticals?)\b\s*[:\-]?\s*(.{3,180})|(?:دواء|أدوية|ادوية|عقاقير)\s*[:\-]?\s*(.{3,180})/i
  );
  const extracted = (match?.[1] ?? match?.[2])?.replace(/\s+[-–]\s+.*/, "").trim();
  if (extracted) terms.add(extracted);
  return [...terms];
}

/**
 * Egypt's public e-procurement homepage lists operation IDs, subjects, and
 * dates. Only notices with explicit medical/product language become signals.
 */
export function parseEgyptEprocurementHtml(args: {
  html: string;
  sourceUrl: string;
}): ParsedLeadSignal[] {
  const operations = [...args.html.matchAll(
    /fnMoveOpDetail\('([^']+)'[^)]*\)[\s\S]{0,700}?<div\s+class="subject">([\s\S]*?)<\/div>[\s\S]{0,260}?<div\s+class="data2[^\"]*">\s*([^<]+)\s*<\/div>/gi
  )];

  return operations.flatMap((operation) => {
    const externalId = operation[1]?.trim();
    const title = decodeHtml(operation[2] ?? "");
    if (!externalId || !title || !EGYPT_MEDICAL_PROCUREMENT.test(title)) return [];

    return [{
      sourceSystem: "egypt_eprocurement",
      externalId,
      country: "Egypt",
      signalType: "procurement",
      status: "open",
      title,
      productTerms: egyptProductTerms(title),
      sourceUrl: args.sourceUrl,
      publishedAt: dateFromText(operation[3]),
      parsedFacts: { operationId: externalId },
    } satisfies ParsedLeadSignal];
  });
}

export function contentHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}
