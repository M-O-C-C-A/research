export type SalesObservation = {
  period: string;
  periodKind: "monthly" | "YTD" | "MAT";
  value?: number;
  units?: number;
  valueShare?: number;
  unitShare?: number;
};
/** Keeps overlapping monthly/YTD/MAT observations separate, including blank vs zero. */
export function parseEgyptSalesRow(row: Record<string, unknown>) {
  const fields = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/\s+/g, " ").trim(), v]),
  );
  const molecule = String(fields.Molecule ?? "").trim();
  const product = String(fields.Product ?? "").trim();
  if (!molecule || !product) return null;
  const periods = new Map<string, SalesObservation>();
  for (const [key, raw] of Object.entries(fields)) {
    const match = key.match(
      /^((?:(YTD|MAT) )?[A-Za-z]{3} \d{4}) (LC Value Market Share|Units Market Share|LC Value|Units)$/,
    );
    if (!match || raw === null || raw === undefined || raw === "") continue;
    const value =
      typeof raw === "number" ? raw : Number(String(raw).replaceAll(",", ""));
    if (!Number.isFinite(value))
      throw new Error(`Invalid sales value in ${key}`);
    const period = periods.get(match[1]) ?? {
      period: match[1],
      periodKind: (match[2] ?? "monthly") as SalesObservation["periodKind"],
    };
    const metric =
      match[3] === "LC Value"
        ? "value"
        : match[3] === "Units"
          ? "units"
          : match[3] === "LC Value Market Share"
            ? "valueShare"
            : "unitShare";
    period[metric] = value;
    periods.set(match[1], period);
  }
  return {
    molecule,
    product,
    atc4: String(fields.ATC4 ?? "").trim(),
    observations: [...periods.values()],
  };
}
