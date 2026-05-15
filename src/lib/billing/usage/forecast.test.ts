import { describe, it, expect, vi, beforeEach } from "vitest";
import { PLAN_LIMITS } from "@/lib/billing/plans";

const mocks = vi.hoisted(() => ({
  getWorkspacePlanTier: vi.fn(),
  usageFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { usageRecord: { findMany: mocks.usageFindMany } },
}));
vi.mock("@/lib/billing/entitlements", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/entitlements")>(
    "@/lib/billing/entitlements",
  );
  return { ...actual, getWorkspacePlanTier: mocks.getWorkspacePlanTier };
});

import { composeForecast, getWorkspaceUsageForecast } from "./forecast";

beforeEach(() => {
  mocks.getWorkspacePlanTier.mockReset();
  mocks.usageFindMany.mockReset();
});

describe("composeForecast (pure)", () => {
  it("yields zeros + status=ok for an empty workspace", () => {
    const f = composeForecast({
      workspaceId: "ws_1",
      planTier: "starter",
      limits: PLAN_LIMITS.starter,
      usedByMetric: {},
    });
    expect(f.worstStatus).toBe("ok");
    for (const m of f.metrics) {
      expect(m.used).toBe(0);
      expect(m.pctConsumed).toBe(0);
      expect(m.status).toBe("ok");
    }
  });

  it("flags 'warning' at >= 80% and 'over' at >= 100%", () => {
    const f = composeForecast({
      workspaceId: "ws_1",
      planTier: "growth",
      limits: PLAN_LIMITS.growth,
      usedByMetric: {
        auditsPerMonth: Math.floor(PLAN_LIMITS.growth.auditsPerMonth * 0.85),
        importsPerMonth: PLAN_LIMITS.growth.importsPerMonth,
        outreachGenerations: Math.floor(PLAN_LIMITS.growth.outreachGenerations * 0.5),
      },
    });
    const audits = f.metrics.find((m) => m.key === "auditsPerMonth")!;
    const imports = f.metrics.find((m) => m.key === "importsPerMonth")!;
    const outreach = f.metrics.find((m) => m.key === "outreachGenerations")!;
    expect(audits.status).toBe("warning");
    expect(imports.status).toBe("over");
    expect(outreach.status).toBe("ok");
    expect(f.worstStatus).toBe("over");
  });

  it("clamps pctConsumed to [0, 1]", () => {
    const f = composeForecast({
      workspaceId: "ws_1",
      planTier: "starter",
      limits: PLAN_LIMITS.starter,
      usedByMetric: { auditsPerMonth: PLAN_LIMITS.starter.auditsPerMonth * 5 },
    });
    const audits = f.metrics.find((m) => m.key === "auditsPerMonth")!;
    expect(audits.pctConsumed).toBe(1);
    expect(audits.remaining).toBe(0);
  });

  it("includes one snapshot per limit key", () => {
    const f = composeForecast({
      workspaceId: "ws_1",
      planTier: "starter",
      limits: PLAN_LIMITS.starter,
      usedByMetric: {},
    });
    const keys = f.metrics.map((m) => m.key).sort();
    expect(keys).toEqual(Object.keys(PLAN_LIMITS.starter).sort());
  });
});

describe("getWorkspaceUsageForecast (DB)", () => {
  it("rejects missing workspaceId", async () => {
    await expect(getWorkspaceUsageForecast("")).rejects.toThrow(/workspaceId required/);
  });

  it("queries usageRecord scoped to (workspaceId, periodStart)", async () => {
    mocks.getWorkspacePlanTier.mockResolvedValue("starter");
    mocks.usageFindMany.mockResolvedValue([
      { metric: "audits", quantity: 50 },
      { metric: "auditsPerMonth", quantity: 10 },
      { metric: "imports", quantity: 100 },
      { metric: "outreach", quantity: 5 },
    ]);
    const f = await getWorkspaceUsageForecast("ws_target");
    expect(mocks.usageFindMany.mock.calls[0][0].where.workspaceId).toBe("ws_target");

    // 50 + 10 = 60 used for audits (both metric aliases counted)
    const audits = f.metrics.find((m) => m.key === "auditsPerMonth")!;
    expect(audits.used).toBe(60);
    const imports = f.metrics.find((m) => m.key === "importsPerMonth")!;
    expect(imports.used).toBe(100);
    const outreach = f.metrics.find((m) => m.key === "outreachGenerations")!;
    expect(outreach.used).toBe(5);
  });

  it("returns starter limits when planTier resolves to 'starter'", async () => {
    mocks.getWorkspacePlanTier.mockResolvedValue("starter");
    mocks.usageFindMany.mockResolvedValue([]);
    const f = await getWorkspaceUsageForecast("ws_1");
    const audits = f.metrics.find((m) => m.key === "auditsPerMonth")!;
    expect(audits.limit).toBe(PLAN_LIMITS.starter.auditsPerMonth);
    expect(f.planTier).toBe("starter");
  });
});
