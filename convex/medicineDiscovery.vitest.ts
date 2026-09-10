// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import {
  dateFromParts,
  parseEmaMedicines,
  parseFdaNovel,
  moleculeMatches,
  normalizedSourceUrl,
  excerptIsSupported,
  claimScopeIsSupported,
} from "./medicineDiscoveryPolicy";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.vitest.ts"]);
const source = {
  category: "Human",
  medicine_status: "Authorised",
  generic: "No",
  biosimilar: "No",
  name_of_medicine: "Example",
  international_non_proprietary_name_common_name: "example ingredient",
  marketing_authorisation_date: "01/03/2024",
  european_commission_decision_date: "01/07/2026",
  medicine_url: "https://www.ema.europa.eu/en/medicines/human/EPAR/example",
  ema_product_number: "example",
  marketing_authorisation_developer_applicant_holder: "Example Pharma",
};
function feed(rows: Record<string, string>[]) {
  const data = [
    ...rows,
    ...Array.from({ length: 100 }, () => ({
      ...source,
      category: "Veterinary",
    })),
  ];
  return { meta: { total_records: data.length }, data };
}
describe("new medicine discovery", () => {
  it("uses original authorisation date, excluding old medicines with new variations", () => {
    const result = parseEmaMedicines(
      feed([
        source,
        {
          ...source,
          name_of_medicine: "Old",
          marketing_authorisation_date: "01/03/2017",
        },
      ]),
      2023,
      Date.UTC(2026, 8, 10),
    );
    expect(result.medicines.map((x) => x.brand)).toEqual(["Example"]);
  });
  it("excludes non-authorised, generic, biosimilar and future approvals", () => {
    const result = parseEmaMedicines(
      feed([
        { ...source, medicine_status: "Withdrawn" },
        { ...source, generic: "Yes" },
        { ...source, biosimilar: "Yes" },
        { ...source, marketing_authorisation_date: "01/01/2027" },
      ]),
      2023,
      Date.UTC(2026, 8, 10),
    );
    expect(result.medicines).toHaveLength(0);
  });
  it("rejects feed truncation and invalid dates", () => {
    expect(() =>
      parseEmaMedicines(
        { meta: { total_records: 1000 }, data: [source] },
        2023,
      ),
    ).toThrow();
    expect(dateFromParts("31/02/2025", "DMY")).toBeNull();
  });
  it("parses FDA approval facts without inferring an owner or current availability", () => {
    const html =
      '<table><tr><td>1.</td><td><a href="/label">Example</a></td><td>example</td><td>3/4/2025</td><td>To treat disease<br>Snapshot</td></tr></table>';
    expect(
      parseFdaNovel(
        html,
        "https://www.fda.gov/list",
        2025,
        Date.UTC(2026, 8, 10),
      )[0],
    ).toMatchObject({
      brand: "Example",
      owner: "",
      indication: "To treat disease",
      reference: { authority: "US", approvedAt: "2025-03-04" },
    });
    expect(() =>
      parseFdaNovel("<h1>Access denied</h1>", "https://www.fda.gov/list", 2025),
    ).toThrow();
  });
  it("finds related formulations while avoiding substring collisions", () => {
    const row = {
      name: "Other",
      inn: "LEVETIRACETAM (250 MG)",
      form: "film coated tablet",
      strength: "250 mg",
      owner: "Other owner",
      record: "1",
    };
    expect(moleculeMatches("levetiracetam", "Keppra", row)).toBe(true);
    expect(
      moleculeMatches("citinib", "Other brand", { ...row, inn: "tofacitinib" }),
    ).toBe(false);
  });
  it("normalizes citation tracking and rejects non-http routes", () => {
    expect(
      normalizedSourceUrl("https://example.com/news/?utm_source=x#section"),
    ).toBe("https://example.com/news");
    expect(normalizedSourceUrl("javascript:alert(1)")).toBeNull();
  });
  it("merges EU and US evidence idempotently without losing the known owner or shortlist", async () => {
    const t = convexTest(schema, modules);
    const medicine = parseEmaMedicines(
      feed([source]),
      2023,
      Date.UTC(2026, 8, 10),
    ).medicines[0];
    await t.mutation(internal.medicineDiscovery.ingest, {
      medicines: [{ medicine, markets: [] }],
    });
    const first = await t.run((ctx) =>
      ctx.db.query("medicineDiscoveries").first(),
    );
    await t.run((ctx) =>
      ctx.db.patch(first!._id, { disposition: "shortlisted" }),
    );
    const us = {
      ...medicine,
      owner: "",
      reference: {
        ...medicine.reference,
        authority: "US" as const,
        owner: "",
        approvedAt: "2023-10-01",
      },
    };
    for (let i = 0; i < 2; i++)
      await t.mutation(internal.medicineDiscovery.ingest, {
        medicines: [{ medicine: us, markets: [] }],
      });
    const result = await t.run((ctx) =>
      ctx.db.query("medicineDiscoveries").take(10),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      owner: "Example Pharma",
      firstApprovalDate: "2023-10-01",
      disposition: "shortlisted",
      researchStatus: "not_started",
    });
    expect(result[0].references).toHaveLength(2);
  });
  it("distinguishes a failed refresh from no admissible evidence", async () => {
    const t = convexTest(schema, modules);
    const medicine = parseEmaMedicines(
      feed([source]),
      2023,
      Date.UTC(2026, 8, 10),
    ).medicines[0];
    await t.mutation(internal.medicineDiscovery.ingest, {
      medicines: [{ medicine, markets: [] }],
    });
    const row = await t.run((ctx) =>
      ctx.db.query("medicineDiscoveries").first(),
    );
    await t.mutation(internal.medicineDiscovery.saveResearch, {
      id: row!._id,
      claims: [],
      warnings: [],
    });
    expect(
      (await t.query(internal.medicineDiscovery.getInternal, { id: row!._id }))
        .researchStatus,
    ).toBe("no_findings");
    await t.mutation(internal.medicineDiscovery.saveResearch, {
      id: row!._id,
      claims: [],
      warnings: [],
      error: "Source unavailable",
    });
    expect(
      (await t.query(internal.medicineDiscovery.getInternal, { id: row!._id }))
        .researchStatus,
    ).toBe("error");
  });
});

