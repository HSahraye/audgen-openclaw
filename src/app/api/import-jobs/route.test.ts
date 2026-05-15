import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  enforcePlanForAction: vi.fn(),
  listRecentImportJobs: vi.fn(),
  processImportJobChunk: vi.fn(),
  serializeImportJob: (j: unknown) => j,
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
}));
vi.mock("@/lib/billing/enforcement", () => ({
  enforcePlanForAction: mocks.enforcePlanForAction,
}));
vi.mock("@/lib/import-jobs", () => ({
  listRecentImportJobs: mocks.listRecentImportJobs,
  processImportJobChunk: mocks.processImportJobChunk,
  serializeImportJob: mocks.serializeImportJob,
}));

import { POST, GET } from "./route";

beforeEach(() => {
  mocks.getWorkspaceContext.mockReset().mockResolvedValue({ workspaceId: "ws_1" });
  mocks.enforcePlanForAction.mockReset();
  mocks.listRecentImportJobs.mockReset();
  mocks.processImportJobChunk.mockReset();
});

describe("GET /api/import-jobs", () => {
  it("returns the recent jobs list (no billing gate on read)", async () => {
    mocks.listRecentImportJobs.mockResolvedValue([{ id: "j1", status: "Completed" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jobs.length).toBe(1);
    expect(mocks.enforcePlanForAction).not.toHaveBeenCalled();
  });
});

describe("POST /api/import-jobs (billing gate)", () => {
  it("blocks with 402 + upgradePrompt when usage is over", async () => {
    mocks.enforcePlanForAction.mockResolvedValue({
      ok: false,
      reason: "Plan limit reached for Lead imports this month.",
      upgradePrompt: "Upgrade your plan to import more leads.",
    });
    const res = await POST();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/limit reached/i);
    expect(body.upgradePrompt).toMatch(/Upgrade/i);
    expect(mocks.listRecentImportJobs).not.toHaveBeenCalled();
  });

  it("blocks with 402 when workspace is operationally suspended", async () => {
    mocks.enforcePlanForAction.mockResolvedValue({
      ok: false,
      reason: "Workspace is read-only. Contact support to reactivate.",
      upgradePrompt: "Update billing or contact support to reactivate this workspace.",
    });
    const res = await POST();
    expect(res.status).toBe(402);
  });

  it("ok soft-allow returns 200 with a `warning` and still processes a job", async () => {
    mocks.enforcePlanForAction.mockResolvedValue({
      ok: true,
      soft: true,
      warning: "Approaching the cap (480/500).",
      forecast: {} as unknown,
    });
    mocks.listRecentImportJobs.mockResolvedValue([{ id: "j2", status: "Queued" }]);
    mocks.processImportJobChunk.mockResolvedValue({ id: "j2", status: "Running" });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(true);
    expect(body.warning).toMatch(/Approaching/);
  });

  it("ok allow without soft returns 200 with no warning field", async () => {
    mocks.enforcePlanForAction.mockResolvedValue({ ok: true, forecast: {} as unknown });
    mocks.listRecentImportJobs.mockResolvedValue([{ id: "j3", status: "Queued" }]);
    mocks.processImportJobChunk.mockResolvedValue({ id: "j3", status: "Running" });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.warning).toBeUndefined();
  });

  it("no queued jobs returns processed:false (still gated by billing)", async () => {
    mocks.enforcePlanForAction.mockResolvedValue({ ok: true, forecast: {} as unknown });
    mocks.listRecentImportJobs.mockResolvedValue([{ id: "j4", status: "Completed" }]);
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(false);
    expect(mocks.processImportJobChunk).not.toHaveBeenCalled();
  });
});
