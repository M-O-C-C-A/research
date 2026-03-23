"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface NextActionCardProps {
  label?: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export function NextActionCard({
  label = "Recommended Next Action",
  title,
  description,
  href,
  actionLabel,
}: NextActionCardProps) {
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-zinc-900 to-zinc-950 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            {label}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{description}</p>
        </div>
        <div className="hidden rounded-full bg-cyan-500/10 p-3 text-cyan-300 sm:block">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
