import { describe, it, expect } from "vitest";
import {
  defaultStepContent,
  defaultStepName,
  defaultStepSubject,
} from "./defaults";

describe("defaultStepName", () => {
  it("formats per-channel labels with 1-based index", () => {
    expect(defaultStepName("email", 0)).toBe("Step 1: Email intro");
    expect(defaultStepName("sms", 1)).toBe("Step 2: SMS follow-up");
    expect(defaultStepName("call", 2)).toBe("Step 3: Call {{businessName}}");
    expect(defaultStepName("task", 3)).toBe("Step 4: Task");
  });

  it("includes the {{businessName}} placeholder only for call steps", () => {
    expect(defaultStepName("call", 0)).toContain("{{businessName}}");
    expect(defaultStepName("email", 0)).not.toContain("{{businessName}}");
    expect(defaultStepName("sms", 0)).not.toContain("{{businessName}}");
    expect(defaultStepName("task", 0)).not.toContain("{{businessName}}");
  });
});

describe("defaultStepSubject", () => {
  it("returns a {{businessName}}-templated subject for email", () => {
    const subject = defaultStepSubject("email");
    expect(subject).toContain("{{businessName}}");
    expect(subject).toBe("Quick idea for {{businessName}}");
  });

  it("returns empty string for non-email channels", () => {
    expect(defaultStepSubject("sms")).toBe("");
    expect(defaultStepSubject("call")).toBe("");
    expect(defaultStepSubject("task")).toBe("");
  });
});

describe("defaultStepContent", () => {
  it("email content includes ownerName, businessName, and painPoint placeholders", () => {
    const content = defaultStepContent("email");
    expect(content).toContain("{{ownerName}}");
    expect(content).toContain("{{businessName}}");
    expect(content).toContain("{{painPoint}}");
  });

  it("sms content is a single line including the same placeholders", () => {
    const content = defaultStepContent("sms");
    expect(content).toContain("{{ownerName}}");
    expect(content).toContain("{{businessName}}");
    expect(content).toContain("{{painPoint}}");
    expect(content.includes("\n")).toBe(false);
  });

  it("call and task content includes {{recommendedOffer}} as the close pointer", () => {
    expect(defaultStepContent("call")).toContain("{{recommendedOffer}}");
    expect(defaultStepContent("task")).toContain("{{recommendedOffer}}");
  });

  it("call and task content are identical (shared script)", () => {
    expect(defaultStepContent("call")).toBe(defaultStepContent("task"));
  });

  it("email content opens with a greeting (not a hard pitch) so it survives spam heuristics", () => {
    const content = defaultStepContent("email");
    expect(content.trimStart().startsWith("Hi")).toBe(true);
  });
});
