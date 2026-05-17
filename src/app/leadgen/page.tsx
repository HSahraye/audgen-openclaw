import { LeadGenCommandCenter } from "@/components/leadgen-command-center";
import { requireSessionRole } from "@/lib/auth";
import { buildConnectorDiagnostics } from "@/lib/leadgen/diagnostics";
import {
  listLeadgenActivities,
  listLeadgenOpportunities,
  listLeadgenSavedViews,
} from "@/lib/leadgen/persistence";

export const dynamic = "force-dynamic";

export default async function LeadgenPage() {
  // SECURITY: source workspaceId from the authenticated session, NOT from
  // getWorkspaceContext() (which returns the platform default workspace
  // and previously caused every authenticated user to read the same pool
  // of LeadGen opportunities — see the multi-surface cross-tenant leak
  // verified across /leadgen, /research, /outreach by two-account test).
  const session = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const workspaceId = session.workspaceId;
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
    YELP_API_KEY: process.env.YELP_API_KEY,
    LEADGEN_LIVE_CONNECTORS_ENABLED: process.env.LEADGEN_LIVE_CONNECTORS_ENABLED,
    LEADGEN_SANDBOX_MODE: process.env.LEADGEN_SANDBOX_MODE,
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
