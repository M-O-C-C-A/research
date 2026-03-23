import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { WorkflowCallout } from "@/components/shared/WorkflowCallout";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Outreach Pipeline | ${BRAND_NAME}` };

export default function PipelinePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <WorkflowCallout
        eyebrow="Track The Next Step"
        title="Keep outreach and follow-up moving"
        description="This page is where shortlisted companies become active commercial work. Use it to track stage, add notes, and keep everyone aligned on what should happen next."
      />
      <div className="mt-6">
        <PipelineBoard />
      </div>
    </main>
  );
}
