"use client";

import { StatsSkeleton } from "@/components/shared/LoadingSkeleton";
import Link from "next/link";
import { Building2, Pill, TrendingUp, GitBranch } from "lucide-react";

interface StatsBarProps {
  snapshot?: {
    companyCount: number;
    productCount: number;
    opportunityCount: number;
    activeOutreachCount: number;
  };
  needsValidationCount?: number;
}

export function StatsBar({ snapshot, needsValidationCount = 0 }: StatsBarProps) {
  if (!snapshot) return <StatsSkeleton />;

  const stats = [
    {
      label: "Companies Tracked",
      value: snapshot.companyCount,
      icon: Building2,
      href: "/companies",
      color: "text-[var(--brand-300)]",
      bg: "bg-[color:var(--brand-surface)]",
    },
    {
      label: "Drugs in Registry",
      value: snapshot.productCount,
      icon: Pill,
      href: "/drugs",
      color: "text-[var(--brand-300)]",
      bg: "bg-[color:var(--brand-surface)]",
    },
    {
      label: "Decision Opportunities",
      value: snapshot.opportunityCount,
      icon: TrendingUp,
      href: "/gaps",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      sublabel: `${needsValidationCount} need validation`,
    },
    {
      label: "Distributor Pipeline",
      value: snapshot.activeOutreachCount,
      icon: GitBranch,
      href: "/pipeline",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      sublabel: "qualified through negotiating",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
