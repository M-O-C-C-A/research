import { MarketSimulator } from "@/components/opportunities/MarketSimulator";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function DrugMarketSimulatorPage({
  params,
}: {
  params: Promise<{ id: string; country: string }>;
}) {
  const { id, country } = await params;
  const decodedCountry = decodeURIComponent(country);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumbs={[
          { label: "Products", href: "/drugs" },
          { label: "Market simulator" },
        ]}
        title="Market simulator"
        description="Model one product-country opportunity at a time: build a price corridor, reality-check volume, and choose the best entry sequence."
      />
      <MarketSimulator drugId={id} country={decodedCountry} />
    </main>
  );
}
