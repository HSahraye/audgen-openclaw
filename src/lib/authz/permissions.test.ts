import { describe, it, expect } from "vitest";
import { can, permissionsFor, PERMISSION_MATRIX } from "./permissions";

describe("permission matrix", () => {
  it("denies when role is null or undefined", () => {
    expect(can(null, "view_dashboard")).toBe(false);
    expect(can(undefined, "import_leads")).toBe(false);
  });

  it("owner can do everything", () => {
    for (const action of Object.keys(PERMISSION_MATRIX)) {
      expect(can("owner", action as keyof typeof PERMISSION_MATRIX)).toBe(true);
    }
  });

  it("viewer can only read (view_*)", () => {
    expect(can("viewer", "view_leads")).toBe(true);
    expect(can("viewer", "view_pipeline_metrics")).toBe(true);
    expect(can("viewer", "import_leads")).toBe(false);
    expect(can("viewer", "send_outreach")).toBe(false);
    expect(can("viewer", "invite_member")).toBe(false);
    expect(can("viewer", "manage_billing")).toBe(false);
  });

  it("sales can run the sales motion but cannot touch workspace settings", () => {
    expect(can("sales", "send_outreach")).toBe(true);
    expect(can("sales", "log_reply")).toBe(true);
    expect(can("sales", "transition_lead_stage")).toBe(true);
    expect(can("sales", "edit_templates")).toBe(false);
    expect(can("sales", "invite_member")).toBe(false);
    expect(can("sales", "manage_billing")).toBe(false);
  });

  it("member can do everything sales can, plus send proposals and log outcomes", () => {
    expect(can("member", "send_outreach")).toBe(true);
    expect(can("member", "send_proposal")).toBe(true);
    expect(can("member", "log_outcome")).toBe(true);
    expect(can("member", "edit_templates")).toBe(false);
    expect(can("member", "change_member_role")).toBe(false);
  });

  it("admin can manage templates and invite/remove members but cannot change roles or billing", () => {
    expect(can("admin", "edit_templates")).toBe(true);
    expect(can("admin", "edit_sequences")).toBe(true);
    expect(can("admin", "invite_member")).toBe(true);
    expect(can("admin", "remove_member")).toBe(true);
    expect(can("admin", "change_member_role")).toBe(false);
    expect(can("admin", "manage_billing")).toBe(false);
    expect(can("admin", "delete_workspace")).toBe(false);
  });

  it("only owner can manage billing, change roles, delete workspace", () => {
    expect(can("owner", "manage_billing")).toBe(true);
    expect(can("owner", "change_member_role")).toBe(true);
    expect(can("owner", "delete_workspace")).toBe(true);
  });

  it("permissionsFor returns a meaningful list and respects role rank", () => {
    expect(permissionsFor(null)).toEqual([]);
    const owner = permissionsFor("owner");
    const viewer = permissionsFor("viewer");
    // Owner permissions are a superset of viewer permissions.
    for (const v of viewer) expect(owner).toContain(v);
    expect(owner.length).toBeGreaterThan(viewer.length);
  });
});
