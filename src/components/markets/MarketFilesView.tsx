"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AlertTriangle, CalendarDays, Database, ExternalLink, FileText, Landmark, Route, Scale } from "lucide-react";

const iconByField = {
  registrationRoute: Route,
  typicalTimeline: CalendarDays,
  pricingRules: Scale,
  tenderCalendar: Landmark,
  competitorRegistrationSummary: FileText,
};

const TARGET_MARKET_ORDER = ["Egypt", "Saudi Arabia", "UAE"];

const marketSourceLinks: Record<string, Array<{ label: string; href: string; type: string }>> = {
  "Saudi Arabia": [
    {
      label: "SFDA registered drug search",
      href: "https://www.sfda.gov.sa/en/drug-search",
      type: "registration",
    },
    {
      label: "SFDA current shortages",
      href: "https://www.sfda.gov.sa/en/currentlyInShortageList",
      type: "shortage",
    },
    {
      label: "SFDA anticipated shortages",
      href: "https://www.sfda.gov.sa/en/anticipatedShortage",
      type: "shortage",
    },
    {
      label: "Etimad procurement",
      href: "https://portal.etimad.sa/",
      type: "procurement",
    },
  ],
  UAE: [
    {
      label: "EDE import permit service",
      href: "https://www.ede.gov.ae/ar/c/portal/update_language?groupId=61005&languageId=en_US&layoutId=19&redirect=%2Far%2Fw%2Fimport-permit-for-medical-materials-and-products",
      type: "import",
    },
    {
      label: "MOHAP registered product directory",
      href: "https://mohap.gov.ae/en/services/registered-medical-product-directory",
      type: "registration",
    },
    {
      label: "MOHAP open data / price lists",
      href: "https://mohap.gov.ae/en/open-data",
      type: "pricing",
    },
  ],
  Egypt: [
    {
      label: "EDA registered drug search",
      href: "https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx",
      type: "registration",
    },
    {
      label: "Egypt e-procurement",
      href: "https://www.etenders.gov.eg/",
      type: "procurement",
    },
  ],
  Kuwait: [
    {
      label: "Kuwait Ministry of Health",
      href: "https://www.moh.gov.kw/",
      type: "regulatory",
    },
  ],
  Qatar: [
    {
      label: "Qatar Ministry of Public Health",
      href: "https://www.moph.gov.qa/",
      type: "regulatory",
    },
  ],
  Algeria: [
    {
      label: "Algeria Ministry of Pharmaceutical Industry",
      href: "https://www.miph.gov.dz/",
      type: "regulatory",
    },
  ],
};

function marketRank(country: string) {
  const index = TARGET_MARKET_ORDER.indexOf(country);
  return index === -1 ? TARGET_MARKET_ORDER.length + country.localeCompare("Z") : index;
}

export function MarketFilesView() {
  const seedMarketFiles = useMutation(api.continuousOpportunityEngine.ensureMarketFiles);
  const files = useQuery(api.continuousOpportunityEngine.listMarketFiles);
  const sourceHealth = useQuery(api.continuousOpportunityEngine.listSourceHealth);

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
          Country validation workspace
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          This page is useful only when it points you to official registry, price, shortage, and procurement evidence. Internal notes are shown as planning context, not validated findings.
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <h2 className="text-sm font-semibold text-amber-100">Current status: validation hub, not a finished market dossier</h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-100/80">
              A country card becomes decision-grade only after official source checks are attached to product-level evidence. Until then, the route and timing text is a reminder of what to verify.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {[...(files ?? [])].sort((left, right) => marketRank(left.country) - marketRank(right.country)).map((file) => {
          const links = marketSourceLinks[file.country] ?? [];
          const automatedSources = (sourceHealth ?? []).filter((source) => {
            const haystack = `${source.sourceRegistry} ${source.title} ${source.baseUrl}`.toLowerCase();
            return haystack.includes(file.country.toLowerCase()) ||
              (file.country === "Saudi Arabia" && haystack.includes("sfda")) ||
              (file.country === "UAE" && (haystack.includes("uae") || haystack.includes("mohap") || haystack.includes("ede"))) ||
              (file.country === "Egypt" && haystack.includes("eda"));
          });
          const isTargetMarket = TARGET_MARKET_ORDER.includes(file.country);
          return (
          <article key={file._id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">{file.country}</h2>
                  {isTargetMarket && (
                    <span className="rounded-md border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--brand-300)]">
                      target market
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-400">Last reviewed {new Date(file.lastReviewedAt).toLocaleDateString()}</p>
              </div>
              <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">
                {file.sourceRegistry === "internal_market_files" ? "planning context" : file.sourceRegistry}
              </span>
            </div>

            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-300)]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Official links and source status
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-[color:var(--brand-border)] hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[var(--brand-300)]" />
                        {link.label}
                      </a>
                    ))}
                    {links.length === 0 && (
                      <span className="text-sm text-zinc-500">No official links configured yet.</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {automatedSources.length === 0 ? (
                      <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                        no active automated source attached
                      </span>
                    ) : (
                      automatedSources.map((source) => (
                        <span key={source._id} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">
                          {source.sourceRegistry}: {source.status.replaceAll("_", " ")}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
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
          );
        })}
        {files?.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 px-4 py-10 text-center text-sm text-zinc-500">
            Seeding market-file defaults...
          </div>
        )}
      </div>
    </main>
  );
}
