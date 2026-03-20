import { StatsBar } from "@/components/dashboard/StatsBar";
import { RecentDrugs } from "@/components/dashboard/RecentDrugs";
import Link from "next/link";
import { Building2, Pill, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Market Intelligence Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          European pharma → MENA market opportunities
        </p>
      </div>

      <StatsBar />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent drugs */}
        <div className="lg:col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Drug Registry
            </h2>
            <Link
              href="/drugs"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <RecentDrugs />
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href="/companies"
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="rounded bg-blue-500/10 p-1.5">
                  <Building2 className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Add Company</p>
                  <p className="text-xs text-zinc-500">Register a European pharma company</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
              </Link>
              <Link
                href="/drugs"
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="rounded bg-violet-500/10 p-1.5">
                  <Pill className="h-4 w-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Browse Drugs</p>
                  <p className="text-xs text-zinc-500">Search & filter the drug registry</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              How It Works
            </h2>
            <ol className="space-y-3">
              {[
                "Add European pharma companies",
                "Register their drugs with full profiles",
                "Score MENA market opportunities per country",
                "Generate AI market intelligence reports",
                "Prioritise outreach and start sales cycles",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-500">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
