import { CanonicalProductDetail } from "@/components/drugs/CanonicalProductDetail";
import { PageHeader } from "@/components/shared/PageHeader";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Canonical Product | ${BRAND_NAME}` };

export default async function CanonicalProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Product intelligence"
        description="Review the canonical FDA/EU identity for this product, including regulatory sources, ownership roles, and equivalent products."
        breadcrumbs={[
          { label: "Products", href: "/drugs" },
          { label: "Product intelligence" },
        ]}
      />
      <CanonicalProductDetail productId={id} />
    </main>
  );
}
