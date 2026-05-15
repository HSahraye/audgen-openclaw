import { AuditDashboard } from "@/components/audit-dashboard";
import { OnboardingWizardCard } from "@/components/onboarding-wizard-card";
import { listCurrentUserWorkspaces, requireSessionRole } from "@/lib/auth";
import { buildPreferredAuditPath } from "@/lib/audit-links";
import { resolvePublicSenderName } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/url";
import { getOnboardingWizardState } from "@/lib/onboarding/wizard";
import { withWorkspaceFallbackScope } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireSessionRole(["owner", "admin", "member", "sales", "viewer"]);
  const workspaceId = session.workspaceId;
  const publicBaseUrl = getPublicBaseUrl();
  const workspaceOptions = await listCurrentUserWorkspaces();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);

  const leads = await prisma.lead.findMany({
    where: withWorkspaceFallbackScope(workspaceId),
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    include: {
      outreachLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      viewLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      attachedCaseStudy: true,
      paymentLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      sequenceStates: {
        where: { status: { in: ["active", "paused"] } },
        include: {
          sequence: { select: { id: true, name: true } },
          outboundMessages: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, retryCount: true, createdAt: true } },
        },
        take: 5,
      },
    },
  });

  const viewCounts = await prisma.viewLog.groupBy({
    by: ["leadId"],
    where: withWorkspaceFallbackScope(workspaceId),
    _count: { leadId: true },
  });
  const todayOutreach = await prisma.outreachLog.groupBy({
    by: ["type"],
    where: { ...withWorkspaceFallbackScope(workspaceId), createdAt: { gte: startOfToday } },
    _count: { type: true },
  });
  const viewCountByLead = new Map(viewCounts.map((item) => [item.leadId, item._count.leadId]));
  const paymentCounts = await prisma.paymentLog.groupBy({
    by: ["leadId"],
    where: withWorkspaceFallbackScope(workspaceId),
    _count: { leadId: true },
  });
  const paymentCountByLead = new Map(paymentCounts.map((item) => [item.leadId, item._count.leadId]));
  const caseStudies = await prisma.caseStudy.findMany({ where: withWorkspaceFallbackScope(workspaceId), orderBy: [{ updatedAt: "desc" }] });
  const latestImportJob = await prisma.importJob.findFirst({
    where: { ...withWorkspaceFallbackScope(workspaceId), status: { in: ["Queued", "Running"] } },
    orderBy: { createdAt: "desc" },
  });
  const recentImportJobs = await prisma.importJob.findMany({
    where: withWorkspaceFallbackScope(workspaceId),
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const [queueDepth, failedJobsCount, eventsLast24h] = await Promise.all([
    prisma.importJob.count({ where: { ...withWorkspaceFallbackScope(workspaceId), status: { in: ["Queued", "Running"] } } }),
    prisma.importJob.count({ where: { ...withWorkspaceFallbackScope(workspaceId), status: "Failed" } }),
    prisma.eventLog.count({ where: { ...withWorkspaceFallbackScope(workspaceId), createdAt: { gte: last24Hours } } }),
  ]);
  const sequences = await prisma.sequence.findMany({
    where: { workspaceId },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Onboarding wizard state. Failure is non-fatal: if the helper throws,
  // the rest of the dashboard still renders without the wizard card.
  let wizardState: Awaited<ReturnType<typeof getOnboardingWizardState>> | null = null;
  try {
    wizardState = await getOnboardingWizardState(workspaceId);
  } catch {
    wizardState = null;
  }

  const workspaceSettings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  const senderCompanyName = resolvePublicSenderName(
    {
      brandName: workspaceSettings?.brandName ?? null,
      publicCompanyName: workspaceSettings?.brandName ?? null,
    },
  );

  return (
    <>
      {wizardState ? <OnboardingWizardCard state={wizardState} /> : null}
      <AuditDashboard
      latestImportJob={
        latestImportJob
          ? {
              id: latestImportJob.id,
              status: latestImportJob.status,
              mode: latestImportJob.mode,
              totalRows: latestImportJob.totalRows,
              processedRows: latestImportJob.processedRows,
              importedRows: latestImportJob.importedRows,
              skippedRows: latestImportJob.skippedRows,
              failedRows: latestImportJob.failedRows,
              errorSummary: latestImportJob.errorSummary,
              createdAt: latestImportJob.createdAt.toISOString(),
              startedAt: latestImportJob.startedAt?.toISOString() ?? null,
              completedAt: latestImportJob.completedAt?.toISOString() ?? null,
              updatedAt: latestImportJob.updatedAt.toISOString(),
            }
          : null
      }
      importJobs={recentImportJobs.map((job) => ({
        id: job.id,
        status: job.status,
        mode: job.mode,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        importedRows: job.importedRows,
        skippedRows: job.skippedRows,
        failedRows: job.failedRows,
        errorSummary: job.errorSummary,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        updatedAt: job.updatedAt.toISOString(),
      }))}
      opsMetrics={{
        queueDepth,
        failedJobsCount,
        eventsLast24h,
      }}
      activeWorkspaceId={workspaceId}
      workspaceOptions={workspaceOptions.map((workspace) => ({
        workspaceId: workspace.workspaceId,
        workspaceSlug: workspace.workspaceSlug,
        workspaceName: workspace.workspaceName,
        role: String(workspace.role),
      }))}
      canManageWorkspace={session.role === "owner" || session.role === "admin"}
      publicBaseUrl={publicBaseUrl}
      senderCompanyName={senderCompanyName}
      sequences={sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        status: sequence.status,
      }))}
      caseStudies={caseStudies.map((caseStudy) => ({
        id: caseStudy.id,
        title: caseStudy.title,
        result: caseStudy.result,
        description: caseStudy.description,
        imageUrl: caseStudy.imageUrl,
        category: caseStudy.category,
      }))}
      todayActivity={{
        calls: todayOutreach.find((item) => item.type === "Call")?._count.type ?? 0,
        sms: todayOutreach.filter((item) => item.type === "SMS").reduce((sum, item) => sum + item._count.type, 0),
        emails: todayOutreach.find((item) => item.type === "Email")?._count.type ?? 0,
      }}
      leads={leads.map((lead) => ({
        id: lead.id,
        businessName: lead.businessName,
        ownerName: lead.ownerName,
        category: lead.category,
        location: lead.location,
        websiteUrl: lead.websiteUrl,
        googleProfileUrl: lead.googleProfileUrl,
        phone: lead.phone,
        email: lead.email,
        notes: lead.notes,
        status: lead.status,
        score: lead.score,
        shortSlug: lead.shortSlug,
        publicAuditPath: buildPreferredAuditPath({ leadId: lead.id, shortSlug: lead.shortSlug }),
        packageName: lead.packageName,
        customPrice: lead.customPrice,
        stripePaymentUrl: lead.stripePaymentUrl,
        attachedCaseStudyId: lead.attachedCaseStudyId,
        attachedCaseStudy: lead.attachedCaseStudy ? { id: lead.attachedCaseStudy.id, title: lead.attachedCaseStudy.title, result: lead.attachedCaseStudy.result, description: lead.attachedCaseStudy.description, imageUrl: lead.attachedCaseStudy.imageUrl, category: lead.attachedCaseStudy.category } : null,
        painSummary: lead.painSummary,
        auditJson: lead.auditJson,
        assetsJson: lead.assetsJson,
        intelligenceJson: lead.intelligenceJson ?? null,
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
        lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
        outreachLogs: lead.outreachLogs.map((log) => ({ id: log.id, type: log.type, notes: log.notes, createdAt: log.createdAt.toISOString() })),
        viewCount: viewCountByLead.get(lead.id) ?? 0,
        lastViewedAt: lead.viewLogs[0]?.createdAt.toISOString() ?? null,
        paymentClickCount: paymentCountByLead.get(lead.id) ?? 0,
        lastPaymentClickedAt: lead.paymentLogs[0]?.createdAt.toISOString() ?? null,
        paymentStatus: lead.paymentStatus,
        lastPaymentAt: lead.lastPaymentAt?.toISOString() ?? null,
        sequenceStates: lead.sequenceStates.map((state) => ({
          id: state.id,
          sequenceId: state.sequenceId,
          sequenceName: state.sequence.name,
          status: state.status,
          currentStep: state.currentStep,
          nextRunAt: state.nextRunAt?.toISOString() ?? null,
          lastError: state.lastError,
          lastMessageStatus: state.outboundMessages[0]?.status ?? null,
          lastMessageRetryCount: state.outboundMessages[0]?.retryCount ?? 0,
          lastMessageAt: state.outboundMessages[0]?.createdAt.toISOString() ?? null,
        })),
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }))}
      />
    </>
  );
}
