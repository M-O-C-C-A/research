import { PageHeader } from "@/components/shared/PageHeader";
import { CompanyList } from "@/components/companies/CompanyList";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Company Directory | ${BRAND_NAME}` };

export default function CompaniesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Company Directory"
        description="Browse target manufacturers, review fit, and launch deeper company or portfolio research before moving into opportunity and outreach."
        action={<DiscoverCompaniesButton label="Research companies" />}
      />
      <CompanyList />
    </main>
  );
}
