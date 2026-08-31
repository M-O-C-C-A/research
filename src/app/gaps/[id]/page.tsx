import { GapDetailPage } from "@/components/gaps/GapDetailPage";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function GapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumbs={[
          { label: "Opportunities", href: "/gaps" },
          { label: "Opportunity Detail" },
        ]}
        title="Opportunity"
        description="Review the pursuit, evidence, blockers, and next commercial action."
      />
      <GapDetailPage gapId={id} />
    </main>
  );
}
