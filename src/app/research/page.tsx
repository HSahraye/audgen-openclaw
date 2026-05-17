import { ResearchQueueDashboard } from "@/components/research-queue-dashboard";
import { requireSessionRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strictWorkspaceScope } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  // SECURITY: workspaceId must come from the session (membership-derived),
  // not from getWorkspaceContext() which returns the platform-default
  // workspace and pools every tenant's research queue into one bucket.
  const session = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const workspaceId = session.workspaceId;
  const items = await prisma.researchQueueItem.findMany({
    where: strictWorkspaceScope(workspaceId),
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <ResearchQueueDashboard
      items={items.map((item) => ({
        id: item.id,
        businessName: item.businessName,
        websiteUrl: item.websiteUrl,
        location: item.location,
        category: item.category,
        phone: item.phone,
        email: item.email,
        notes: item.notes,
        source: item.source,
        priority: item.priority,
        status: item.status,
        convertedLeadId: item.convertedLeadId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }))}
    />
  );
}
