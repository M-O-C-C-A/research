export function normalizeGapToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildGapDedupeKey(args: {
  therapeuticArea: string;
  indication: string;
  targetCountries: string[];
}) {
  const countries = [...new Set(args.targetCountries.map(normalizeGapToken))]
    .filter(Boolean)
    .sort();
  return [
    normalizeGapToken(args.therapeuticArea),
    normalizeGapToken(args.indication),
    countries.join("|"),
  ].join("::");
}

export function mergeUniqueStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

export function mergeMultilineText(existing?: string, incoming?: string) {
  const lines = mergeUniqueStrings([
    ...(existing ? existing.split("\n").map((line) => line.trim()) : []),
    ...(incoming ? incoming.split("\n").map((line) => line.trim()) : []),
  ]);
  return lines.length > 0 ? lines.join("\n") : undefined;
}
