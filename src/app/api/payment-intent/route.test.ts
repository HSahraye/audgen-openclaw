import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit-links", () => ({
  verifyAuditAccessToken: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({
  assertApiSessionWorkspace: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  isAuthEnabled: vi.fn(),
  getEnv: () => ({}),
}));
vi.mock("@/lib/request-security", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  getClientRequestMeta: vi.fn().mockResolvedValue({ ip: "1.1.1.1", userAgent: "vitest" }),
}));
vi.mock("@/lib/automation/workflows", () => ({
  triggerWorkflows: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/automation/pipeline", () => ({
  applyPipelineAutomation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/analytics/events", () => ({
  trackSalesOsEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/events", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

const leadFindUnique = vi.fn();
const leadFindFirst = vi.fn();
const leadUpdate = vi.fn().mockResolvedValue({ id: "lead_1" });
const paymentLogCreate = vi.fn().mockResolvedValue({ id: "p1" });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      get findUnique() { return leadFindUnique; },
      get findFirst() { return leadFindFirst; },
      get update() { return leadUpdate; },
    },
    paymentLog: { get create() { return paymentLogCreate; } },
  },
}));

import { verifyAuditAccessToken } from "@/lib/audit-links";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { isAuthEnabled } from "@/lib/env";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/payment-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  leadFindUnique.mockReset();
  leadFindFirst.mockReset();
  leadUpdate.mockReset().mockResolvedValue({ id: "lead_1" });
  paymentLogCreate.mockReset().mockResolvedValue({ id: "p1" });
});

describe("POST /api/payment-intent", () => {
  it("rejects invalid body", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("refuses to write when the lead has no workspaceId (no default fallback)", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: null });
    const res = await POST(jsonRequest({ leadId: "lead_1" }));
    expect(res.status).toBe(404);
    expect(paymentLogCreate).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller without a signed token", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(jsonRequest({ leadId: "lead_1" }));
    expect(res.status).toBe(404);
    expect(paymentLogCreate).not.toHaveBeenCalled();
  });

  it("accepts a prospect with a valid signed audit token", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_real" });
    const res = await POST(jsonRequest({ leadId: "lead_1", token: "valid" }));
    expect(res.status).toBe(200);
    expect(paymentLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws_real", eventType: "clicked" }),
      }),
    );
    expect(leadUpdate).toHaveBeenCalled();
  });

  it("accepts a workspace owner viewing their own lead", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({
      workspaceId: "ws_owner",
      userId: "u1",
      role: "owner",
      authProvider: "better-auth",
    });
    leadFindFirst.mockResolvedValue({ id: "lead_1" });
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_owner" });
    const res = await POST(jsonRequest({ leadId: "lead_1" }));
    expect(res.status).toBe(200);
  });

  it("rejects a workspace user trying to mutate a lead they do not own", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({
      workspaceId: "ws_A",
      userId: "uA",
      role: "owner",
      authProvider: "better-auth",
    });
    leadFindFirst.mockResolvedValue(null);
    const res = await POST(jsonRequest({ leadId: "lead_in_B" }));
    expect(res.status).toBe(404);
    expect(paymentLogCreate).not.toHaveBeenCalled();
    expect(leadUpdate).not.toHaveBeenCalled();
  });
});
