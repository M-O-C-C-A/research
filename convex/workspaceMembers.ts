import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./authz";

const role = v.union(v.literal("admin"), v.literal("analyst"), v.literal("bd"));

export const ensureCurrent = mutation({
  args: {},
  returns: v.object({
    memberId: v.id("workspaceMembers"),
    role,
    email: v.string(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return { memberId: existing._id, role: existing.role, email: existing.email };

    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase() ?? `open-${userId}@kemedica.local`;
    // The private link is intentionally open. Anonymous identities exist only
    // so assignments and activity attribution keep working without a login UI.
    const assignedRole = "admin" as const;
    const now = Date.now();
    const memberId = await ctx.db.insert("workspaceMembers", {
      userId,
      email,
      name: user?.name ?? "Open workspace user",
      role: assignedRole,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return { memberId, role: assignedRole, email };
  },
});

export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      memberId: v.id("workspaceMembers"),
      role,
      email: v.string(),
      name: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!member || !member.active) return null;
    return { memberId: member._id, role: member.role, email: member.email, name: member.name };
  },
});

export const listAssignable = query({
  args: {},
  returns: v.array(v.object({
    memberId: v.id("workspaceMembers"),
    role,
    email: v.string(),
    name: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    await requireMember(ctx, ["admin", "analyst", "bd"]);
    const members = await ctx.db.query("workspaceMembers").take(100);
    return members.filter((member) => member.active).map((member) => ({
      memberId: member._id,
      role: member.role,
      email: member.email,
      name: member.name,
    }));
  },
});

export const setRole = mutation({
  args: { memberId: v.id("workspaceMembers"), role, active: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMember(ctx, ["admin"]);
    await ctx.db.patch(args.memberId, {
      role: args.role,
      ...(args.active === undefined ? {} : { active: args.active }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const assertAdminForAction = query({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireMember(ctx, ["admin"]);
    return null;
  },
});
