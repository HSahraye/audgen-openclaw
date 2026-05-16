import { describe, expect, it } from "vitest";
import { LEADGEN_EXPORT_HEADERS, toGoogleSheetsReadyCsv, toLeadGenCsv } from "@/lib/leadgen/export";
import { getMockLeadOpportunities } from "@/lib/leadgen/mock-data";

describe("leadgen export", () => {
  it("escapes commas, quotes, and newlines in CSV", () => {
    const lead = getMockLeadOpportunities()[0];
    const csv = toLeadGenCsv([
      {
        ...lead,
        businessName: 'Alpha, "Beta"',
        suggestedPitch: "Line 1\nLine 2",
      },
    ]);

    expect(csv).toContain('"Alpha, ""Beta"""');
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it("includes expected headers and handles optional missing fields", () => {
    const lead = getMockLeadOpportunities()[0];
    const csv = toLeadGenCsv([
      {
        ...lead,
        phone: null,
        email: null,
        website: null,
        googleProfileUrl: null,
      },
    ]);

    expect(csv.startsWith(LEADGEN_EXPORT_HEADERS.join(","))).toBe(true);
    expect(csv).toContain(",,");
  });

  it("formats presence gaps safely", () => {
    const lead = getMockLeadOpportunities()[0];
    const csv = toLeadGenCsv([{ ...lead, presenceGaps: ["No website", "No booking link"] }]);
    expect(csv).toContain("No website; No booking link");
  });

  it("google sheets export uses stable column order", () => {
    const leads = getMockLeadOpportunities().slice(0, 2);
    const csv = toGoogleSheetsReadyCsv(leads);
    const header = csv.split("\n")[0];
    expect(header).toBe(LEADGEN_EXPORT_HEADERS.join(","));
  });

  it("google sheets export handles empty lists safely", () => {
    const csv = toGoogleSheetsReadyCsv([]);
    expect(csv).toBe(LEADGEN_EXPORT_HEADERS.join(","));
  });
});
