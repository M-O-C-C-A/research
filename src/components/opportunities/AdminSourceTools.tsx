"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ContinuousOpportunityDashboard } from "./ContinuousOpportunityDashboard";
import { RebuildOpportunityEngineButton } from "./RebuildOpportunityEngineButton";

export function AdminSourceTools() {
  const member = useQuery(api.workspaceMembers.current);
  if (member?.role !== "admin") return null;
  return <div className="space-y-6"><ContinuousOpportunityDashboard /><div className="flex gap-3"><RebuildOpportunityEngineButton /><Link href="/discovery" className="py-2 text-sm text-[var(--brand-300)]">Open raw research jobs</Link></div></div>;
}
