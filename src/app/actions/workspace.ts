"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceSeatLimit } from "@/lib/billing/entitlements";
import { setUsageMetric } from "@/lib/billing/usage";
import {
  ensureLegacyWorkspaceUser,
  requireSessionRole,
  requireWorkspaceRole,
  setActiveWorkspace,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
});

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

const brandingSchema = z.object({
  publicCompanyName: z.string().max(120).optional(),
  brandName: z.string().max(120).optional(),
  senderIdentity: z.string().max(120).optional(),
  primaryColor: z.string().max(40).optional(),
  accentColor: z.string().max(40).optional(),
  typography: z.string().max(80).optional(),
  footerContent: z.string().max(400).optional(),
  ctaLabelPrimary: z.string().max(120).optional(),
  ctaLabelSecondary: z.string().max(120).optional(),
  auditIntroCopy: z.string().max(1500).optional(),
  auditOutroCopy: z.string().max(1500).optional(),
  customDomain: z.string().max(200).optional(),
  auditSubdomain: z.string().max(120).optional(),
});

function slugifyWorkspace(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
}

async function uniqueWorkspaceSlug(baseName: string) {
  const base = slugifyWorkspace(baseName);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function createWorkspaceAction(formData: FormData) {
  const session = await requireSessionRole(["owner", "admin", "member", "sales", "viewer"]);
  const parsed = createWorkspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: "Workspace name is required." };
  const slug = await uniqueWorkspaceSlug(parsed.data.name);
  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      slug,
      status: "trialing",
      planTier: "free_trial",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  const actorUserId = session.userId ?? (await ensureLegacyWorkspaceUser(session.role, workspace.id));
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: actorUserId, workspaceId: workspace.id } },
    update: { role: "owner" },
    create: {
      userId: actorUserId,
      workspaceId: workspace.id,
      role: "owner",
    },
  });
  await setUsageMetric({ workspaceId: workspace.id, metric: "team_seats", quantity: 1 });
  await prisma.workspaceSettings.create({
    data: {
      workspaceId: workspace.id,
      brandName: "AuditGen",
      defaultTone: "consultative",
      defaultOfferStyle: "outcome-focused",
      senderIdentity: "Team",
      ctaLabelPrimary: "Secure this package",
      ctaLabelSecondary: "Schedule a strategy call",
    },
  });
  await setActiveWorkspace(workspace.id);
  await writeAuditLog({
    action: "workspace.create",
    actorRole: session.role,
    workspaceId: workspace.id,
    metadata: { workspaceName: workspace.name },
  });
  revalidatePath("/");
  return { ok: true, workspaceId: workspace.id };
}

export async function switchWorkspaceAction(formData: FormData) {
  await requireSessionRole(["owner", "admin", "member", "sales", "viewer"]);
  const parsed = switchWorkspaceSchema.safeParse({ workspaceId: formData.get("workspaceId") });
  if (!parsed.success) return { ok: false, error: "Invalid workspace selection." };
  const switched = await setActiveWorkspace(parsed.data.workspaceId);
  if (!switched) return { ok: false, error: "You do not have access to that workspace." };
  revalidatePath("/");
  return { ok: true };
}

export async function inviteWorkspaceMemberAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const inviterUserId = session.userId ?? (await ensureLegacyWorkspaceUser(session.role, session.workspaceId));
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid invitation payload." };
  const seatEntitlement = await enforceSeatLimit(session.workspaceId);
  if (!seatEntitlement.allowed) {
    return { ok: false, error: seatEntitlement.reason || "Seat limit reached for this billing plan." };
  }
  const email = parsed.data.email.toLowerCase();

  const existingMembership = await prisma.membership.findFirst({
    where: {
      workspaceId: session.workspaceId,
      user: { email },
    },
  });
  if (existingMembership) {
    return { ok: false, error: "That user is already a workspace member." };
  }

  const now = new Date();
  const sentToday = await prisma.workspaceInvite.count({
    where: {
      workspaceId: session.workspaceId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (sentToday >= 50) {
    return { ok: false, error: "Invite rate limit reached. Please try again tomorrow." };
  }
  const existingPending = await prisma.workspaceInvite.findFirst({
    where: {
      workspaceId: session.workspaceId,
      email,
      acceptedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (existingPending) {
    return { ok: false, error: "A pending invitation already exists for this email." };
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: session.workspaceId,
      inviterId: inviterUserId,
      email,
      role: parsed.data.role,
      token,
      expiresAt,
    },
  });
  await writeAuditLog({
    action: "workspace.invite.create",
    actorRole: session.role,
    workspaceId: session.workspaceId,
    metadata: { inviteId: invite.id, email, role: parsed.data.role },
  });
  revalidatePath("/");
  return { ok: true, inviteToken: token };
}

export async function acceptWorkspaceInviteAction(token: string) {
  const session = await requireSessionRole(["owner", "admin", "member", "sales", "viewer"]);
  if (!session.userId || !session.email) {
    return { ok: false, error: "You need an account to accept invitations." };
  }
  const parsed = z.string().min(10).safeParse(token);
  if (!parsed.success) return { ok: false, error: "Invalid invitation token." };
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token: parsed.data },
    include: { workspace: true },
  });
  if (!invite) return { ok: false, error: "Invitation not found." };
  if (invite.acceptedAt) return { ok: false, error: "Invitation already accepted." };
  if (invite.expiresAt.getTime() <= Date.now()) return { ok: false, error: "Invitation expired." };
  if (invite.email.toLowerCase() !== session.email.toLowerCase()) {
    return { ok: false, error: "This invite was issued to another email address." };
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_workspaceId: { userId: session.userId, workspaceId: invite.workspaceId } },
      update: { role: invite.role },
      create: { userId: session.userId, workspaceId: invite.workspaceId, role: invite.role },
    }),
    prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);
  const seatCount = await prisma.membership.count({
    where: { workspaceId: invite.workspaceId },
  });
  await setUsageMetric({ workspaceId: invite.workspaceId, metric: "team_seats", quantity: seatCount });
  await setActiveWorkspace(invite.workspaceId);
  await writeAuditLog({
    action: "workspace.invite.accept",
    actorRole: "member",
    workspaceId: invite.workspaceId,
    metadata: { inviteId: invite.id, role: invite.role },
  });
  revalidatePath("/");
  return { ok: true, workspaceSlug: invite.workspace.slug };
}

