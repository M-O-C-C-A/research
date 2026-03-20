import { PageHeader } from "@/components/shared/PageHeader";
import { DrugDetail } from "@/components/drugs/DrugDetail";
import { MenaOpportunityGrid } from "@/components/drugs/MenaOpportunityGrid";
import { ReportSection } from "@/components/reports/ReportSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function DrugDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        breadcrumbs={[
          { label: "Drugs", href: "/drugs" },
          { label: "Drug Detail" },
        ]}
        title=""
      />
      <DrugDetail drugId={id} />
      <Tabs defaultValue="opportunities">
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
          <TabsTrigger value="opportunities" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            MENA Opportunities
          </TabsTrigger>
          <TabsTrigger value="report" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            AI Market Report
          </TabsTrigger>
        </TabsList>
        <TabsContent value="opportunities">
          <MenaOpportunityGrid drugId={id} />
        </TabsContent>
        <TabsContent value="report">
          <ReportSection drugId={id} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
