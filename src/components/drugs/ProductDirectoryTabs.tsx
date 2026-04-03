"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrugList } from "@/components/drugs/DrugList";
import { InnDirectory } from "@/components/drugs/InnDirectory";
import { MedicalDeviceDirectory } from "@/components/drugs/MedicalDeviceDirectory";

type ProductDirectoryTab = "brands" | "inns" | "devices";

export function ProductDirectoryTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo<ProductDirectoryTab>(() => {
    const view = searchParams.get("view");
    if (view === "inns") return "inns";
    if (view === "devices") return "devices";
    return "brands";
  }, [searchParams]);

  function handleTabChange(value: string) {
    const nextTab: ProductDirectoryTab =
      value === "inns" ? "inns" : value === "devices" ? "devices" : "brands";
    const params = new URLSearchParams(searchParams.toString());

    if (nextTab === "brands") {
      params.delete("view");
    } else {
      params.set("view", nextTab);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6 border border-zinc-800 bg-zinc-900">
        <TabsTrigger
          value="brands"
          className="text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
        >
          Products by Brand
        </TabsTrigger>
        <TabsTrigger
          value="inns"
          className="text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
        >
          INNs
        </TabsTrigger>
        <TabsTrigger
          value="devices"
          className="text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
        >
          Medical Devices
        </TabsTrigger>
      </TabsList>

      <TabsContent value="brands">
        <DrugList />
      </TabsContent>
      <TabsContent value="inns">
        <InnDirectory />
      </TabsContent>
      <TabsContent value="devices">
        <MedicalDeviceDirectory />
      </TabsContent>
    </Tabs>
  );
}
