"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowRight, CheckCircle2, Clock3, Mail } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

export function HomeDashboard() {
  const stats = useQuery(api.actionableLeads.stats, {});
  const leads = useQuery(api.actionableLeads.list, { limit: 5 });

  return (
    <div className="space-y-8">
      <section className="border-b border-zinc-800 pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-300)]">{BRAND_NAME}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-semibold text-white">Supplier leads with proof behind them</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Work begins only when a current Saudi or UAE signal, a confirmed owner, and a reachable decision-maker are all on record.
            </p>
          </div>
          <Link href="/leads" className="inline-flex items-center gap-2 bg-[color:var(--brand-500)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--brand-600)]">
            Open lead queue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
        {[
          { label: "Active leads", value: stats?.active ?? 0, icon: CheckCircle2 },
          { label: "New this queue", value: stats?.new ?? 0, icon: Clock3 },
          { label: "Contacted", value: stats?.contacted ?? 0, icon: Mail },
        ].map((item) => (
          <div key={item.label} className="bg-zinc-950 px-5 py-5">
            <item.icon className="h-5 w-5 text-[var(--brand-300)]" />
            <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="border border-zinc-800">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Next to work</h2>
            <p className="mt-1 text-xs text-zinc-500">Source-qualified leads, ordered by recency and urgency.</p>
          </div>
          <Link href="/leads" className="text-sm font-medium text-[var(--brand-300)] hover:text-white">All leads</Link>
        </div>
        {leads === undefined ? (
          <div className="h-48 animate-pulse bg-zinc-900/40" />
        ) : leads.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-zinc-500">No lead clears the evidence gate yet.</p>
        ) : (
          <div>
            {leads.map((lead) => (
              <Link
                key={lead._id}
                href={`/leads/${lead._id}`}
                className="grid gap-2 border-b border-zinc-800 px-5 py-4 transition-colors last:border-b-0 hover:bg-zinc-900/50 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem] md:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{lead.productName} <span className="font-normal text-zinc-500">· {lead.country}</span></p>
                  <p className="mt-1 text-xs text-zinc-500">{lead.approachEntityName}</p>
                </div>
                <p className="line-clamp-1 text-sm text-zinc-300">{lead.signalTitle}</p>
                <p className="text-sm text-[var(--brand-300)]">{lead.contactName}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="text-sm text-zinc-500">Products, companies, and historical opportunity research remain available as supporting context.</p>
    </div>
  );
}
