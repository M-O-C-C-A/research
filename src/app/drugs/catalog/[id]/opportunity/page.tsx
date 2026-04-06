import { CanonicalProductOpportunityView } from "@/components/drugs/CanonicalProductOpportunityView";
import { PageHeader } from "@/components/shared/PageHeader";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Product Market Opportunity | ${BRAND_NAME}` };

export default async function CanonicalProductOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Product market opportunity"
        description="Review one product across GCC++ markets: availability, patient demand, market size, channels, and evidence-backed launch priorities."
        breadcrumbs={[
          { label: "Products", href: "/drugs" },
          { label: "Product intelligence", href: `/drugs/catalog/${id}` },
          { label: "Market opportunity" },
        ]}
      />
      <CanonicalProductOpportunityView productId={id} />
    </main>
  );
}
