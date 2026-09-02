import { OutreachTaskBoard } from "@/components/pipeline/OutreachTaskBoard";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Outreach Pipeline | ${BRAND_NAME}` };

export default function PipelinePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <OutreachTaskBoard />
    </main>
  );
}
