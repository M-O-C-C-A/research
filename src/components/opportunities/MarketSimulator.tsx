"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidedFlowBanner } from "@/components/shared/GuidedFlowBanner";

function fmtMoney(value?: number, currency = "USD") {
  if (value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

interface MarketSimulatorProps {
  drugId: string;
  country: string;
}

export function MarketSimulator({ drugId, country }: MarketSimulatorProps) {
  const simulation = useQuery(api.opportunities.getMarketSimulation, {
    drugId: drugId as Id<"drugs">,
    country,
  });
  const drug = useQuery(api.drugs.get, { id: drugId as Id<"drugs"> });
  const saveSimulation = useMutation(api.opportunities.upsertMarketSimulation);

  const defaults = simulation?.simulation ?? simulation?.computed;
  const [targetSellingPrice, setTargetSellingPrice] = useState("");
  const [exFactoryPrice, setExFactoryPrice] = useState("");
  const [distributorMarginPct, setDistributorMarginPct] = useState("");
  const [logisticsCostPerUnit, setLogisticsCostPerUnit] = useState("");
  const [regulatoryCostTotal, setRegulatoryCostTotal] = useState("");
  const [tenderCostTotal, setTenderCostTotal] = useState("");
  const [publicShare, setPublicShare] = useState("");
  const [privateShare, setPrivateShare] = useState("");
  const [adoptionRate, setAdoptionRate] = useState("");
  const [accessiblePopulation, setAccessiblePopulation] = useState("");
  const [unitsPerCustomer, setUnitsPerCustomer] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!defaults) return;
    if (targetSellingPrice === "" && defaults.targetSellingPrice !== undefined) {
      setTargetSellingPrice(String(defaults.targetSellingPrice));
    }
    if (exFactoryPrice === "" && defaults.exFactoryPrice !== undefined) {
      setExFactoryPrice(String(defaults.exFactoryPrice));
    }
    if (distributorMarginPct === "" && defaults.distributorMarginPct !== undefined) {
      setDistributorMarginPct(String(defaults.distributorMarginPct));
    }
    if (logisticsCostPerUnit === "" && defaults.logisticsCostPerUnit !== undefined) {
      setLogisticsCostPerUnit(String(defaults.logisticsCostPerUnit));
    }
    if (regulatoryCostTotal === "" && defaults.regulatoryCostTotal !== undefined) {
      setRegulatoryCostTotal(String(defaults.regulatoryCostTotal));
    }
    if (tenderCostTotal === "" && defaults.tenderCostTotal !== undefined) {
      setTenderCostTotal(String(defaults.tenderCostTotal));
    }
    if (publicShare === "" && defaults.publicShare !== undefined) {
      setPublicShare(String(defaults.publicShare));
    }
    if (privateShare === "" && defaults.privateShare !== undefined) {
      setPrivateShare(String(defaults.privateShare));
    }
    if (adoptionRate === "" && defaults.adoptionRate !== undefined) {
      setAdoptionRate(String(defaults.adoptionRate));
    }
    if (accessiblePopulation === "" && defaults.accessiblePopulation !== undefined) {
      setAccessiblePopulation(String(defaults.accessiblePopulation));
    }
    if (unitsPerCustomer === "" && defaults.unitsPerCustomer !== undefined) {
      setUnitsPerCustomer(String(defaults.unitsPerCustomer));
    }
  }, [
    accessiblePopulation,
    adoptionRate,
    defaults,
    distributorMarginPct,
    exFactoryPrice,
    logisticsCostPerUnit,
    privateShare,
    publicShare,
    regulatoryCostTotal,
    targetSellingPrice,
    tenderCostTotal,
    unitsPerCustomer,
  ]);

  const effectiveValues = useMemo(
    () => ({
      targetSellingPrice:
        targetSellingPrice !== ""
          ? Number(targetSellingPrice)
          : defaults?.targetSellingPrice,
      exFactoryPrice:
        exFactoryPrice !== "" ? Number(exFactoryPrice) : defaults?.exFactoryPrice,
      distributorMarginPct:
        distributorMarginPct !== ""
          ? Number(distributorMarginPct)
          : defaults?.distributorMarginPct,
      logisticsCostPerUnit:
        logisticsCostPerUnit !== ""
          ? Number(logisticsCostPerUnit)
          : defaults?.logisticsCostPerUnit,
      regulatoryCostTotal:
        regulatoryCostTotal !== ""
          ? Number(regulatoryCostTotal)
          : defaults?.regulatoryCostTotal,
      tenderCostTotal:
        tenderCostTotal !== ""
          ? Number(tenderCostTotal)
          : defaults?.tenderCostTotal,
      publicShare: publicShare !== "" ? Number(publicShare) : defaults?.publicShare,
      privateShare:
        privateShare !== "" ? Number(privateShare) : defaults?.privateShare,
      adoptionRate:
        adoptionRate !== "" ? Number(adoptionRate) : defaults?.adoptionRate,
      accessiblePopulation:
        accessiblePopulation !== ""
          ? Number(accessiblePopulation)
          : defaults?.accessiblePopulation,
      unitsPerCustomer:
        unitsPerCustomer !== ""
          ? Number(unitsPerCustomer)
          : defaults?.unitsPerCustomer,
    }),
    [
      accessiblePopulation,
      adoptionRate,
      defaults,
      distributorMarginPct,
      exFactoryPrice,
      logisticsCostPerUnit,
      privateShare,
      publicShare,
      regulatoryCostTotal,
      targetSellingPrice,
      tenderCostTotal,
      unitsPerCustomer,
    ]
  );

  if (simulation === undefined || drug === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full bg-zinc-800" />
        <Skeleton className="h-64 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!simulation || !drug) return null;

  const opportunity = simulation.opportunity;
  const computed = simulation.computed;
  const currency =
    simulation.simulation?.targetSellingCurrency ??
    computed?.targetSellingCurrency ??
    "USD";

  async function handleSave() {
    setSaving(true);
    try {
      await saveSimulation({
        drugId: drugId as Id<"drugs">,
        country,
        targetSellingCurrency: currency,
        targetSellingPrice: effectiveValues.targetSellingPrice,
        exFactoryPrice: effectiveValues.exFactoryPrice,
        distributorMarginPct: effectiveValues.distributorMarginPct,
        logisticsCostPerUnit: effectiveValues.logisticsCostPerUnit,
        regulatoryCostTotal: effectiveValues.regulatoryCostTotal,
        tenderCostTotal: effectiveValues.tenderCostTotal,
        publicShare: effectiveValues.publicShare,
        privateShare: effectiveValues.privateShare,
        adoptionRate: effectiveValues.adoptionRate,
        accessiblePopulation: effectiveValues.accessiblePopulation,
        unitsPerCustomer: effectiveValues.unitsPerCustomer,
      });
    } finally {
      setSaving(false);
    }
  }

  const cards = [
    {
      label: "EU reference",
      value: opportunity?.euReferenceAnchor ?? "Not set",
    },
    {
      label: "GCC registered",
      value: opportunity?.gccRegisteredAnchor ?? "Not set",
    },
    {
      label: "Tender benchmark",
      value: opportunity?.tenderBenchmarkAnchor ?? "Not set",
    },
    {
      label: "Recommended band",
      value: opportunity?.recommendedPricingBand ?? opportunity?.priceCorridorBand ?? "Not set",
    },
  ];

  return (
    <div className="space-y-6">
      <GuidedFlowBanner
        hereLabel="Margin simulator"
        helperText="Use this page to pressure-test one market at a time: set your price corridor, reality-check accessible volume, and decide the best entry sequence."
      />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {drug.name} in {country}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Build a realistic commercial case from source-backed pricing anchors, access mix,
              adoption, and cost assumptions before recommending a pricing band or channel.
            </p>
          </div>
          <Link
            href={`/drugs/${drugId}`}
            className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            Back to product market view
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{card.label}</p>
              <p className="mt-2 text-sm text-zinc-200">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Simulator inputs
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Adjust price, volume, and cost assumptions
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target selling price" value={targetSellingPrice} fallback={computed?.targetSellingPrice} onChange={setTargetSellingPrice} />
            <Field label="Ex-factory / acquisition" value={exFactoryPrice} fallback={computed?.exFactoryPrice} onChange={setExFactoryPrice} />
            <Field label="Distributor margin %" value={distributorMarginPct} fallback={computed?.distributorMarginPct} onChange={setDistributorMarginPct} />
            <Field label="Logistics cost / unit" value={logisticsCostPerUnit} fallback={computed?.logisticsCostPerUnit} onChange={setLogisticsCostPerUnit} />
            <Field label="Regulatory cost total" value={regulatoryCostTotal} fallback={computed?.regulatoryCostTotal} onChange={setRegulatoryCostTotal} />
            <Field label="Tender cost total" value={tenderCostTotal} fallback={computed?.tenderCostTotal} onChange={setTenderCostTotal} />
            <Field label="Public share" value={publicShare} fallback={computed?.publicShare} onChange={setPublicShare} />
            <Field label="Private share" value={privateShare} fallback={computed?.privateShare} onChange={setPrivateShare} />
            <Field label="Adoption rate" value={adoptionRate} fallback={computed?.adoptionRate} onChange={setAdoptionRate} />
            <Field label="Accessible population" value={accessiblePopulation} fallback={computed?.accessiblePopulation} onChange={setAccessiblePopulation} />
            <Field label="Units per customer" value={unitsPerCustomer} fallback={computed?.unitsPerCustomer} onChange={setUnitsPerCustomer} />
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
            <p className="font-medium text-white">Volume reality check</p>
            <p className="mt-2">{opportunity?.accessibleVolumeEstimate ?? "No modeled volume yet."}</p>
            <p className="mt-2 text-zinc-400">
              {opportunity?.publicPrivateMixSummary ?? "Public/private mix not set."}
            </p>
            <p className="mt-1 text-zinc-400">
              {opportunity?.physicianAdoptionSummary ?? "Physician adoption not set."}
            </p>
          </div>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save scenario"}
          </Button>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Scenario outputs
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Conservative, base, and upside economics
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <ScenarioCard
                label="Conservative"
                revenue={computed?.conservativeRevenue}
                margin={computed?.conservativeGrossMarginPct}
                currency={currency}
              />
              <ScenarioCard
                label="Base"
                revenue={computed?.baseRevenue}
                margin={computed?.baseGrossMarginPct}
                currency={currency}
              />
              <ScenarioCard
                label="Upside"
                revenue={computed?.upsideRevenue}
                margin={computed?.upsideGrossMarginPct}
                currency={currency}
              />
            </div>
            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-sm font-medium text-white">Unit economics</p>
              <p className="mt-2 text-sm text-zinc-300">
                {computed?.unitEconomicsSummary ?? "No unit economics summary yet."}
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                {computed?.viabilitySummary ?? "No viability summary yet."}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
              Entry strategy recommendation
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Channel, pricing band, and sequencing
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <StrategyCard
                label="Channel"
                value={computed?.recommendedChannel?.replaceAll("_", " ") ?? "unknown"}
              />
              <StrategyCard
                label="Pricing band"
                value={computed?.recommendedPricingBand ?? "Not set"}
              />
              <StrategyCard
                label="Sequencing"
                value={computed?.recommendedSequencing?.replaceAll("_", " ") ?? "watch"}
              />
            </div>
            <p className="mt-4 text-sm text-zinc-200">
              {computed?.recommendationRationale ?? "No recommendation yet."}
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-zinc-400">{label}</label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={fallback !== undefined ? String(fallback) : "Enter value"}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
      />
    </div>
  );
}

function ScenarioCard({
  label,
  revenue,
  margin,
  currency,
}: {
  label: string;
  revenue?: number;
  margin?: number;
  currency: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{fmtMoney(revenue, currency)}</p>
      <p className="mt-1 text-sm text-zinc-400">{margin !== undefined ? `${margin.toFixed(1)}% GM` : "—"}</p>
    </div>
  );
}

function StrategyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--brand-border)] bg-zinc-950/40 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
