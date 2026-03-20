"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatsSkeleton } from "@/components/shared/LoadingSkeleton";
import Link from "next/link";
import { Building2, Pill, TrendingUp } from "lucide-react";

export function StatsBar() {
  const companyStats = useQuery(api.companies.stats, {});
  const drugStats = useQuery(api.drugs.stats, {});
  const oppStats = useQuery(api.opportunities.stats, {});

  if (!companyStats || !drugStats || !oppStats) return <StatsSkeleton />;

  const stats = [
    {
      label: "Companies Tracked",
      value: companyStats.total,
      icon: Building2,
      href: "/companies",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Drugs in Registry",
      value: drugStats.total,
      icon: Pill,
      href: "/drugs",
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "High-Opportunity Markets",
      value: oppStats.highOpportunity,
      icon: TrendingUp,
      href: "/drugs",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      sublabel: `of ${oppStats.total} assessed`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3 mb-8">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-500">{stat.label}</p>
              <p className="mt-1.5 text-3xl font-bold text-white tabular-nums">
                {stat.value}
              </p>
              {stat.sublabel && (
                <p className="mt-0.5 text-xs text-zinc-600">{stat.sublabel}</p>
              )}
            </div>
            <div className={`rounded-lg p-2.5 ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
