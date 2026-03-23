import { PageHeader } from "@/components/shared/PageHeader";
import { DrugList } from "@/components/drugs/DrugList";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Drugs | ${BRAND_NAME}` };

export default function DrugsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Drugs"
        description="Review products, generate decision briefs, and connect each drug to the strongest next commercial action."
      />
      <DrugList />
    </main>
  );
}
