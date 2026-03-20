import { PageHeader } from "@/components/shared/PageHeader";
import { DrugList } from "@/components/drugs/DrugList";

export const metadata = { title: "Drugs | M-O-C-C-A" };

export default function DrugsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <PageHeader
        title="Drug Registry"
        description="All European drugs tracked for MENA market opportunities."
      />
      <DrugList />
    </main>
  );
}
