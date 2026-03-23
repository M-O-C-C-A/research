import { GuidedWorkspace } from "@/components/dashboard/GuidedWorkspace";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Guided Workflow | ${BRAND_NAME}` };

export default function WorkflowPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <GuidedWorkspace />
    </main>
  );
}
