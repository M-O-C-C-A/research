import { PageHeader } from "@/components/shared/PageHeader";
import { InnManufacturerDirectory } from "@/components/drugs/InnManufacturerDirectory";

export default async function InnDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const genericName = decodeURIComponent(name);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumbs={[
          { label: "Products", href: "/drugs" },
          { label: "INN directory", href: "/drugs?view=inns" },
          { label: genericName },
        ]}
        title={`${genericName} manufacturers`}
        description="Review every manufacturer and linked brand product for this INN."
      />
      <InnManufacturerDirectory genericName={genericName} />
    </main>
  );
}
