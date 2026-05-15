/**
 * Workspace-role permission matrix (skeleton).
 *
 * Every workspace-scoped action goes through `can(role, action)` so the
 * permission rules live in one table, not scattered across routes and
 * pages. Roles match the Prisma `MembershipRole` enum today (owner,
 * admin, member). The app layer also recognises 'sales' and 'viewer'
 * (see src/lib/auth.ts type AppRole); they map onto 'member' for DB
 * concerns but get distinct permissions here.
 *
 * Rules to live by:
 *  - This is the source of truth. Routes should not re-implement role
 *    checks inline; they should call requireWorkspaceCan(action).
 *  - Default DENY. Any action not explicitly granted is forbidden.
 *  - Owners get everything that admins get; admins get everything that
 *    members get; members get everything that sales gets; sales get
 *    everything that viewer gets. The order is enforced by ROLE_ORDER.
 *
 * Migration plan (proposed; not executed):
 *  - Extend `MembershipRole` to add `sales` and `viewer` as real enum
 *    values, or keep them application-only with a fallback to member.
 *  - Add an Invite UI behind requireWorkspaceCan("invite_member").
 *  - Add an audit log row for every role change.
 *  See prisma/MIGRATION_PLAN_ROLES.md (this branch).
 */

export type WorkspaceRole = "owner" | "admin" | "member" | "sales" | "viewer";

export type WorkspaceAction =
  // Read
  | "view_dashboard"
  | "view_leads"
  | "view_lead_detail"
  | "view_audit"
  | "view_pipeline_metrics"
  | "view_workspace_settings"
  | "view_billing"
  // Write \u2014 day-to-day sales motion
  | "import_leads"
  | "score_leads"
  | "generate_audit"
  | "prepare_outreach"
  | "send_outreach"
  | "log_reply"
  | "transition_lead_stage"
  | "send_proposal"
  | "log_outcome"
  // Write \u2014 workspace ops
  | "edit_templates"
  | "edit_sequences"
  | "edit_workspace_settings"
  | "invite_member"
  | "remove_member"
  | "change_member_role"
  | "manage_billing"
  | "delete_workspace";

const ROLE_ORDER: WorkspaceRole[] = ["viewer", "sales", "member", "admin", "owner"];

function rank(role: WorkspaceRole): number {
  return ROLE_ORDER.indexOf(role);
}

/**
 * Minimum role required for each action. "owner" actions are the most
 * restrictive; "viewer" is the most permissive (read-only). The
 * permission resolver below uses ranks so a higher role inherits.
 */
export const PERMISSION_MATRIX: Record<WorkspaceAction, WorkspaceRole> = {
  // Read \u2014 every member of the workspace can read.
  view_dashboard: "viewer",
  view_leads: "viewer",
  view_lead_detail: "viewer",
  view_audit: "viewer",
  view_pipeline_metrics: "viewer",
  view_workspace_settings: "viewer",
  view_billing: "member", // billing reveals plan + price \u2014 keep out of viewer

  // Sales motion \u2014 sales-and-up
  import_leads: "sales",
  score_leads: "sales",
  generate_audit: "sales",
  prepare_outreach: "sales",
  send_outreach: "sales",
  log_reply: "sales",
  transition_lead_stage: "sales",
  send_proposal: "member",
  log_outcome: "member",

  // Workspace ops \u2014 admin-and-up
  edit_templates: "admin",
  edit_sequences: "admin",
  edit_workspace_settings: "admin",
  invite_member: "admin",
  remove_member: "admin",
  change_member_role: "owner",
  manage_billing: "owner",
  delete_workspace: "owner",
};

export function can(role: WorkspaceRole | null | undefined, action: WorkspaceAction): boolean {
  if (!role) return false;
  const requiredRole = PERMISSION_MATRIX[action];
  if (!requiredRole) return false;
  return rank(role) >= rank(requiredRole);
}

/**
 * Convenience: returns the list of actions the role can perform. Useful
 * for client-side gating of UI affordances (which still must be re-
 * enforced server-side at the action handler).
 */
export function permissionsFor(role: WorkspaceRole | null | undefined): WorkspaceAction[] {
  if (!role) return [];
  return (Object.keys(PERMISSION_MATRIX) as WorkspaceAction[]).filter((a) => can(role, a));
}
