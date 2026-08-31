"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MenaOpportunityGrid } from "@/components/drugs/MenaOpportunityGrid";
import { ReportSection } from "@/components/reports/ReportSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight } from "lucide-react";

interface DrugDetailTabsProps {
  drugId: string;
}

type DrugTab = "opportunities" | "report";

export function DrugDetailTabs({ drugId }: DrugDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo<DrugTab>(() => {
    const tab = searchParams.get("tab");
    return tab === "report" ? "report" : "opportunities";
  }, [searchParams]);

  function handleTabChange(value: string) {
    const nextTab: DrugTab = value === "report" ? "report" : "opportunities";
    const params = new URLSearchParams(searchParams.toString());

    if (nextTab === "opportunities") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <div className="mb-6 rounded-xl border border-[color:var(--brand-border)] bg-zinc-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-300)]">
          Product Decision
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Start with the pursuit decision
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Review any promoted opportunities for this product first. Use the decision brief only
          when you need a business-ready summary.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-zinc-300">
            1. Review opportunity
          </span>
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-zinc-300">
            2. Confirm blockers
          </span>
          <Link
            href="/gaps"
            className="inline-flex items-center gap-1 text-[var(--brand-300)] hover:text-[var(--brand-400)]"
          >
            3. Compare all opportunities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <TabsList className="mb-6 border border-[color:var(--brand-border)] bg-zinc-900">
        <TabsTrigger value="opportunities" className="text-zinc-400">
          Opportunities
        </TabsTrigger>
        <TabsTrigger value="report" className="text-zinc-400">
          Decision Brief
        </TabsTrigger>
      </TabsList>
      <TabsContent value="opportunities">
        <MenaOpportunityGrid drugId={drugId} />
      </TabsContent>
      <TabsContent value="report">
        <ReportSection drugId={drugId} />
      </TabsContent>
    </Tabs>
  );
}
