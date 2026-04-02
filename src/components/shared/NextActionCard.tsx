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
    <div className="rounded-2xl border border-[color:var(--brand-border)] bg-gradient-to-br from-[color:var(--brand-surface-strong)] via-zinc-900 to-zinc-950 p-6 shadow-[0_24px_80px_-48px_var(--brand-glow)]">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            {label}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{description}</p>
        </div>
        <div className="hidden rounded-full bg-[color:var(--brand-surface)] p-3 text-[var(--brand-300)] sm:block">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--brand-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--brand-600)]"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
