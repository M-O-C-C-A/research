import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type WorkspaceRole = "admin" | "analyst" | "bd";

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  allowedRoles?: readonly WorkspaceRole[],
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required");

  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!member || !member.active) throw new Error("Workspace access required");
  if (allowedRoles && !allowedRoles.includes(member.role)) {
    throw new Error(`This action requires one of these roles: ${allowedRoles.join(", ")}`);
  }
  return member;
}
