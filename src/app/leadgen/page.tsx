import { LeadGenCommandCenter } from "@/components/leadgen-command-center";
import { requireRole } from "@/lib/auth";
import { buildConnectorDiagnostics } from "@/lib/leadgen/diagnostics";
import {
  listLeadgenActivities,
  listLeadgenOpportunities,
  listLeadgenSavedViews,
} from "@/lib/leadgen/persistence";
import { getWorkspaceContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function LeadgenPage() {
  await requireRole(["owner", "admin", "sales", "viewer", "member"]);
  const { workspaceId } = await getWorkspaceContext();
  const [opportunities, savedViews, activities] = await Promise.all([
    listLeadgenOpportunities(workspaceId),
    listLeadgenSavedViews(workspaceId),
    listLeadgenActivities(workspaceId),
  ]);
  const diagnostics = buildConnectorDiagnostics({
    GOOGLE_SHEETS_CLIENT_EMAIL: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  });
  return (
    <LeadGenCommandCenter
      initialLeads={opportunities}
      savedViews={savedViews}
      initialActivities={activities}
      connectorDiagnostics={diagnostics}
    />
  );
}
