import { describe, expect, it } from "vitest";
import {
  buildLeadgenAuditPreflight,
  getWorkspaceMonthlyCreditAllocation,
  LEADGEN_AUDIT_BATCH_LIMIT,
  LEADGEN_MONTHLY_CREDIT_LIMIT,
  LEADGEN_PREFLIGHT_LIMIT_ERROR,
} from "@/lib/leadgen/audit-preflight";

describe("leadgen audit preflight", () => {
  it("allows queue when batch and entitlement checks pass", () => {
    const preflight = buildLeadgenAuditPreflight(3, 10, { batchLimit: LEADGEN_AUDIT_BATCH_LIMIT });
    expect(preflight.canQueue).toBe(true);
    expect(preflight.warning).toBeNull();
  });

  it("blocks queue when selection exceeds hard batch limit of 10", () => {
    const preflight = buildLeadgenAuditPreflight(LEADGEN_AUDIT_BATCH_LIMIT + 1, 50, {
      batchLimit: LEADGEN_AUDIT_BATCH_LIMIT,
    });
    expect(preflight.canQueue).toBe(false);
    expect(preflight.warning).toBe(LEADGEN_PREFLIGHT_LIMIT_ERROR);
  });

  it("blocks queue when selection exceeds entitlement remaining", () => {
    const preflight = buildLeadgenAuditPreflight(8, 2, { batchLimit: LEADGEN_AUDIT_BATCH_LIMIT });
    expect(preflight.canQueue).toBe(false);
    expect(preflight.warning).toBe(LEADGEN_PREFLIGHT_LIMIT_ERROR);
  });

  it("blocks queue when selection exceeds workspace monthly credits", () => {
    const preflight = buildLeadgenAuditPreflight(4, 10, {
      batchLimit: LEADGEN_AUDIT_BATCH_LIMIT,
      monthlyCreditRemaining: 3,
    });
    expect(preflight.canQueue).toBe(false);
    expect(preflight.warning).toBe(LEADGEN_PREFLIGHT_LIMIT_ERROR);
  });

  it("returns a stubbed 100-credit workspace allocation", async () => {
    const allocation = await getWorkspaceMonthlyCreditAllocation("ws_test_123");
    expect(allocation.workspaceId).toBe("ws_test_123");
    expect(allocation.monthlyCreditLimit).toBe(LEADGEN_MONTHLY_CREDIT_LIMIT);
    expect(allocation.usedCredits).toBe(0);
    expect(allocation.remainingCredits).toBe(LEADGEN_MONTHLY_CREDIT_LIMIT);
  });
});
