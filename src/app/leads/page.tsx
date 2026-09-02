import { BRAND_NAME } from "@/lib/brand";
import { EvidenceFunnelDashboard } from "@/components/opportunities/EvidenceFunnelDashboard";

export const metadata = { title: `Leads | ${BRAND_NAME}` };

export default function LeadsPage() {
  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><EvidenceFunnelDashboard initialStage="contact_ready" /></main>;
}
