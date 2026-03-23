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
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Suggested flow
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Review the opportunity first, then generate the decision brief
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Start with market opportunity to understand where the whitespace is. Then open the
          decision brief when you want a business-ready summary you can use to decide what to do
          next.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-zinc-300">
            1. Review market opportunity
          </span>
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-zinc-300">
            2. Generate decision brief
          </span>
          <Link
            href="/gaps"
            className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
          >
            3. Compare against all opportunities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
        <TabsTrigger value="opportunities" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
          Market Opportunity
        </TabsTrigger>
        <TabsTrigger value="report" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
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
