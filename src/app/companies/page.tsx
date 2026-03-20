import { PageHeader } from "@/components/shared/PageHeader";
import { CompanyList } from "@/components/companies/CompanyList";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Companies | ${BRAND_NAME}` };

export default function CompaniesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Manufacturer Registry"
        description="European pharmaceutical manufacturers ranked for gap-first MENA distributor opportunities."
      />
      <CompanyList />
    </main>
  );
}
