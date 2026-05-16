import { describe, it, expect } from "vitest";
import {
  AuditTemplateConfigSchema,
  OfferTemplateConfigSchema,
  OutreachTemplateConfigSchema,
} from "./types";
import {
  SYSTEM_DEFAULT_AUDIT_TEMPLATES,
  SYSTEM_DEFAULT_OFFER_TEMPLATE,
  SYSTEM_DEFAULT_OUTREACH_TEMPLATE,
} from "./defaults";

/**
 * The SYSTEM_DEFAULT_* constants are the fallbacks the resolver returns
 * whenever a workspace has no matching template — every audit generated
 * by a fresh workspace passes through one of these. Schema drift here
 * silently breaks audits, so we lock down the integrity contract.
 */

describe("SYSTEM_DEFAULT_AUDIT_TEMPLATES", () => {
  it("exposes at least the documented agency archetypes", () => {
    const names = Object.keys(SYSTEM_DEFAULT_AUDIT_TEMPLATES);
    expect(names).toEqual(
      expect.arrayContaining([
        "Local SEO Agency",
        "Premium Branding Agency",
        "Direct-Response PPC Agency",
        "Reputation Management Agency",
        "General Growth Agency",
      ]),
    );
  });

  it("every variant passes AuditTemplateConfigSchema", () => {
    for (const [name, config] of Object.entries(SYSTEM_DEFAULT_AUDIT_TEMPLATES)) {
      const result = AuditTemplateConfigSchema.safeParse(config);
      if (!result.success) {
        throw new Error(
          `Default audit template '${name}' fails schema: ${result.error.message}`,
        );
      }
      expect(result.success).toBe(true);
    }
  });

  it("every variant declares a non-empty sectionOrder", () => {
    for (const [name, config] of Object.entries(SYSTEM_DEFAULT_AUDIT_TEMPLATES)) {
      expect(config.sectionOrder, name).toBeInstanceOf(Array);
      expect(config.sectionOrder.length, name).toBeGreaterThan(0);
    }
  });

  it("every variant always opens with the executive summary", () => {
    // Locks in the contract that audits start with a top-line summary
    // regardless of agency archetype. If we ever want a variant to lead
    // with something else, change here AND in the audit-page renderer.
    for (const [name, config] of Object.entries(SYSTEM_DEFAULT_AUDIT_TEMPLATES)) {
      expect(config.sectionOrder[0], name).toBe("executiveSummary");
    }
  });

  it("every variant always ends with recommendedNextSteps", () => {
    for (const [name, config] of Object.entries(SYSTEM_DEFAULT_AUDIT_TEMPLATES)) {
      const last = config.sectionOrder[config.sectionOrder.length - 1];
      expect(last, name).toBe("recommendedNextSteps");
    }
  });
});

describe("SYSTEM_DEFAULT_OUTREACH_TEMPLATE", () => {
  it("passes OutreachTemplateConfigSchema", () => {
    const result = OutreachTemplateConfigSchema.safeParse(
      SYSTEM_DEFAULT_OUTREACH_TEMPLATE,
    );
    expect(result.success).toBe(true);
  });

  it("section order follows cold-open → diagnosis → value → cta", () => {
    expect(SYSTEM_DEFAULT_OUTREACH_TEMPLATE.sectionOrder).toEqual([
      "coldOpen",
      "diagnosis",
      "value",
      "cta",
    ]);
  });
});

describe("SYSTEM_DEFAULT_OFFER_TEMPLATE", () => {
  it("passes OfferTemplateConfigSchema", () => {
    const result = OfferTemplateConfigSchema.safeParse(SYSTEM_DEFAULT_OFFER_TEMPLATE);
    expect(result.success).toBe(true);
  });

  it("section order ends with socialProof so proposals close with credibility", () => {
    const order = SYSTEM_DEFAULT_OFFER_TEMPLATE.sectionOrder;
    expect(order[order.length - 1]).toBe("socialProof");
  });

  it("includes a deliverables section so proposals always list what gets shipped", () => {
    expect(SYSTEM_DEFAULT_OFFER_TEMPLATE.sectionOrder).toContain("deliverables");
  });
});
