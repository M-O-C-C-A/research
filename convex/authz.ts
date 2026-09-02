import type { MutationCtx, QueryCtx } from "./_generated/server";

export type WorkspaceRole = "admin" | "analyst" | "bd";

export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  allowedRoles?: readonly WorkspaceRole[],
) {
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_open_key", (q) => q.eq("openKey", "default"))
    .unique();
  if (!member || !member.active) throw new Error("Open workspace is not initialized");
  if (allowedRoles && !allowedRoles.includes(member.role)) {
    throw new Error(`This action requires one of these roles: ${allowedRoles.join(", ")}`);
  }
  return member;
}
