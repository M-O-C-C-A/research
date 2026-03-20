import { StatsBar } from "@/components/dashboard/StatsBar";
import { RecentDrugs } from "@/components/dashboard/RecentDrugs";
import { RecentJobs } from "@/components/dashboard/RecentJobs";
import { TopGapsWidget } from "@/components/dashboard/TopGapsWidget";
import { BDPipelineWidget } from "@/components/dashboard/BDPipelineWidget";
import { PriorityMatchesWidget } from "@/components/dashboard/PriorityMatchesWidget";
import { ActionQueueWidget } from "@/components/dashboard/ActionQueueWidget";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import Link from "next/link";
import { Building2, Pill, ArrowRight, Radar, Target, GitBranch } from "lucide-react";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {BRAND_NAME} BD Cockpit
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {BRAND_TAGLINE}
          </p>
        </div>
        <DiscoverCompaniesButton />
      </div>

      <StatsBar />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <PriorityMatchesWidget />
        </div>
        <ActionQueueWidget />
      </div>

      {/* BD Cockpit widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TopGapsWidget />
        <BDPipelineWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent drugs — wide column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
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

          {/* Recent discovery jobs */}
          <RecentJobs />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href="/gaps"
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="rounded bg-cyan-500/10 p-1.5">
                  <Target className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Gap Analysis</p>
                  <p className="text-xs text-zinc-500">Find MENA supply gaps</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
              </Link>
              <Link
                href="/pipeline"
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="rounded bg-orange-500/10 p-1.5">
                  <GitBranch className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">BD Pipeline</p>
                  <p className="text-xs text-zinc-500">Manage company outreach</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
              </Link>
              <Link
                href="/discovery"
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="rounded bg-emerald-500/10 p-1.5">
                  <Radar className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    Discovery History
                  </p>
                  <p className="text-xs text-zinc-500">
                    View all scan runs and logs
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
              </Link>
              <Link
                href="/companies"
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-zinc-800 transition-colors"
              >
                <div className="rounded bg-blue-500/10 p-1.5">
                  <Building2 className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Companies</p>
                  <p className="text-xs text-zinc-500">
                    Browse the company registry
                  </p>
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
                  <p className="text-sm font-medium text-white">Drugs</p>
                  <p className="text-xs text-zinc-500">
                    Search & filter the drug registry
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
              </Link>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              BD Workflow
            </h2>
            <ol className="space-y-3">
              {[
                "Run Gap Analysis to find MENA unmet demand",
                "Discover EU companies that fill the gaps",
                "AI scores BD suitability per company",
                "Move companies through the BD pipeline",
                "Generate market reports with BD fit assessment",
                "Close partnership deals",
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-zinc-400"
                >
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
