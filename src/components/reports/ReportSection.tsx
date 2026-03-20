"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReportViewer } from "./ReportViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertCircle, Loader2 } from "lucide-react";

interface ReportSectionProps {
  drugId: string;
}

export function ReportSection({ drugId }: ReportSectionProps) {
  const report = useQuery(api.reports.getByDrug, {
    drugId: drugId as Id<"drugs">,
  });
  const generateReport = useAction(api.ai.generateReport);
  const [triggering, setTriggering] = useState(false);

  async function handleGenerate() {
    setTriggering(true);
    try {
      await generateReport({ drugId: drugId as Id<"drugs"> });
    } finally {
      setTriggering(false);
    }
  }

  // Loading initial query
  if (report === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-4/5 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    );
  }

  // No report yet
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-16 text-center">
        <Sparkles className="h-10 w-10 text-zinc-600 mb-4" />
        <h3 className="text-base font-semibold text-zinc-300 mb-1.5">
          No report generated yet
        </h3>
        <p className="text-sm text-zinc-500 max-w-sm mb-6">
          Generate an AI-powered market intelligence report covering all 15 MENA countries — regulatory pathways, competitive landscape, and recommended outreach strategy.
        </p>
        <Button onClick={handleGenerate} disabled={triggering}>
          {triggering ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate Report
        </Button>
      </div>
    );
  }

  // Generating
  if (report.status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 text-zinc-400 animate-spin mb-4" />
        <h3 className="text-base font-semibold text-zinc-300 mb-1.5">
          Generating market intelligence report...
        </h3>
        <p className="text-sm text-zinc-500">
          Analysing MENA market data, regulatory pathways, and competitive landscape. This takes 20–40 seconds.
        </p>
      </div>
    );
  }

  // Error
  if (report.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-900/40 bg-red-950/20 px-6 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
        <h3 className="text-base font-semibold text-zinc-300 mb-1.5">
          Report generation failed
        </h3>
        {report.errorMessage && (
          <p className="text-sm text-red-400 mb-4 font-mono max-w-md">
            {report.errorMessage}
          </p>
        )}
        <Button variant="outline" onClick={handleGenerate} disabled={triggering}>
          {triggering ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Retry
        </Button>
      </div>
    );
  }

  // Ready
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-zinc-600">
            Generated{" "}
            {report.generatedAt
              ? new Date(report.generatedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={triggering}
          className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
        >
          {triggering ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Regenerate
        </Button>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <ReportViewer content={report.content ?? ""} />
      </div>
    </div>
  );
}
