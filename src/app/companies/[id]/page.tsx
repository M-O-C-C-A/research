import { PageHeader } from "@/components/shared/PageHeader";
import { CompanyDetail } from "@/components/companies/CompanyDetail";
import { CompanyDrugList } from "@/components/companies/CompanyDrugList";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        breadcrumbs={[
          { label: "Companies", href: "/companies" },
          { label: "Company Detail" },
        ]}
        title=""
      />
      <CompanyDetail companyId={id} />
      <CompanyDrugList companyId={id} />
    </main>
  );
}
