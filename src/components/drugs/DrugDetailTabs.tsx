"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MenaOpportunityGrid } from "@/components/drugs/MenaOpportunityGrid";
import { ReportSection } from "@/components/reports/ReportSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
        <TabsTrigger value="opportunities" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
          MENA Opportunities
        </TabsTrigger>
        <TabsTrigger value="report" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
          Deal Pursuit Brief
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
