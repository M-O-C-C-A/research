export const DISCOVERY_COUNTRIES = ["UAE", "Saudi Arabia", "Egypt"] as const;
export type DiscoveryCountry = (typeof DISCOVERY_COUNTRIES)[number];
export const EMA_FEED =
  "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json";
export const FDA_INDEX =
  "https://www.fda.gov/drugs/development-approval-process-drugs/novel-drug-approvals-fda";
export type ReferenceMedicine = {
  key: string;
  brand: string;
  inn: string;
  owner: string;
  indication: string;
  area: string;
  orphan: boolean;
  advanced: boolean;
  reference: {
    authority: "EU" | "US";
    sourceId: string;
    url: string;
    approvedAt: string;
    owner: string;
  };
};
export function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
export function discoveryTerm(value: string) {
  return cleanText(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function dateFromParts(value: string, order: "DMY" | "MDY") {
  const parts = value.split("/").map(Number);
  if (parts.length !== 3) return null;
  const [a, b, y] = parts;
  const m = order === "DMY" ? b : a;
  const d = order === "DMY" ? a : b;
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date.toISOString().slice(0, 10)
    : null;
}
export function parseEmaMedicines(
  payload: unknown,
  sinceYear: number,
  now = Date.now(),
) {
  const input = payload as {
    meta?: { total_records?: number; timestamp?: string };
    data?: Record<string, string>[];
  };
  if (
    !Array.isArray(input.data) ||
    input.data.length < 100 ||
    input.meta?.total_records !== input.data.length
  )
    throw new Error(
      "EMA feed structure or record count changed; previous results retained.",
    );
  const medicines: ReferenceMedicine[] = [];
  for (const row of input.data) {
    // EC decision date can be a recent variation of a decades-old product.
    const approvedAt = dateFromParts(
      row.marketing_authorisation_date ?? "",
      "DMY",
    );
    if (
      row.category !== "Human" ||
      row.medicine_status !== "Authorised" ||
      row.generic !== "No" ||
      row.biosimilar !== "No" ||
      !approvedAt ||
      Number(approvedAt.slice(0, 4)) < sinceYear ||
      Date.parse(approvedAt) > now
    )
      continue;
    const brand = cleanText(row.name_of_medicine ?? "");
    const inn = cleanText(
      row.international_non_proprietary_name_common_name ||
        row.active_substance ||
        "",
    );
    if (
      !brand ||
      !inn ||
      !row.medicine_url?.startsWith("https://www.ema.europa.eu/")
    )
      continue;
    const owner = cleanText(
      row.marketing_authorisation_developer_applicant_holder ?? "",
    );
    medicines.push({
      key: `${discoveryTerm(inn)}|${discoveryTerm(brand)}`,
      brand,
      inn,
      owner,
      indication: cleanText(row.therapeutic_indication ?? "").slice(0, 2400),
      area: cleanText(row.therapeutic_area_mesh ?? ""),
      orphan: row.orphan_medicine === "Yes",
      advanced: row.advanced_therapy === "Yes",
      reference: {
        authority: "EU",
        sourceId: row.ema_product_number,
        url: row.medicine_url,
        approvedAt,
        owner,
      },
    });
  }
  return {
    medicines,
    total: input.data.length,
    sourceDate: input.meta?.timestamp,
  };
}
export function parseFdaNovel(
  html: string,
  url: string,
  year: number,
  now = Date.now(),
) {
  const medicines: ReferenceMedicine[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => m[1],
    );
    if (cells.length !== 5 || !/^\d+\.?$/.test(cleanText(cells[0]))) continue;
    const approvedAt = dateFromParts(cleanText(cells[3]), "MDY");
    if (
      !approvedAt ||
      Number(approvedAt.slice(0, 4)) !== year ||
      Date.parse(approvedAt) > now
    )
      continue;
    const brand = cleanText(cells[1]);
    const inn = cleanText(cells[2]);
    if (!brand || !inn) continue;
    medicines.push({
      key: `${discoveryTerm(inn)}|${discoveryTerm(brand)}`,
      brand,
      inn,
      owner: "",
      indication: cleanText(cells[4].split(/<br\s*\/?\s*>/i)[0]).slice(0, 2400),
      area: "",
      orphan: false,
      advanced: false,
      reference: {
        authority: "US",
        sourceId: `novel-${year}-${discoveryTerm(brand)}`,
        url,
        approvedAt,
        owner: "",
      },
    });
  }
  if (!medicines.length)
    throw new Error(
      `FDA ${year}: no approval rows parsed; source requires review.`,
    );
  return medicines;
}
export type RegistryRow = {
  name: string;
  inn: string;
  form: string;
  strength: string;
  owner: string;
  record: string;
};
export function moleculeMatches(inn: string, brand: string, row: RegistryRow) {
  const normalize = (s: string) =>
    discoveryTerm(s)
      .replace(/\b\d+(?:\s+\d+)?\s*(?:mg|mcg|ml|g|iu|units)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const needle = normalize(inn);
  const hay = normalize(row.inn);
  if (needle.length < 4)
    return discoveryTerm(brand) === discoveryTerm(row.name);
  // Related salts/concentrations are contextual matches, never exact registration.
  return (
    hay === needle ||
    ` ${hay} `.includes(` ${needle} `) ||
    discoveryTerm(brand) === discoveryTerm(row.name)
  );
}
export function normalizedSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const k of [...url.searchParams.keys()])
      if (k.startsWith("utm_")) url.searchParams.delete(k);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
export function isPrimaryResearchUrl(value: string) {
  try {
    const h = new URL(value).hostname.toLowerCase();
    return ![
      "wikipedia.org",
      "linkedin.com",
      "facebook.com",
      "reddit.com",
      "drugs.com",
    ].some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function excerptIsSupported(excerpt: string, page: string) {
  const quote = discoveryTerm(excerpt);
  return (
    quote.split(" ").length >= 6 &&
    discoveryTerm(page.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")).includes(quote)
  );
}
export function claimScopeIsSupported(
  finding: {
    country: string;
    kind: string;
    claim: string;
    excerpt: string;
  },
  sourceText?: string,
) {
  const text = finding.excerpt;
  const normalizedPage = discoveryTerm(
    (sourceText ?? text).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
  );
  const position = normalizedPage.indexOf(discoveryTerm(text));
  const geography =
    position < 0
      ? text
      : normalizedPage.slice(
          Math.max(0, position - 250),
          position + discoveryTerm(text).length + 250,
        );
  if (
    /\bMASH\b|steatohepatitis/i.test(finding.claim) &&
    !/\bMASH\b|\bNASH\b|steatohepatitis/i.test(text)
  )
    return false;
  if (
    ["owner", "contact", "reference_status"].includes(finding.kind) &&
    finding.country === "Global"
  )
    return true;
  const countryPatterns: Record<string, RegExp> = {
    UAE: /\bUAE\b|United Arab Emirates|Dubai|Abu Dhabi/i,
    "Saudi Arabia": /Saudi|\bKSA\b/i,
    Egypt: /Egypt/i,
  };
  if (finding.country === "Regional")
    return /Middle East|North Africa|\bMENA\b|\bGCC\b|Gulf/i.test(geography);
  if (finding.country === "Global")
    return ["partner", "possible_partner"].includes(finding.kind);
  return countryPatterns[finding.country]?.test(geography) ?? false;
}

export type DiscoveryFinding = {
  country: string;
  kind: string;
  claim: string;
  excerpt: string;
  url: string;
  title: string;
};
export function verifiedShortExcerpt(excerpt: string, page: string) {
  const normalized = discoveryTerm(
    page.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
  );
  const segments = excerpt
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  let offset = 0;
  for (const segment of segments) {
    const token = discoveryTerm(segment);
    const index = normalized.indexOf(token, offset);
    if (!token || index < 0) return null;
    offset = index + token.length;
  }
  const longest = [...segments].sort(
    (a, b) => b.split(/\s+/).length - a.split(/\s+/).length,
  )[0];
  if (!longest || longest.split(/\s+/).length < 6) return null;
  return longest.split(/\s+/).slice(0, 25).join(" ");
}
export function verifyDiscoveryFindings<T extends DiscoveryFinding>(
  findings: T[],
  pages: Map<string, string>,
  medicine?: { brand: string; inn: string },
) {
  const accepted: T[] = [];
  const quotes = new Map<string, Set<string>>();
  const used = new Map<string, number>();
  const seen = new Set<string>();
  const rank: Record<string, number> = {
    partner: 0,
    possible_partner: 0,
    local_presence: 0,
    demand: 1,
    contact: 2,
    owner: 3,
    reference_status: 4,
  };
  for (let finding of [...findings].sort(
    (a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9),
  )) {
    const url = normalizedSourceUrl(finding.url);
    const page = url ? pages.get(url) : undefined;
    if (
      !url ||
      !page ||
      !isPrimaryResearchUrl(url) ||
      !finding.claim.trim() ||
      /not registered|no (?:local |regional |existing )?(?:partner|registration)|rights (?:are )?(?:available|free)|not available in|\[email.protected\]/i.test(
        finding.claim,
      )
    )
      continue;
    if (
      finding.kind === "owner" &&
      !/acquir|subsidiary|rights|licens|owned|develop|manufactur|commercial/i.test(
        finding.excerpt,
      )
    ) {
      if (/contact/i.test(url))
        finding = {
          ...finding,
          kind: "contact",
          country: "Global",
          claim:
            "Public company contact page; confirm the appropriate partnering team.",
        };
      else continue;
    }
    if (
      medicine &&
      ["partner", "local_presence"].includes(finding.kind) &&
      ![medicine.brand, medicine.inn].some(
        (term) =>
          term.length >= 3 && discoveryTerm(page).includes(discoveryTerm(term)),
      )
    ) {
      finding = {
        ...finding,
        kind: "possible_partner",
        claim:
          "A potentially relevant commercial relationship was found, but this source does not explicitly name the medicine. Product and territory scope require review.",
      };
    }
    const excerpt = verifiedShortExcerpt(finding.excerpt, page);
    if (!excerpt || !claimScopeIsSupported(finding, page)) continue;
    const key = `${url}|${finding.country}|${finding.claim}`;
    if (seen.has(key)) continue;
    const sourceQuotes = quotes.get(url) ?? new Set<string>();
    const words = sourceQuotes.has(excerpt) ? 0 : excerpt.split(/\s+/).length;
    if ((used.get(url) ?? 0) + words > 25) continue;
    sourceQuotes.add(excerpt);
    quotes.set(url, sourceQuotes);
    used.set(url, (used.get(url) ?? 0) + words);
    seen.add(key);
    accepted.push({
      ...finding,
      url,
      excerpt,
      claim: cleanText(finding.claim).slice(0, 1200),
      title: cleanText(finding.title).slice(0, 200),
    });
  }
  return accepted;
}
