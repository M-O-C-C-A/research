import { mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireMember } from "./authz";
import { shortlistBlockers } from "./medicineDiscoveryReviewPolicy";

export const NEWBRIDGE_SIGNAL = {
  country: "Regional" as const,
  kind: "possible_partner" as const,
  claim:
    "NewBridge and Madrigal announced a MENA distribution agreement on 30 March 2026. The announcement does not name Rezdiffra or individual countries; product coverage, UAE scope and rights remain unresolved.",
  excerpt:
    "NewBridge Pharmaceuticals and Madrigal Pharmaceuticals entered into a distribution agreement for the MENA region",
  url: "https://nbpharma.com/news/details/53",
  title: "NewBridge–Madrigal MENA distribution announcement · 30 March 2026",
  verification: "page_excerpt_verified" as const,
};

export const XOLREMDI_SIGNALS = (["UAE", "Saudi Arabia", "Egypt"] as const).map(
  (country) => ({
    country,
    kind: "partner" as const,
    claim: `X4 and taiba rare announced an exclusive distribution and commercialization agreement for Xolremdi covering ${country} on 19 February 2025, following any regional approvals. This does not establish current registration or supply.`,
    excerpt:
      "Agreement covers Saudi Arabia, United Arab Emirates, Qatar, Oman, Kuwait, Bahrain, and Egypt",
    url: "https://investors.x4pharma.com/news-releases/news-release-details/x4-pharmaceuticals-and-taiba-rare-announce-exclusive-agreement",
    title: "X4–taiba rare Xolremdi agreement · 19 February 2025",
    verification: "page_excerpt_verified" as const,
  }),
);

export const correctPage = mutation({
  args: {
    paginationOpts: paginationOptsValidator,
    dryRun: v.boolean(),
    expectedFingerprint: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin"]);
    const result = await ctx.db
      .query("medicineDiscoveries")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(25, args.paginationOpts.numItems),
      });
    const changes = result.page.flatMap((m) => {
      const expected = /\bresmetirom\b/i.test(m.inn)
        ? [NEWBRIDGE_SIGNAL]
        : /\bmavorixafor\b/i.test(m.inn)
          ? XOLREMDI_SIGNALS
          : [];
      const additions = expected.filter(
        (s) =>
          !m.reviewSignals?.some(
            (c) => c.url === s.url && c.country === s.country,
          ),
      );
      const addSignal = additions.length > 0;
      const demote =
        m.disposition === "shortlisted" &&
        (addSignal ||
          shortlistBlockers(m, m.shortlistCountry ?? "UAE").length > 0);
      return addSignal || demote
        ? [
            {
              id: m._id,
              brand: m.brand,
              updatedAt: m.updatedAt,
              previousDisposition: m.disposition,
              addSignal,
              additions,
              demote,
            },
          ]
        : [];
    });
    const fingerprint = JSON.stringify(changes);
    if (!args.dryRun) {
      if (args.expectedFingerprint !== fingerprint)
        throw new Error(
          "Correction preview changed; preview again before applying.",
        );
      for (const change of changes) {
        const m = await ctx.db.get(change.id);
        if (!m) continue;
        await ctx.db.insert("medicineResearchCorrections", {
          medicineId: m._id,
          correctedAt: Date.now(),
          previousDisposition: m.disposition,
          note: change.addSignal
            ? change.additions.map((c) => c.claim).join(" ")
            : "Earlier shortlist returned to research candidates: current commercial review requirements were not satisfied.",
          ...(change.addSignal ? { sourceUrl: change.additions[0].url } : {}),
        });
        await ctx.db.patch(m._id, {
          ...(change.addSignal
            ? {
                reviewSignals: [
                  ...(m.reviewSignals ?? []),
                  ...change.additions.map((c) => ({
                    ...c,
                    observedAt: Date.now(),
                  })),
                ],
              }
            : {}),
          ...(change.demote
            ? { disposition: "new" as const, shortlistCountry: undefined }
            : {}),
          updatedAt: Date.now(),
        });
      }
    }
    return {
      changes,
      fingerprint,
      affected: changes.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
