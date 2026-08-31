"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CalendarDays, FileText, Landmark, Route, Scale } from "lucide-react";

const iconByField = {
  registrationRoute: Route,
  typicalTimeline: CalendarDays,
  pricingRules: Scale,
  tenderCalendar: Landmark,
  competitorRegistrationSummary: FileText,
};

export function MarketFilesView() {
  const seedMarketFiles = useMutation(api.continuousOpportunityEngine.ensureMarketFiles);
  const files = useQuery(api.continuousOpportunityEngine.listMarketFiles);

  useEffect(() => {
    if (files && files.length === 0) {
      void seedMarketFiles({});
    }
  }, [files, seedMarketFiles]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-300)]">
          Market Files
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Country registration and access playbooks
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          One country file keeps registration route, pricing rules, tender calendar, and competitor-registration context together.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {(files ?? []).map((file) => (
          <article key={file._id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{file.country}</h2>
                <p className="mt-1 text-xs text-zinc-400">Last reviewed {new Date(file.lastReviewedAt).toLocaleDateString()}</p>
              </div>
              <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">
                {file.sourceRegistry}
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              {[
                ["registrationRoute", "Registration route", file.registrationRoute],
                ["typicalTimeline", "Typical timeline", file.typicalTimeline],
                ["pricingRules", "Pricing rules", file.pricingRules],
                ["tenderCalendar", "Tender calendar", file.tenderCalendar],
                ["competitorRegistrationSummary", "Competitor registrations", file.competitorRegistrationSummary],
              ].map(([key, label, value]) => {
                const Icon = iconByField[key as keyof typeof iconByField];
                return (
                  <div key={key} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-300)]" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-300">{value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        {files?.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 px-4 py-10 text-center text-sm text-zinc-500">
            Seeding market-file defaults...
          </div>
        )}
      </div>
    </main>
  );
}
