import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { pickLeadgenCsvField } from "@/lib/leadgen/csv-header-aliases";

describe("leadgen CSV fuzzy header mapping", () => {
  it("maps Company + URL headers into businessName + website", () => {
    const rows = parseCsv("Company,URL\nAcme Roofing,https://acme.test");
    expect(rows).toHaveLength(1);
    expect(pickLeadgenCsvField(rows[0], "businessName")).toBe("Acme Roofing");
    expect(pickLeadgenCsvField(rows[0], "website")).toBe("https://acme.test");
  });

  it("accepts casing, whitespace, and trailing symbols in headers", () => {
    const rows = parseCsv("  Name:  , Web Address!! , Telephone?\nBeacon Dental,beacondental.co,555-0101");
    expect(rows).toHaveLength(1);
    expect(pickLeadgenCsvField(rows[0], "businessName")).toBe("Beacon Dental");
    expect(pickLeadgenCsvField(rows[0], "website")).toBe("beacondental.co");
    expect(pickLeadgenCsvField(rows[0], "phone")).toBe("555-0101");
  });
});
