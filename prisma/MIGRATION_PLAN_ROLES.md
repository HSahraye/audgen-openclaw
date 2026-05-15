# Migration plan — extend `MembershipRole` and ship team management

Status: **proposed, not executed**. Schema-touching steps require explicit
approval and a DB backup.

## Goal

Today `MembershipRole` has three values: `owner`, `admin`, `member`. The
application layer (src/lib/auth.ts → AppRole) already speaks two more:
`sales` and `viewer`. The permission matrix in
src/lib/authz/permissions.ts is the source of truth for what each role
can do.

We want:
1. Real first-class `sales` and `viewer` enum values in the DB.
2. An Invite flow that anyone with `invite_member` permission can use.
3. A Role-change flow gated by `change_member_role` (owner-only).
4. A Member-list UI behind `view_workspace_settings`.

Until those land, the application enforces the policy through
`can(role, action)` so behaviour is correct; the DB just stores the
narrower enum.

## Schema delta

```prisma
enum MembershipRole {
  owner
  admin
  member
  sales
  viewer
}

model WorkspaceInvite {
  // already exists; verify the role column accepts the wider enum after
  // the migration.
}
```

## Migration steps (in order)

1. **DB backup.** `pg_dump`, restore-test in staging.
2. **Add enum values.** Single SQL: `ALTER TYPE "MembershipRole" ADD VALUE 'sales'`
   then `ALTER TYPE "MembershipRole" ADD VALUE 'viewer'`. Postgres only
   allows ADD VALUE in its own transaction; do this in a maintenance window.
3. **Regenerate Prisma client** and ship a release that knows about the
   wider enum but doesn't yet use it.
4. **Ship the Invite + Member-list UI** behind the existing permissions.
   No DB change in this step.
5. **Allow role assignment to use the new values.** Add UI dropdown with
   the five values. Server-side validation goes through
   `change_member_role` permission (owner-only).
6. **Backfill existing legacy `pl_session` users** that have been
   masquerading as `owner` via the workspace fallback. Set them to the
   true intended role (most likely `viewer` or `sales`). This is the
   only step that touches user data and MUST run from an explicit
   one-off script with logs.

## Rollback

Postgres can't remove an enum value, but it can be ignored. If we need
to revert:
1. Stop writing the new values from the app.
2. UPDATE any rows with sales/viewer back to `member`.
3. Ship a release that doesn't speak the new values.
4. (Optional) Schedule a future maintenance to drop the values via
   recreating the enum.

## Approval checklist

- [ ] Hamid approves the schema change timing.
- [ ] DB backup taken and restore-tested.
- [ ] Staging migration completes.
- [ ] Permission matrix tests stay green (`src/lib/authz/permissions.test.ts`).
- [ ] No legacy `pl_session` user remains marked as owner of a workspace
      they should not own. (Phase 0 already removed the auto-elevation
      bug; this is the data-side cleanup.)

Until every box is ticked, the application-layer permission matrix is
the source of truth.
