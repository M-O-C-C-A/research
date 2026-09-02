import { DecisionOpportunityCards } from "./DecisionOpportunityCards";
import { EvidenceFunnelDashboard } from "./EvidenceFunnelDashboard";
import { AdminSourceTools } from "./AdminSourceTools";

export function OpportunityWorkbench() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <EvidenceFunnelDashboard />
      <details className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Historical screening and decision views</summary>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">Read-only comparison during migration. These views support the canonical funnel; they do not determine contact readiness.</p>
        <div className="mt-6 space-y-8"><AdminSourceTools /><DecisionOpportunityCards title="Historical shortlist" description="Legacy cards retained until migration parity is verified." /></div>
      </details>
    </main>
  );
}
