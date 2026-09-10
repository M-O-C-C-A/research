import {
  action,
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v, type Infer } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { accessEntry } from "./commercialAssessmentValidators";
import { checkAssessmentSources } from "./sourceAccessPolicy";
import type {
  RegisteredMutation,
  RegisteredAction,
  RegisteredQuery,
} from "convex/server";
import { requireMember } from "./authz";

type AccessArgs = { opportunityId?: Id<"decisionOpportunities"> };
type RecordArgs = AccessArgs & {
  entries: Infer<typeof accessEntry>[];
  startedAt: number;
};
export const record: RegisteredMutation<
  "internal",
  RecordArgs,
  Promise<Id<"sourceAccessLogs">>
> = internalMutation({
  args: {
    opportunityId: v.optional(v.id("decisionOpportunities")),
    entries: v.array(accessEntry),
    startedAt: v.number(),
  },
  returns: v.id("sourceAccessLogs"),
  handler: async (
    ctx: MutationCtx,
    args: {
      opportunityId?: Id<"decisionOpportunities">;
      entries: Infer<typeof accessEntry>[];
      startedAt: number;
    },
  ): Promise<Id<"sourceAccessLogs">> =>
    await ctx.db.insert("sourceAccessLogs", {
      ...args,
      completedAt: Date.now(),
    }),
});
export const run: RegisteredAction<
  "public",
  AccessArgs,
  Promise<Id<"sourceAccessLogs">>
> = action({
  args: { opportunityId: v.optional(v.id("decisionOpportunities")) },
  returns: v.id("sourceAccessLogs"),
  handler: async (
    ctx: ActionCtx,
    args: { opportunityId?: Id<"decisionOpportunities"> },
  ): Promise<Id<"sourceAccessLogs">> => {
    const startedAt = Date.now();
    const entries = await checkAssessmentSources();
    return await ctx.runMutation(internal.sourceAccess.record, {
      ...args,
      entries,
      startedAt,
    });
  },
});
export const latest: RegisteredQuery<
  "public",
  AccessArgs,
  Promise<Doc<"sourceAccessLogs"> | null>
> = query({
  args: { opportunityId: v.optional(v.id("decisionOpportunities")) },
  returns: v.any(),
  handler: async (
    ctx: QueryCtx,
    args: { opportunityId?: Id<"decisionOpportunities"> },
  ): Promise<Doc<"sourceAccessLogs"> | null> => {
    await requireMember(ctx);
    return (
      (
        await ctx.db
          .query("sourceAccessLogs")
          .withIndex("by_opportunity", (q) =>
            q.eq("opportunityId", args.opportunityId),
          )
          .order("desc")
          .take(1)
      )[0] ?? null
    );
  },
});
