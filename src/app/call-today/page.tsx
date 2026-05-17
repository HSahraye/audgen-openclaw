import { prisma } from "@/lib/prisma";
import { CallTodayDashboard } from "@/components/call-today-dashboard";
import { requireSessionRole } from "@/lib/auth";
import { buildPreferredAuditPath } from "@/lib/audit-links";
import { strictWorkspaceScope } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CallTodayPage() {
  // SECURITY: session-scoped workspaceId only. See SECURITY note on /leadgen.
  const session = await requireSessionRole(["owner", "admin", "sales", "viewer", "member"]);
  const workspaceId = session.workspaceId;
  const now = new Date();
  // End of today (23:59:59) so we include everything due today
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      ...strictWorkspaceScope(workspaceId),
      status: { notIn: ["Won", "Lost"] },
      OR: [
        // Follow-up due today or overdue
        { nextFollowUpAt: { lte: endOfToday } },
        // Hot leads (score >= 8) with no follow-up set yet
        { AND: [{ score: { gte: 8 } }, { nextFollowUpAt: null }] },
        // Ghost leads: contacted/follow-up but silent for 3+ days
        {
          AND: [
            { status: { in: ["Contacted", "Follow-up"] } },
            { lastContactedAt: { lte: threeDaysAgo } },
            { nextFollowUpAt: null },
          ],
        },
      ],
    },
    orderBy: [
      { score: "desc" },
      { nextFollowUpAt: "asc" },
    ],
    select: {
      id: true,
      businessName: true,
      ownerName: true,
      category: true,
      location: true,
      phone: true,
      email: true,
      notes: true,
      status: true,
      score: true,
      shortSlug: true,
      packageName: true,
      customPrice: true,
      painSummary: true,
      assetsJson: true,
      intelligenceJson: true,
      nextFollowUpAt: true,
      lastContactedAt: true,
    },
  });

  const serialized = leads.map((l) => ({
    ...l,
    publicAuditPath: buildPreferredAuditPath({ leadId: l.id, shortSlug: l.shortSlug }),
    intelligenceJson: l.intelligenceJson ?? null,
    nextFollowUpAt: l.nextFollowUpAt ? l.nextFollowUpAt.toISOString() : null,
    lastContactedAt: l.lastContactedAt ? l.lastContactedAt.toISOString() : null,
  }));

  return <CallTodayDashboard leads={serialized} />;
}
