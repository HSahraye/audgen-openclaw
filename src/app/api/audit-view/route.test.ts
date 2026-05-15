import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for collaborators. These run before importing the route.
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
const viewLogCreate = vi.fn().mockResolvedValue({ id: "v1" });
const viewLogCount = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      get findUnique() { return leadFindUnique; },
      get findFirst() { return leadFindFirst; },
    },
    viewLog: {
      get create() { return viewLogCreate; },
      get count() { return viewLogCount; },
    },
  },
}));

import { verifyAuditAccessToken } from "@/lib/audit-links";
import { assertApiSessionWorkspace } from "@/lib/authz";
import { isAuthEnabled } from "@/lib/env";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/audit-view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  leadFindUnique.mockReset();
  leadFindFirst.mockReset();
  viewLogCount.mockReset().mockResolvedValue(0);
  viewLogCreate.mockReset().mockResolvedValue({ id: "v1" });
});

describe("POST /api/audit-view", () => {
  it("rejects invalid body with 400", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects when auth disabled and lead has no workspaceId (no default-workspace fallback)", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: null });
    const res = await POST(jsonRequest({ leadId: "lead_1" }));
    expect(res.status).toBe(404);
    expect(viewLogCreate).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller without a signed token (404)", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(jsonRequest({ leadId: "lead_1" }));
    expect(res.status).toBe(404);
    expect(viewLogCreate).not.toHaveBeenCalled();
  });

  it("accepts a prospect with a valid signed token", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(true);
    leadFindUnique.mockResolvedValue({ id: "lead_1", workspaceId: "ws_real" });
    const res = await POST(jsonRequest({ leadId: "lead_1", token: "valid" }));
    expect(res.status).toBe(200);
    expect(viewLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws_real", leadId: "lead_1" }),
      }),
    );
  });

  it("accepts an authenticated workspace owner viewing their own lead", async () => {
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
    expect(viewLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws_owner", leadId: "lead_1" }),
      }),
    );
  });

  it("rejects an authenticated user viewing a lead in a DIFFERENT workspace", async () => {
    (isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (verifyAuditAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (assertApiSessionWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({
      workspaceId: "ws_A",
      userId: "uA",
      role: "owner",
      authProvider: "better-auth",
    });
    leadFindFirst.mockResolvedValue(null); // lead is in ws_B, not visible to ws_A
    const res = await POST(jsonRequest({ leadId: "lead_in_B" }));
    expect(res.status).toBe(404);
    expect(viewLogCreate).not.toHaveBeenCalled();
  });
});
