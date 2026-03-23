import { OpportunityWorkbench } from "@/components/opportunities/OpportunityWorkbench";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Opportunities | ${BRAND_NAME}` };

export default function GapsPage() {
  return <OpportunityWorkbench />;
}
