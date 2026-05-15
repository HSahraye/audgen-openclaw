import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit-links", () => ({ verifyAuditAccessToken: vi.fn() }));
vi.mock("@/lib/authz", () => ({ assertApiSessionWorkspace: vi.fn() }));
vi.mock("@/lib/env", () => ({ isAuthEnabled: vi.fn(), getEnv: () => ({}) }));
vi.mock("@/lib/request-security", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/automation/workflows", () => ({
  triggerWorkflows: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/automation/pipeline", () => ({
  applyPipelineAutomation: vi.fn().mockResolvedValue(undefined),
}));

const leadFindUnique = vi.fn();
const activityCreate = vi.fn().mockResolvedValue({ id: "a1" });
const proposalDeliveryUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { get findUnique() { return leadFindUnique; } },
    activity: { get create() { return activityCreate; } },
    proposalDelivery: { get updateMany() { return proposalDeliveryUpdateMany; } },
  },
}));

import { verifyAuditAccessToken } from "@/lib/audit-links";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { isAuthEnabled } from "@/lib/env";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/proposals/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  leadFindUnique.mockReset();
  activityCreate.mockReset().mockResolvedValue({ id: "a1" });
  proposalDeliveryUpdateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("POST /api/proposals/events", () => {
  it("rejects invalid body", async () => {
    const res = await POST(jsonRequest({ leadId: "lead_1" })); // missing eventType
    expect(res.status).toBe(400);
  });

  it("rejects when the lead does not exist", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue(null);
    const res = await POST(jsonRequest({ leadId: "missing", eventType: "opened" }));
    expect(res.status).toBe(404);
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller without a signed token", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_real" });
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(jsonRequest({ leadId: "lead_1", eventType: "opened" }));
    expect(res.status).toBe(404);
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("IGNORES a body workspaceId; uses the lead's real workspace", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_real" });
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const res = await POST(jsonRequest({
      leadId: "lead_1",
      eventType: "opened",
      token: "valid",
      // attacker-injected workspaceId in the body \u2014 must be ignored.
      workspaceId: "ws_attacker",
    } as unknown));
    expect(res.status).toBe(200);
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws_real", type: "proposal.opened" }),
      }),
    );
  });

  it("rejects a workspace user trying to write to another workspace's lead", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_B" });
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({
      workspaceId: "ws_A",
      userId: "uA",
      role: "owner",
      authProvider: "better-auth",
    });
    const res = await POST(jsonRequest({ leadId: "lead_1", eventType: "accepted" }));
    expect(res.status).toBe(404);
    expect(activityCreate).not.toHaveBeenCalled();
    expect(proposalDeliveryUpdateMany).not.toHaveBeenCalled();
  });

  it("scopes proposalDelivery update to leadId AND lead's workspaceId", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_real" });
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const res = await POST(jsonRequest({
      leadId: "lead_1",
      eventType: "accepted",
      proposalDeliveryId: "pd_1",
      token: "valid",
    }));
    expect(res.status).toBe(200);
    expect(proposalDeliveryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pd_1", workspaceId: "ws_real", leadId: "lead_1" },
        data: expect.objectContaining({ acceptedAt: expect.any(Date) }),
      }),
    );
  });
});
