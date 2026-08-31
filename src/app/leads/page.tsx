import { LeadsWorkbench } from "@/components/leads/LeadsWorkbench";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Leads | ${BRAND_NAME}` };

export default function LeadsPage() {
  return <LeadsWorkbench />;
}