export async function listWorkspaceInvitesAction() {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const invites = await prisma.workspaceInvite.findMany({
    where: {
      workspaceId: session.workspaceId,
      acceptedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    token: invite.token,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  }));
}

export async function updateWorkspaceBrandingAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const parsed = brandingSchema.safeParse({
    publicCompanyName: formData.get("publicCompanyName") || undefined,
    brandName: formData.get("brandName") || undefined,
    senderIdentity: formData.get("senderIdentity") || undefined,
    primaryColor: formData.get("primaryColor") || undefined,
    accentColor: formData.get("accentColor") || undefined,
    typography: formData.get("typography") || undefined,
    footerContent: formData.get("footerContent") || undefined,
    ctaLabelPrimary: formData.get("ctaLabelPrimary") || undefined,
    ctaLabelSecondary: formData.get("ctaLabelSecondary") || undefined,
    auditIntroCopy: formData.get("auditIntroCopy") || undefined,
    auditOutroCopy: formData.get("auditOutroCopy") || undefined,
    customDomain: formData.get("customDomain") || undefined,
    auditSubdomain: formData.get("auditSubdomain") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid branding settings." };

  try {
    const resolvedBrandName = parsed.data.publicCompanyName?.trim() || "AuditGen";
    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: session.workspaceId },
        data: {
          customDomain: parsed.data.customDomain?.trim() || null,
          auditSubdomain: parsed.data.auditSubdomain?.trim() || null,
        },
      }),
      prisma.workspaceSettings.upsert({
        where: { workspaceId: session.workspaceId },
        update: {
          brandName: resolvedBrandName,
          senderIdentity: parsed.data.senderIdentity?.trim() || null,
          primaryColor: parsed.data.primaryColor?.trim() || null,
          accentColor: parsed.data.accentColor?.trim() || null,
          typography: parsed.data.typography?.trim() || null,
          footerContent: parsed.data.footerContent?.trim() || null,
          ctaLabelPrimary: parsed.data.ctaLabelPrimary?.trim() || null,
          ctaLabelSecondary: parsed.data.ctaLabelSecondary?.trim() || null,
          auditIntroCopy: parsed.data.auditIntroCopy?.trim() || null,
          auditOutroCopy: parsed.data.auditOutroCopy?.trim() || null,
        },
        create: {
          workspaceId: session.workspaceId,
          brandName: resolvedBrandName,
          senderIdentity: parsed.data.senderIdentity?.trim() || null,
          primaryColor: parsed.data.primaryColor?.trim() || null,
          accentColor: parsed.data.accentColor?.trim() || null,
          typography: parsed.data.typography?.trim() || null,
          footerContent: parsed.data.footerContent?.trim() || null,
          ctaLabelPrimary: parsed.data.ctaLabelPrimary?.trim() || null,
          ctaLabelSecondary: parsed.data.ctaLabelSecondary?.trim() || null,
          auditIntroCopy: parsed.data.auditIntroCopy?.trim() || null,
          auditOutroCopy: parsed.data.auditOutroCopy?.trim() || null,
        },
      }),
    ]);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update branding settings." };
  }

  revalidatePath("/");
  revalidatePath("/templates");
  return { ok: true };
}
