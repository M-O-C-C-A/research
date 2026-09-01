import { OpportunityDetailView } from "@/components/opportunities/OpportunityDetailView";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function OpportunityDetailPage({
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
          { label: "Opportunity detail" },
        ]}
        title="Opportunity"
        description="Decide whether to pursue this product, market, and company now."
      />
      <OpportunityDetailView opportunityId={id} />
    </main>
  );
}
