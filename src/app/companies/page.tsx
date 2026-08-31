import { PageHeader } from "@/components/shared/PageHeader";
import { CompanyList } from "@/components/companies/CompanyList";
import { DiscoverCompaniesButton } from "@/components/discovery/DiscoverCompaniesButton";
import { ImportEmaCompaniesButton } from "@/components/companies/ImportEmaCompaniesButton";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Companies | ${BRAND_NAME}` };

export default function CompaniesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Companies"
        description="Look up manufacturers and contacts when an opportunity needs company context or outreach ownership."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ImportEmaCompaniesButton />
            <DiscoverCompaniesButton label="Research companies" />
          </div>
        }
      />
      <CompanyList />
    </main>
  );
}
