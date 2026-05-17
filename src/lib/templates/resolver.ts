import { prisma } from "@/lib/prisma";
import {
  SYSTEM_DEFAULT_AUDIT_TEMPLATES,
  SYSTEM_DEFAULT_OFFER_TEMPLATE,
  SYSTEM_DEFAULT_OUTREACH_TEMPLATE,
} from "@/lib/templates/defaults";
import {
  AuditTemplateConfigSchema,
  BaseTemplateConfigSchema,
  OfferTemplateConfigSchema,
  OutreachTemplateConfigSchema,
  type ResolvedTemplate,
  type TemplateKind,
} from "@/lib/templates/types";
import { strictWorkspaceScope } from "@/lib/workspace";

const CACHE_TTL_MS = 60_000;
const templateCache = new Map<string, { expiresAt: number; value: ResolvedTemplate }>();

function cacheKey(workspaceId: string, kind: TemplateKind, category?: string | null) {
  return `${workspaceId}:${kind}:${(category || "").trim().toLowerCase()}`;
}

function parseConfig(kind: TemplateKind, raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (kind === "audit") return AuditTemplateConfigSchema.parse(parsed);
    if (kind === "outreach") return OutreachTemplateConfigSchema.parse(parsed);
    return OfferTemplateConfigSchema.parse(parsed);
  } catch {
    if (kind === "audit") return Object.values(SYSTEM_DEFAULT_AUDIT_TEMPLATES)[0];
    if (kind === "outreach") return SYSTEM_DEFAULT_OUTREACH_TEMPLATE;
    return SYSTEM_DEFAULT_OFFER_TEMPLATE;
  }
}

function systemDefault(kind: TemplateKind): ResolvedTemplate {
  if (kind === "audit") {
    const [name, config] = Object.entries(SYSTEM_DEFAULT_AUDIT_TEMPLATES)[0];
    return { id: "system-audit-default", name, kind: "audit", source: "system", category: null, version: 1, config };
  }
  if (kind === "outreach") {
    return {
      id: "system-outreach-default",
      name: "General Growth Outreach",
      kind: "outreach",
      source: "system",
      category: null,
      version: 1,
      config: SYSTEM_DEFAULT_OUTREACH_TEMPLATE,
    };
  }
  return {
    id: "system-offer-default",
    name: "General Growth Proposal",
    kind: "offer",
    source: "system",
    category: null,
    version: 1,
    config: SYSTEM_DEFAULT_OFFER_TEMPLATE,
  };
}

async function findTemplate(workspaceId: string, kind: TemplateKind, category?: string | null) {
  const normalizedCategory = category?.trim() || null;
  if (kind === "audit") {
    if (normalizedCategory) {
      const byCategory = await prisma.auditTemplate.findFirst({
        where: { ...strictWorkspaceScope(workspaceId), isActive: true, archived: false, category: normalizedCategory },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });
      if (byCategory) return byCategory;
    }
    return prisma.auditTemplate.findFirst({
      where: { ...strictWorkspaceScope(workspaceId), isActive: true, archived: false, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (kind === "outreach") {
    if (normalizedCategory) {
      const byCategory = await prisma.outreachTemplate.findFirst({
        where: { ...strictWorkspaceScope(workspaceId), isActive: true, archived: false, category: normalizedCategory },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });
      if (byCategory) return byCategory;
    }
    return prisma.outreachTemplate.findFirst({
      where: { ...strictWorkspaceScope(workspaceId), isActive: true, archived: false, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (normalizedCategory) {
    const byCategory = await prisma.offerTemplate.findFirst({
      where: { ...strictWorkspaceScope(workspaceId), isActive: true, archived: false, category: normalizedCategory },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    if (byCategory) return byCategory;
  }
  return prisma.offerTemplate.findFirst({
    where: { ...strictWorkspaceScope(workspaceId), isActive: true, archived: false, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function resolveTemplate(workspaceId: string, kind: TemplateKind, category?: string | null): Promise<ResolvedTemplate> {
  const key = cacheKey(workspaceId, kind, category);
  const cached = templateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const record = await findTemplate(workspaceId, kind, category);
  const value: ResolvedTemplate = record
    ? {
        id: record.id,
        name: record.name,
        kind,
        source: record.category ? "category" : "default",
        category: record.category ?? null,
        version: record.version ?? 1,
        config: parseConfig(kind, record.contentJson),
      }
    : systemDefault(kind);

  templateCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function normalizeTemplateConfig(raw: unknown) {
  return BaseTemplateConfigSchema.parse(raw);
}
