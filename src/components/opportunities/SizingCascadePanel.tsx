"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Save } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MARKETS = [
  { country: "Egypt", margin: 28 },
  { country: "Saudi Arabia", margin: 32 },
  { country: "UAE", margin: 35 },
] as const;

const INPUT_STATUS = [
  ["official_source", "Official source"],
  ["company_release", "Company release"],
  ["literature", "Literature"],
  ["international_price_anchor", "International price anchor"],
  ["practitioner_estimate", "Practitioner estimate"],
  ["unvalidated", "Unvalidated"],
] as const;

type SizingInputStatus = (typeof INPUT_STATUS)[number][0];

interface SizingCascadePanelProps {
  decisionOpportunityId: string;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function calculatePeakSales(row: EditableSizingRow) {
  return Math.round(
    row.eligiblePatients *
      (row.diagnosedReachableRate / 100) *
      (row.brandedTreatmentRate / 100) *
      (row.kemedicaShareRate / 100) *
      row.netPricePerPatientYearUsd
  );
}

function calculateRiskAdjustedMargin(row: EditableSizingRow) {
  return Math.round(
    calculatePeakSales(row) *
      (row.marketMarginRate / 100) *
      (row.licenseSignedProbability / 100) *
      (row.registrationGrantedProbability / 100)
  );
}

type EditableSizingRow = {
  country: string;
  eligiblePatients: number;
  diagnosedReachableRate: number;
  brandedTreatmentRate: number;
  kemedicaShareRate: number;
  netPricePerPatientYearUsd: number;
  marketMarginRate: number;
  licenseSignedProbability: number;
  registrationGrantedProbability: number;
  inputStatus: SizingInputStatus;
  basis: string;
};

function defaultRow(country: string, margin: number): EditableSizingRow {
  return {
    country,
    eligiblePatients: 1000,
    diagnosedReachableRate: 45,
    brandedTreatmentRate: 30,
    kemedicaShareRate: 12,
    netPricePerPatientYearUsd: 20000,
    marketMarginRate: margin,
    licenseSignedProbability: 35,
    registrationGrantedProbability: 60,
    inputStatus: "practitioner_estimate",
    basis: "Practitioner estimate until linked to official epidemiology, company release, or literature evidence.",
  };
}

export function SizingCascadePanel({ decisionOpportunityId }: SizingCascadePanelProps) {
  const storedRows = useQuery(api.continuousOpportunityEngine.listSizingInputs, {
    decisionOpportunityId: decisionOpportunityId as Id<"decisionOpportunities">,
  });
  const upsertSizingInput = useMutation(api.continuousOpportunityEngine.upsertSizingInput);
  const [drafts, setDrafts] = useState<Record<string, EditableSizingRow>>({});
  const [savingCountry, setSavingCountry] = useState<string | null>(null);

  const rows = useMemo(() => {
    return MARKETS.map(({ country, margin }) => {
      const stored = storedRows?.find((row) => row.country === country);
      const base = stored
        ? {
            country,
            eligiblePatients: stored.eligiblePatients,
            diagnosedReachableRate: stored.diagnosedReachableRate,
            brandedTreatmentRate: stored.brandedTreatmentRate,
            kemedicaShareRate: stored.kemedicaShareRate,
            netPricePerPatientYearUsd: stored.netPricePerPatientYearUsd,
            marketMarginRate: stored.marketMarginRate,
            licenseSignedProbability: stored.licenseSignedProbability,
            registrationGrantedProbability: stored.registrationGrantedProbability,
            inputStatus: stored.inputStatus,
            basis: stored.basis,
          }
        : defaultRow(country, margin);
      return drafts[country] ?? base;
    });
  }, [drafts, storedRows]);

  function updateRow(country: string, patch: Partial<EditableSizingRow>) {
    setDrafts((current) => {
      const existing = rows.find((row) => row.country === country) ?? defaultRow(country, 30);
      return { ...current, [country]: { ...existing, ...patch } };
    });
  }

  async function saveRow(row: EditableSizingRow) {
    setSavingCountry(row.country);
    try {
      await upsertSizingInput({
        decisionOpportunityId: decisionOpportunityId as Id<"decisionOpportunities">,
        ...row,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.country];
        return next;
      });
    } finally {
      setSavingCountry(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            Sizing Cascade
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Editable year-five peak sales and risk-adjusted margin
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Peak sales = eligible patients x diagnosed/reachable x branded treatment x KEMEDICA share x net price.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div key={row.country} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white">{row.country}</h4>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatMoney(calculatePeakSales(row))} peak sales · {formatMoney(calculateRiskAdjustedMargin(row))} risk-adjusted margin
                </p>
              </div>
              <select
                value={row.inputStatus}
                onChange={(event) =>
                  updateRow(row.country, { inputStatus: event.target.value as SizingInputStatus })
                }
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[color:var(--brand-border)]"
              >
                {INPUT_STATUS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {[
                ["eligiblePatients", "Eligible patients", "1"],
                ["diagnosedReachableRate", "Diagnosed/reachable %", "0.1"],
                ["brandedTreatmentRate", "Branded treated %", "0.1"],
                ["kemedicaShareRate", "KEMEDICA share %", "0.1"],
                ["netPricePerPatientYearUsd", "Net price/year", "100"],
                ["marketMarginRate", "Market margin %", "0.1"],
                ["licenseSignedProbability", "License signed %", "0.1"],
                ["registrationGrantedProbability", "Registration granted %", "0.1"],
              ].map(([key, label, step]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs font-medium text-zinc-300">{label}</span>
                  <Input
                    type="number"
                    min={0}
                    step={step}
                    value={row[key as keyof EditableSizingRow] as number}
                    onChange={(event) =>
                      updateRow(row.country, { [key]: Number(event.target.value) } as Partial<EditableSizingRow>)
                    }
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  />
                </label>
              ))}
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-medium text-zinc-300">Cascade basis</span>
              <textarea
                value={row.basis}
                onChange={(event) => updateRow(row.country, { basis: event.target.value })}
                className="min-h-20 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[color:var(--brand-border)]"
              />
            </label>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => saveRow(row)} disabled={savingCountry === row.country}>
                <Save className="h-4 w-4" />
                {savingCountry === row.country ? "Saving" : "Save sizing"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
