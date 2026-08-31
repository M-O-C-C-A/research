import { PageHeader } from "@/components/shared/PageHeader";
import { CompanyDetail } from "@/components/companies/CompanyDetail";
import { CompanyDrugList } from "@/components/companies/CompanyDrugList";
import { ResearchPanel } from "@/components/research/ResearchPanel";

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
          { label: "Company detail" },
        ]}
        title="Company"
        description="Confirm fit, contacts, and linked products for an active opportunity."
      />
      <CompanyDetail companyId={id} />
      <div className="mb-6">
        <ResearchPanel target="company" targetId={id} />
      </div>
      <CompanyDrugList companyId={id} />
    </main>
  );
}
