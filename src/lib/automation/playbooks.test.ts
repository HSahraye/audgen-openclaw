import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  playbookCreate: vi.fn(),
  playbookFindFirst: vi.fn(),
  createSequence: vi.fn(),
  startLeadSequence: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    playbook: {
      create: mocks.playbookCreate,
      findFirst: mocks.playbookFindFirst,
    },
  },
}));

vi.mock("@/lib/automation/outreach/sequences", () => ({
  createSequence: mocks.createSequence,
  startLeadSequence: mocks.startLeadSequence,
}));

import { applyPlaybookToLead, createPlaybook } from "./playbooks";

describe("createPlaybook", () => {
  beforeEach(() => {
    mocks.playbookCreate.mockReset();
    mocks.createSequence.mockReset();
  });

  it("creates a playbook with no sequence when no sequenceTemplate provided", async () => {
    mocks.playbookCreate.mockResolvedValue({ id: "pb_1" });
    await createPlaybook({ workspaceId: "ws_1", name: "Quick Wins" });
    expect(mocks.createSequence).not.toHaveBeenCalled();
    const data = mocks.playbookCreate.mock.calls[0][0].data;
    expect(data.sequenceId).toBe(null);
    expect(data.name).toBe("Quick Wins");
    expect(data.isActive).toBe(true);
    expect(data.workflowIdsJson).toBe("[]");
    expect(data.templateIdsJson).toBe("[]");
  });

  it("creates a sequence first and links it when sequenceTemplate is provided", async () => {
    mocks.createSequence.mockResolvedValue({ id: "seq_42" });
    mocks.playbookCreate.mockResolvedValue({ id: "pb_2" });
    await createPlaybook({
      workspaceId: "ws_1",
      name: "Cold Outreach",
      category: "hvac",
      sequenceTemplate: [
        { name: "Day 0 email", channel: "email", delayMinutes: 0 },
        { name: "Day 3 sms", channel: "sms", delayMinutes: 4320 },
      ],
    });
    expect(mocks.createSequence).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      name: "Cold Outreach Sequence",
      category: "hvac",
      steps: [
        { name: "Day 0 email", channel: "email", delayMinutes: 0 },
        { name: "Day 3 sms", channel: "sms", delayMinutes: 4320 },
      ],
    });
    expect(mocks.playbookCreate.mock.calls[0][0].data.sequenceId).toBe("seq_42");
  });

  it("skips sequence creation when sequenceTemplate is an empty array", async () => {
    mocks.playbookCreate.mockResolvedValue({ id: "pb_3" });
    await createPlaybook({
      workspaceId: "ws_1",
      name: "Empty",
      sequenceTemplate: [],
    });
    expect(mocks.createSequence).not.toHaveBeenCalled();
    expect(mocks.playbookCreate.mock.calls[0][0].data.sequenceId).toBe(null);
  });

  it("coerces missing optional fields to null on the row", async () => {
    mocks.playbookCreate.mockResolvedValue({ id: "pb_4" });
    await createPlaybook({ workspaceId: "ws_1", name: "Bare" });
    const data = mocks.playbookCreate.mock.calls[0][0].data;
    expect(data.category).toBe(null);
    expect(data.description).toBe(null);
  });
});

describe("applyPlaybookToLead", () => {
  beforeEach(() => {
    mocks.playbookFindFirst.mockReset();
    mocks.startLeadSequence.mockReset();
  });

  it("returns { ok: false } when no active playbook matches", async () => {
    mocks.playbookFindFirst.mockResolvedValue(null);
    const result = await applyPlaybookToLead({
      workspaceId: "ws_1",
      playbookId: "pb_404",
      leadId: "lead_1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Playbook not found.");
    expect(mocks.startLeadSequence).not.toHaveBeenCalled();
  });

  it("starts the linked sequence when playbook has one", async () => {
    mocks.playbookFindFirst.mockResolvedValue({
      id: "pb_1",
      sequenceId: "seq_99",
    });
    mocks.startLeadSequence.mockResolvedValue({ ok: true });
    const result = await applyPlaybookToLead({
      workspaceId: "ws_1",
      playbookId: "pb_1",
      leadId: "lead_42",
    });
    expect(mocks.startLeadSequence).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      sequenceId: "seq_99",
      leadId: "lead_42",
    });
    expect(result.ok).toBe(true);
  });

  it("propagates startLeadSequence failure verbatim", async () => {
    mocks.playbookFindFirst.mockResolvedValue({
      id: "pb_1",
      sequenceId: "seq_99",
    });
    mocks.startLeadSequence.mockResolvedValue({ ok: false, error: "limit hit" });
    const result = await applyPlaybookToLead({
      workspaceId: "ws_1",
      playbookId: "pb_1",
      leadId: "lead_42",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("limit hit");
  });

  it("succeeds without starting a sequence when playbook has no sequenceId", async () => {
    mocks.playbookFindFirst.mockResolvedValue({
      id: "pb_1",
      sequenceId: null,
    });
    const result = await applyPlaybookToLead({
      workspaceId: "ws_1",
      playbookId: "pb_1",
      leadId: "lead_42",
    });
    expect(mocks.startLeadSequence).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("scopes the playbook lookup to workspaceId AND isActive=true", async () => {
    mocks.playbookFindFirst.mockResolvedValue({ id: "pb_x", sequenceId: null });
    await applyPlaybookToLead({
      workspaceId: "ws_42",
      playbookId: "pb_x",
      leadId: "lead_1",
    });
    const where = mocks.playbookFindFirst.mock.calls[0][0].where;
    expect(where.id).toBe("pb_x");
    expect(where.workspaceId).toBe("ws_42");
    expect(where.isActive).toBe(true);
  });
});
