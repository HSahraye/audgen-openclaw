import { LeadGenCommandCenter } from "@/components/leadgen-command-center";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadgenPage() {
  await requireRole(["owner", "admin", "sales", "viewer", "member"]);
  return <LeadGenCommandCenter />;
}
