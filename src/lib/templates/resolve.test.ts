import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    auditTemplateFindFirst: vi.fn(),
    outreachTemplateFindFirst: vi.fn(),
    offerTemplateFindFirst: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditTemplate: { findFirst: mocks.auditTemplateFindFirst },
    outreachTemplate: { findFirst: mocks.outreachTemplateFindFirst },
    offerTemplate: { findFirst: mocks.offerTemplateFindFirst },
  },
}));

vi.mock("@/lib/workspace", () => ({
  strictWorkspaceScope: (workspaceId: string) => ({ workspaceId }),
}));

import { resolveTemplate } from "./resolver";

describe("resolveTemplate", () => {
  beforeEach(() => {
    mocks.auditTemplateFindFirst.mockReset();
    mocks.outreachTemplateFindFirst.mockReset();
    mocks.offerTemplateFindFirst.mockReset();
  });

  it("uses category override when available", async () => {
    mocks.auditTemplateFindFirst
      .mockResolvedValueOnce({
        id: "cat-audit",
        name: "Dental Audit",
        category: "dental",
        version: 3,
        contentJson: "{\"tone\":\"consultative\",\"ctaStyle\":\"consultative\",\"sectionOrder\":[\"executiveSummary\"],\"emphasis\":[],\"packageLabels\":{},\"guaranteeStyle\":\"results\",\"urgencyStyle\":\"balanced\",\"outreachStyle\":\"consultative\",\"proposalStyle\":\"value\"}",
      });

    const result = await resolveTemplate("ws_1", "audit", "dental");
    expect(result.id).toBe("cat-audit");
    expect(result.source).toBe("category");
    expect(result.version).toBe(3);
  });

  it("falls back safely when no template exists", async () => {
    mocks.offerTemplateFindFirst.mockResolvedValue(null);
    const result = await resolveTemplate("ws_1", "offer");
    expect(result.source).toBe("system");
    expect(result.id).toContain("system");
  });

  it("handles malformed template configs safely", async () => {
    mocks.outreachTemplateFindFirst.mockResolvedValueOnce({
      id: "bad-outreach",
      name: "Broken Outreach",
      category: null,
      version: 1,
      contentJson: "{not-json",
    });
    const result = await resolveTemplate("ws_1", "outreach");
    expect(result.config.outreachStyle).toBeDefined();
  });
});
