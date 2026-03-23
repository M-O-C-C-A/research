import { PageHeader } from "@/components/shared/PageHeader";
import { RegistrationImportWorkspace } from "@/components/drugs/RegistrationImportWorkspace";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Registration Imports | ${BRAND_NAME}` };

export default function DrugRegistrationImportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Registration Imports"
        description="Upload Excel registration sheets, resolve product matches, and apply country registrations into the tracked drug database."
        breadcrumbs={[
          { label: "Drugs", href: "/drugs" },
          { label: "Registration Imports" },
        ]}
      />
      <RegistrationImportWorkspace />
    </main>
  );
}