describe("source verification", () => {
  it("requires a real contiguous source excerpt", () => {
    expect(
      excerptIsSupported(
        "The agreement covers Saudi Arabia and Egypt",
        "The agreement covers Saudi Arabia and Egypt, with approvals pending.",
      ),
    ).toBe(true);
    expect(
      excerptIsSupported(
        "The agreement covers all countries in MENA",
        "The agreement covers Saudi Arabia and Egypt.",
      ),
    ).toBe(false);
  });
  it("does not turn a European deal into a MENA partner finding", () => {
    expect(
      claimScopeIsSupported({
        country: "Regional",
        kind: "partner",
        claim: "European deal",
        excerpt:
          "Distribution across a broad multi-country territory in Europe",
      }),
    ).toBe(false);
    expect(
      claimScopeIsSupported({
        country: "Global",
        kind: "partner",
        claim: "European deal",
        excerpt:
          "Distribution across a broad multi-country territory in Europe",
      }),
    ).toBe(true);
  });
  it("does not relabel broad fatty-liver prevalence as MASH", () => {
    expect(
      claimScopeIsSupported({
        country: "Saudi Arabia",
        kind: "demand",
        claim: "MASH prevalence increased in Saudi Arabia",
        excerpt: "MASLD prevalence increased in the Saudi Arabia population",
      }),
    ).toBe(false);
  });
});

it("runs one research action at a time without losing queued medicines", async () => {
  const t = convexTest(schema, modules);
  const a = parseEmaMedicines(feed([source]), 2023, Date.UTC(2026, 8, 10))
    .medicines[0];
  await t.mutation(internal.medicineDiscovery.ingest, {
    medicines: [
      { medicine: a, markets: [] },
      { medicine: { ...a, key: "second", brand: "Second" }, markets: [] },
    ],
  });
  const rows = await t.run((ctx) =>
    ctx.db.query("medicineDiscoveries").take(2),
  );
  await t.run(async (ctx) => {
    for (const r of rows)
      await ctx.db.patch(r._id, { researchStatus: "queued" });
  });
  expect(
    await t.mutation(internal.medicineDiscovery.markResearchRunning, {
      id: rows[0]._id,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.medicineDiscovery.markResearchRunning, {
      id: rows[1]._id,
    }),
  ).toBe(false);
  expect(
    (await t.query(internal.medicineDiscovery.getInternal, { id: rows[1]._id }))
      .researchStatus,
  ).toBe("queued");
  await t.mutation(internal.medicineDiscovery.saveResearch, {
    id: rows[0]._id,
    claims: [],
    warnings: [],
  });
  expect(
    await t.mutation(internal.medicineDiscovery.markResearchRunning, {
      id: rows[1]._id,
    }),
  ).toBe(true);
});
