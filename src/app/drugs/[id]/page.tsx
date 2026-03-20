import { PageHeader } from "@/components/shared/PageHeader";
import { DrugDetail } from "@/components/drugs/DrugDetail";
import { DrugDetailTabs } from "@/components/drugs/DrugDetailTabs";

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
      <DrugDetailTabs drugId={id} />
    </main>
  );
}
