"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, MapPinned } from "lucide-react";
import { api } from "../../../convex/_generated/api";

interface GuidedFlowBannerProps {
  hereLabel: string;
  helperText: string;
}

const STEP_LABELS: Record<string, string> = {
  company: "Choose a company",
  product: "Add a product",
  opportunity: "Review best opportunities",
  blockers: "Resolve blockers",
  outreach: "Prepare outreach",
  follow_up: "Continue follow-up",
};

export function GuidedFlowBanner({ hereLabel, helperText }: GuidedFlowBannerProps) {
  const guidedFlow = useQuery(api.dashboard.getGuidedFlow, {});

  const nextLabel = guidedFlow?.primaryAction.label ?? "Start with a company";
  const nextHref = guidedFlow?.resumeHref ?? "/workflow";
  const currentStep = guidedFlow?.currentStep
    ? STEP_LABELS[guidedFlow.currentStep] ?? guidedFlow.currentStep
    : "Choose a company";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            You Are Here
          </p>
          <p className="mt-2 text-sm font-semibold text-white">{hereLabel}</p>
          <p className="mt-1 text-sm text-zinc-400">{helperText}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
            <MapPinned className="h-3.5 w-3.5 text-cyan-300" />
            Current guided step: {currentStep}
          </p>
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Next Step</p>
          <p className="mt-1 text-sm font-medium text-white">{nextLabel}</p>
          <Link
            href={nextHref}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            Open next step
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
