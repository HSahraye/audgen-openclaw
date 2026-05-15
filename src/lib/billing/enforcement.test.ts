import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceUsageForecast: vi.fn(),
  ensureWorkspaceOperational: vi.fn(),
}));

vi.mock("@/lib/billing/usage/forecast", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/usage/forecast")>(
    "@/lib/billing/usage/forecast",
  );
  return { ...actual, getWorkspaceUsageForecast: mocks.getWorkspaceUsageForecast };
});
vi.mock("@/lib/billing/entitlements", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/entitlements")>(
    "@/lib/billing/entitlements",
  );
  return { ...actual, ensureWorkspaceOperational: mocks.ensureWorkspaceOperational };
});

import { decideEnforcement, enforcePlanForAction } from "./enforcement";
import type { UsageForecast } from "@/lib/billing/usage/forecast";

function forecast(overrides: Partial<UsageForecast> = {}): UsageForecast {
  return {
    workspaceId: "ws_1",
    asOf: new Date(),
    periodStart: new Date(),
    periodEnd: new Date(),
    planTier: "starter",
    metrics: [
      { key: "auditsPerMonth", label: "Audits", limit: 100, used: 0, remaining: 100, pctConsumed: 0, status: "ok" },
      { key: "importsPerMonth", label: "Imports", limit: 100, used: 0, remaining: 100, pctConsumed: 0, status: "ok" },
      { key: "activeLeads", label: "Active", limit: 100, used: 0, remaining: 100, pctConsumed: 0, status: "ok" },
      { key: "templates", label: "Templates", limit: 10, used: 0, remaining: 10, pctConsumed: 0, status: "ok" },
      { key: "seats", label: "Seats", limit: 5, used: 0, remaining: 5, pctConsumed: 0, status: "ok" },
      { key: "outreachGenerations", label: "Outreach", limit: 100, used: 0, remaining: 100, pctConsumed: 0, status: "ok" },
      { key: "proposalGenerations", label: "Proposals", limit: 100, used: 0, remaining: 100, pctConsumed: 0, status: "ok" },
    ],
    worstStatus: "ok",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getWorkspaceUsageForecast.mockReset();
  mocks.ensureWorkspaceOperational.mockReset();
});

describe("decideEnforcement (pure)", () => {
  it("blocks when the workspace is not operational, regardless of usage", () => {
    const d = decideEnforcement(
      "generate_audit",
      { ok: false, reason: "Trial expired." },
      forecast(),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.reason).toMatch(/Trial expired/);
      expect(d.upgradePrompt).toMatch(/Update billing/);
    }
  });

  it("allows when status=ok", () => {
    const d = decideEnforcement("generate_audit", { ok: true }, forecast());
    expect(d.ok).toBe(true);
    if (d.ok && !("soft" in d && d.soft)) {
      // plain allow
    } else {
      expect(false).toBe(true);
    }
  });

  it("soft-allows at warning with a warning string", () => {
    const f = forecast();
    f.metrics[0] = { ...f.metrics[0], used: 85, remaining: 15, pctConsumed: 0.85, status: "warning" };
    const d = decideEnforcement("generate_audit", { ok: true }, f);
    expect(d.ok).toBe(true);
    if (d.ok && d.soft) {
      expect(d.warning).toMatch(/Approaching/);
    } else {
      expect(false).toBe(true);
    }
  });

  it("hard-blocks at over with an upgrade prompt", () => {
    const f = forecast();
    f.metrics[1] = { ...f.metrics[1], used: 200, remaining: 0, pctConsumed: 1, status: "over" };
    const d = decideEnforcement("import_lead", { ok: true }, f);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.reason).toMatch(/Plan limit reached/);
      expect(d.upgradePrompt).toMatch(/Upgrade/);
    }
  });

  it("only the action's metric matters \u2014 a different over-metric does not block this action", () => {
    const f = forecast();
    // proposals over, but we're guarding 'import_lead'
    f.metrics[6] = { ...f.metrics[6], used: 200, remaining: 0, pctConsumed: 1, status: "over" };
    const d = decideEnforcement("import_lead", { ok: true }, f);
    expect(d.ok).toBe(true);
  });
});

describe("enforcePlanForAction (DB)", () => {
  it("fails closed when workspaceId is missing", async () => {
    const d = await enforcePlanForAction("", "generate_audit");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/Workspace/);
  });

  it("combines operational + forecast and returns a decision", async () => {
    mocks.ensureWorkspaceOperational.mockResolvedValue({ ok: true });
    mocks.getWorkspaceUsageForecast.mockResolvedValue(forecast());
    const d = await enforcePlanForAction("ws_1", "generate_audit");
    expect(d.ok).toBe(true);
  });

  it("propagates operational block (delinquent / suspended)", async () => {
    mocks.ensureWorkspaceOperational.mockResolvedValue({
      ok: false,
      reason: "Billing issue detected.",
    });
    mocks.getWorkspaceUsageForecast.mockResolvedValue(forecast());
    const d = await enforcePlanForAction("ws_1", "import_lead");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/Billing/);
  });
});
