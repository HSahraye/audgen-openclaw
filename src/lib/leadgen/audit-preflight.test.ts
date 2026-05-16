import { describe, expect, it } from "vitest";
import { buildLeadgenAuditPreflight } from "@/lib/leadgen/audit-preflight";

describe("leadgen audit preflight", () => {
  it("allows queue when batch and entitlement checks pass", () => {
    const preflight = buildLeadgenAuditPreflight(3, 10, { batchLimit: 5 });
    expect(preflight.canQueue).toBe(true);
    expect(preflight.warning).toBeNull();
  });

  it("blocks queue when selection exceeds batch limit", () => {
    const preflight = buildLeadgenAuditPreflight(25, 50, { batchLimit: 20 });
    expect(preflight.canQueue).toBe(false);
    expect(preflight.warning).toContain("batch limit");
  });

  it("blocks queue when selection exceeds entitlement remaining", () => {
    const preflight = buildLeadgenAuditPreflight(8, 2, { batchLimit: 20 });
    expect(preflight.canQueue).toBe(false);
    expect(preflight.warning).toContain("entitlement remaining");
  });
});
