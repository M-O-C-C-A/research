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
          { label: "Opportunity Detail" },
        ]}
        title="Decision Opportunity"
        description="A ranked, evidence-backed BD opportunity with market rationale, route to entry, and contact direction."
      />
      <OpportunityDetailView opportunityId={id} />
    </main>
  );
}
