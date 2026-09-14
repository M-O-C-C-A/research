// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import {
  RESEARCH_CHECKS,
  researchReviewBlockers,
  shortlistBlockers,
  reviewBasis,
  ownerAgreementSignals,
  commercialSignals,
} from "./medicineDiscoveryReviewPolicy";
import {
  NEWBRIDGE_SIGNAL,
  XOLREMDI_SIGNALS,
} from "./medicineDiscoveryCorrections";
import { verifyDiscoveryFindings } from "./medicineDiscoveryPolicy";
import type { Doc } from "./_generated/dataModel";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.vitest.ts"]);
function candidate() {
  const now = Date.now();
  return {
    key: "resmetirom|rezdiffra",
    brand: "Rezdiffra",
    inn: "resmetirom",
    owner: "Madrigal Pharmaceuticals EU Limited",
    indication: "MASH",
    area: "Liver",
    orphan: false,
    advanced: false,
    references: [],
    firstApprovalDate: "2024-03-14",
    markets: [
      {
        country: "UAE",
        status: "no_molecule_match",
        matches: [],
        checkedAt: now,
      },
    ],
    priority: 30,
    researchStatus: "completed",
    researchedAt: now,
    researchPolicyVersion: 2,
    researchChecks: RESEARCH_CHECKS.map((c) => ({
      key: c.key,
      label: c.label,
      query: c.task,
      status: "completed",
      sources: ["https://example.org/source"],
      retrievedSources: ["https://example.org/source"],
      checkedAt: now,
      detail: "Retrieved",
    })),
    claims: ["demand", "contact"].map((kind) => ({
      country: kind === "demand" ? "UAE" : "Global",
      kind,
      claim: "Source-backed evidence",
      excerpt: "Evidence excerpt from the original source text",
      url: "https://example.org/source",
      title: "Evidence",
      observedAt: now,
      verification: "page_excerpt_verified",
    })),
    disposition: "new",
    checkedAt: now,
    createdAt: now,
    updatedAt: now,
  } as Omit<Doc<"medicineDiscoveries">, "_id" | "_creationTime">;
}
async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run(async (ctx) => {
    await ctx.db.insert("workspaceMembers", {
      openKey: "default",
      email: "review@example.org",
      role: "admin",
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return ctx.db.insert("medicineDiscoveries", candidate());
  });
  return { t, id };
}
function reviewArgs(m: ReturnType<typeof candidate>) {
  return {
    country: "UAE" as const,
    expectedBasis: reviewBasis(m),
    reviewer: "Test analyst",
    registrationNote:
      "Exact UAE registration position reviewed against the dated official source; limitations are recorded.",
    rightsNote:
      "Reviewed country and product scope with supporting evidence; the documented commercial route is viable.",
    rationale:
      "A specific customer segment and differentiated access route support a commercial investigation in UAE.",
    evidenceUrls: ["https://example.org/review"],
    resolvedSignalUrls: [] as string[],
  };
}
describe("commercial qualification benchmark", () => {
  it("keeps a plausible source-backed candidate out of shortlist until an analyst reviews it", () => {
    const m = candidate();
    expect(researchReviewBlockers(m, "UAE")).toEqual([]);
    expect(shortlistBlockers(m, "UAE")).not.toEqual([]);
  });
  it.each(RESEARCH_CHECKS)(
    "blocks a failed $key check even when need/contact findings succeeded",
    (check) => {
      const m = candidate();
      m.researchChecks!.find((c) => c.key === check.key)!.status = "failed";
      expect(researchReviewBlockers(m, "UAE").join(" ")).toContain(check.label);
    },
  );
  it.each(["unresolved", "failed"] as const)(
    "blocks %s disqualification search",
    (status) => {
      const m = candidate();
      m.researchChecks!.at(-1)!.status = status;
      expect(researchReviewBlockers(m, "UAE")).not.toEqual([]);
    },
  );
  it("does not grandfather legacy or stale research", () => {
    const m = candidate();
    delete m.researchPolicyVersion;
    expect(researchReviewBlockers(m, "UAE")).not.toEqual([]);
    m.researchPolicyVersion = 2;
    m.researchedAt = Date.now() - 15 * 86400_000;
    expect(researchReviewBlockers(m, "UAE")).not.toEqual([]);
  });
  it("does not transfer UAE demand or approval to Saudi Arabia", () => {
    expect(researchReviewBlockers(candidate(), "Saudi Arabia")).not.toEqual([]);
  });
  it("retains the NewBridge owner-level deal without asserting Rezdiffra or UAE registration", () => {
    const page =
      "On March 30, 2026, NewBridge Pharmaceuticals and Madrigal Pharmaceuticals entered into a distribution agreement for the MENA region, reinforcing a shared commitment to improving access.";
    const signals = ownerAgreementSignals(
      candidate(),
      new Map([[NEWBRIDGE_SIGNAL.url, page]]),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe("possible_partner");
    expect(signals[0].claim).not.toMatch(
      /registered|exclusive|rights are free/,
    );
    expect(
      verifyDiscoveryFindings(
        [NEWBRIDGE_SIGNAL],
        new Map([[NEWBRIDGE_SIGNAL.url, page]]),
      ),
    ).toHaveLength(1);
  });
  it("retains Xolremdi's explicitly named country scope without inferring registration", () => {
    const page =
      "X4 Pharmaceuticals and taiba rare announce an exclusive Xolremdi agreement. Agreement covers Saudi Arabia, United Arab Emirates, Qatar, Oman, Kuwait, Bahrain, and Egypt";
    const findings = verifyDiscoveryFindings(
      XOLREMDI_SIGNALS,
      new Map([[XOLREMDI_SIGNALS[0].url, page]]),
    );
    expect(findings.map((f) => f.country)).toEqual([
      "UAE",
      "Saudi Arabia",
      "Egypt",
    ]);
  });
  it("keeps an existing local listing separate from commercial qualification", () => {
    const m = candidate();
    m.markets[0].status = "molecule_listed";
    expect(shortlistBlockers(m, "UAE")).not.toEqual([]);
  });
  it("downgrades an extracted product partnership when the original source only names the owner", () => {
    const finding = {
      ...NEWBRIDGE_SIGNAL,
      kind: "partner",
      claim: "Rezdiffra has an exclusive MENA partner.",
    };
    const result = verifyDiscoveryFindings(
      [finding],
      new Map([[finding.url, finding.excerpt]]),
      candidate(),
    );
    expect(result[0].kind).toBe("possible_partner");
    expect(result[0].claim).not.toContain("exclusive");
  });
  it("does not broaden an Egypt-only owner agreement to the whole region", () => {
    const signals = ownerAgreementSignals(
      candidate(),
      new Map([
        [
          "https://example.org/deal",
          "Madrigal signed a distribution agreement in Egypt for its portfolio.",
        ],
      ]),
    );
    expect(signals.map((s) => s.country)).toEqual(["Egypt"]);
    expect(
      commercialSignals({ ...candidate(), reviewSignals: signals }, "UAE"),
    ).toEqual([]);
  });
  it("stores partial coverage as partial, never completed", async () => {
    const { t, id } = await setup();
    const m = candidate();
    m.researchChecks![0].status = "failed";
    await t.mutation(internal.medicineDiscovery.saveResearch, {
      id,
      claims: m.claims,
      warnings: [],
      checks: m.researchChecks,
      policyVersion: 2,
    });
    expect(
      (await t.query(internal.medicineDiscovery.getInternal, { id }))
        .researchStatus,
    ).toBe("partial");
  });
  it("recovers a timed-out research run even when the queue is empty", async () => {
    const { t, id } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(id, {
        researchStatus: "running",
        researchStartedAt: Date.now() - 11 * 60_000,
      }),
    );
    await t.mutation(internal.medicineDiscovery.processResearchQueue, {});
    const m = await t.query(internal.medicineDiscovery.getInternal, { id });
    expect(m.researchStatus).toBe("error");
    expect(m.claims).toHaveLength(2);
  });
  it("does not turn a European deal with a separate MENA company footprint into a regional deal", () => {
    const page =
      "Madrigal entered into a distribution agreement for Europe. Swixx also operates in the Middle East.";
    expect(
      ownerAgreementSignals(
        candidate(),
        new Map([["https://example.org", page]]),
      ),
    ).toEqual([]);
  });
  it.each(["partner", "possible_partner", "local_presence"] as const)(
    "surfaces %s even when snapshot has no match",
    (kind) => {
      const m = candidate();
      m.claims.push({ ...NEWBRIDGE_SIGNAL, kind, observedAt: Date.now() });
      expect(commercialSignals(m, "UAE")).toHaveLength(1);
    },
  );
  it("rejects direct shortlist mutation without review", async () => {
    const { t, id } = await setup();
    await expect(
      t.mutation(api.medicineDiscovery.setDisposition, {
        id,
        country: "UAE",
        disposition: "shortlisted",
      }),
    ).rejects.toThrow(/commercial review/);
  });
  it("requires explicit resolution of every warning before recording review", async () => {
    const { t, id } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(id, {
        reviewSignals: [{ ...NEWBRIDGE_SIGNAL, observedAt: Date.now() }],
      }),
    );
    const m = await t.query(internal.medicineDiscovery.getInternal, { id });
    await expect(
      t.mutation(api.medicineDiscovery.recordCommercialReview, {
        id,
        ...reviewArgs(m),
      }),
    ).rejects.toThrow(/every relevant/);
    await t.mutation(api.medicineDiscovery.recordCommercialReview, {
      id,
      ...reviewArgs(m),
      resolvedSignalUrls: [NEWBRIDGE_SIGNAL.url],
    });
    await t.mutation(api.medicineDiscovery.setDisposition, {
      id,
      country: "UAE",
      disposition: "shortlisted",
    });
    expect(
      (await t.query(internal.medicineDiscovery.getInternal, { id }))
        .disposition,
    ).toBe("shortlisted");
  });
  it("invalidates a review after new evidence and preserves the review history", async () => {
    const { t, id } = await setup();
    const m = await t.query(internal.medicineDiscovery.getInternal, { id });
    await t.mutation(api.medicineDiscovery.recordCommercialReview, {
      id,
      ...reviewArgs(m),
    });
    await t.mutation(api.medicineDiscovery.setDisposition, {
      id,
      country: "UAE",
      disposition: "shortlisted",
    });
    await t.mutation(internal.medicineDiscovery.saveResearch, {
      id,
      claims: m.claims,
      warnings: [],
      checks: m.researchChecks,
      policyVersion: 2,
      signals: [{ ...NEWBRIDGE_SIGNAL, observedAt: Date.now() }],
    });
    await expect(
      t.mutation(api.medicineDiscovery.setDisposition, {
        id,
        country: "UAE",
        disposition: "shortlisted",
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("medicineCommercialReviews").take(10)),
    ).toHaveLength(1);
    await t.mutation(internal.medicineDiscovery.saveResearch, {
      id,
      claims: [],
      warnings: [],
      error: "Provider unavailable",
    });
    expect(
      (await t.query(internal.medicineDiscovery.getInternal, { id }))
        .reviewSignals,
    ).toHaveLength(1);
  });
  it("rejects stale review submission", async () => {
    const { t, id } = await setup();
    const m = await t.query(internal.medicineDiscovery.getInternal, { id });
    await t.run((ctx) => ctx.db.patch(id, { owner: "New Owner" }));
    await expect(
      t.mutation(api.medicineDiscovery.recordCommercialReview, {
        id,
        ...reviewArgs(m),
      }),
    ).rejects.toThrow(/Evidence changed/);
  });
  it("previews corrections, rejects changed previews, preserves history and applies idempotently", async () => {
    const { t, id } = await setup();
    await t.run((ctx) => ctx.db.patch(id, { disposition: "shortlisted" }));
    const args = { paginationOpts: { cursor: null, numItems: 25 } };
    const preview = await t.mutation(
      api.medicineDiscoveryCorrections.correctPage,
      { ...args, dryRun: true },
    );
    expect(preview.affected).toBe(1);
    await expect(
      t.mutation(api.medicineDiscoveryCorrections.correctPage, {
        ...args,
        dryRun: false,
        expectedFingerprint: "stale",
      }),
    ).rejects.toThrow();
    await t.mutation(api.medicineDiscoveryCorrections.correctPage, {
      ...args,
      dryRun: false,
      expectedFingerprint: preview.fingerprint,
    });
    expect(
      (await t.query(internal.medicineDiscovery.getInternal, { id }))
        .disposition,
    ).toBe("new");
    expect(
      (
        await t.mutation(api.medicineDiscoveryCorrections.correctPage, {
          ...args,
          dryRun: true,
        })
      ).affected,
    ).toBe(0);
    expect(
      await t.run((ctx) =>
        ctx.db.query("medicineResearchCorrections").take(10),
      ),
    ).toHaveLength(1);
  });
});
