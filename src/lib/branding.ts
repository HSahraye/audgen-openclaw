type WorkspaceSettingsLike = Partial<{
  senderCompanyName: string | null;
  brandName: string | null;
  agencyName: string | null;
  publicCompanyName: string | null;
}>;

const INTERNAL_WORKSPACE_NAMES = new Set(["default workspace", "workspace", "default"]);

function clean(value?: string | null) {
  return (value || "").trim();
}

// Default brand fallback shown to prospects on the public audit page
// header ("Prepared by ...") and in templated cold-call / email copy
// when no per-workspace brand has been configured. Workspaces that
// HAVE set their own `brandName` / `publicCompanyName` continue to
// see their custom brand — the fallback only kicks in when nothing
// is configured.
const DEFAULT_PUBLIC_BRAND = "AuditGen";

export function resolvePublicSenderName(
  workspaceSettings?: WorkspaceSettingsLike | null,
) {
  const candidates = [
    clean(workspaceSettings?.publicCompanyName),
    clean(workspaceSettings?.senderCompanyName),
    clean(workspaceSettings?.agencyName),
    clean(workspaceSettings?.brandName),
    DEFAULT_PUBLIC_BRAND,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (INTERNAL_WORKSPACE_NAMES.has(candidate.toLowerCase())) continue;
    return candidate;
  }

  return DEFAULT_PUBLIC_BRAND;
}

export function sanitizePublicBrandCopy(copy: string) {
  return copy
    .replace(/\bfrom\s+default workspace\b/gi, `from ${DEFAULT_PUBLIC_BRAND}`)
    .replace(/\bdefault workspace\b/gi, DEFAULT_PUBLIC_BRAND);
}
