import Link from "next/link";
import { requireWorkspaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateManager } from "@/components/template-manager";
import { TEMPLATES_PAGE_INTRO } from "@/app/templates/templates-empty-state";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const [workspace, settings, auditTemplates, outreachTemplates, offerTemplates] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.workspaceSettings.findUnique({ where: { workspaceId: session.workspaceId } }),
    prisma.auditTemplate.findMany({ where: { workspaceId: session.workspaceId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }),
    prisma.outreachTemplate.findMany({ where: { workspaceId: session.workspaceId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }),
    prisma.offerTemplate.findMany({ where: { workspaceId: session.workspaceId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }),
  ]);

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-700">Template Studio</p>
            <h1 className="mt-1 text-2xl font-black">{workspace?.name || "Workspace"} templates</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{TEMPLATES_PAGE_INTRO}</p>
          </div>
          <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
            Back to Dashboard
          </Link>
        </div>
        <TemplateManager
          workspaceSettings={{
            publicCompanyName: settings?.brandName || "AuditGen",
            brandName: settings?.brandName || "",
            senderIdentity: settings?.senderIdentity || "",
            ctaLabelPrimary: settings?.ctaLabelPrimary || "",
            ctaLabelSecondary: settings?.ctaLabelSecondary || "",
            auditIntroCopy: settings?.auditIntroCopy || "",
            auditOutroCopy: settings?.auditOutroCopy || "",
            primaryColor: settings?.primaryColor || "",
            accentColor: settings?.accentColor || "",
            typography: settings?.typography || "",
            footerContent: settings?.footerContent || "",
          }}
          templates={{
            audit: auditTemplates.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              isDefault: item.isDefault,
              isActive: item.isActive,
              archived: item.archived,
              version: item.version,
              contentJson: item.contentJson,
            })),
            outreach: outreachTemplates.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              isDefault: item.isDefault,
              isActive: item.isActive,
              archived: item.archived,
              version: item.version,
              contentJson: item.contentJson,
            })),
            offer: offerTemplates.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              isDefault: item.isDefault,
              isActive: item.isActive,
              archived: item.archived,
              version: item.version,
              contentJson: item.contentJson,
            })),
          }}
          workspace={{
            customDomain: workspace?.customDomain || "",
            auditSubdomain: workspace?.auditSubdomain || "",
          }}
        />
      </div>
    </main>
  );
}
