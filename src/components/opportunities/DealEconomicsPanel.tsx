"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { BadgeDollarSign, Handshake } from "lucide-react";

interface DealEconomicsPanelProps {
  decisionOpportunityId: string;
}

function formatMoney(value?: number) {
  if (!value) return "UNVALIDATED";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function modelLabel(model: string) {
  return model === "MODEL_1_REGIONAL_AGENT"
    ? "Model 1 · In-license / regional agent"
    : "Model 4 · Broker / sub-license fee";
}

function modelDescription(model: string) {
  return model === "MODEL_1_REGIONAL_AGENT"
    ? "Provisional local-applicant scenario. KEMEDICA is coordinator/advisor unless a named regulated applicant and approved role are recorded."
    : "Provisional broker or sub-license scenario; no fee or right is presented as agreed.";
}

export function DealEconomicsPanel({
  decisionOpportunityId,
}: DealEconomicsPanelProps) {
  const scenarios = useQuery(api.continuousOpportunityEngine.getDealEconomics, {
    decisionOpportunityId: decisionOpportunityId as Id<"decisionOpportunities">,
  });

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
            Deal Economics
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Compare KEMEDICA Model 1 and Model 4
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Values are generated from the latest immutable opportunity run.
            Rebuild the continuous engine if this panel is empty.
          </p>
        </div>
        <BadgeDollarSign className="h-5 w-5 text-[var(--brand-300)]" />
      </div>

      {!scenarios || scenarios.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No deal scenarios yet. Use Rebuild run on the opportunities screen.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <div
              key={scenario._id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="flex items-start gap-3">
                <Handshake className="mt-0.5 h-4 w-4 text-[var(--brand-300)]" />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {modelLabel(scenario.model)}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {modelDescription(scenario.model)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-zinc-400">Market</p>
                  <p className="mt-1 text-zinc-200">{scenario.market}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400">
                    Expected value
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {formatMoney(scenario.expectedValueUsd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400">
                    Revenue range
                  </p>
                  <p className="mt-1 text-zinc-200">
                    {formatMoney(scenario.netRevenueLowUsd)} -{" "}
                    {formatMoney(scenario.netRevenueHighUsd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400">
                    Success probability
                  </p>
                  <p className="mt-1 text-zinc-200">
                    {scenario.probabilityOfSuccessPct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400">
                    Margin / fee
                  </p>
                  <p className="mt-1 text-zinc-200">
                    {scenario.expectedGrossMarginPct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400">
                    Operating cost
                  </p>
                  <p className="mt-1 text-zinc-200">
                    {formatMoney(scenario.operatingCostUsd)}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-1 border-t border-zinc-800 pt-3">
                {scenario.assumptions.map((assumption) => (
                  <p
                    key={assumption}
                    className="text-xs leading-relaxed text-zinc-400"
                  >
                    {assumption}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
