import { LeadDetail } from "@/components/leads/LeadDetail";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Lead | ${BRAND_NAME}` };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetail leadId={id} />;
}
