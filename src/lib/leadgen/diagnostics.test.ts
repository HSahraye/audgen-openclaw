import { describe, expect, it } from "vitest";
import { buildConnectorDiagnostics } from "@/lib/leadgen/diagnostics";

describe("leadgen diagnostics", () => {
  it("shows missing env for sheets when vars are absent", () => {
    const diagnostics = buildConnectorDiagnostics({});
    const sheets = diagnostics.find((item) => item.id === "diag-sheets-export");
    expect(sheets?.status).toBe("missing_env");
  });

  it("marks mock provider as mock and safe", () => {
    const diagnostics = buildConnectorDiagnostics({});
    const mock = diagnostics.find((item) => item.id === "diag-mock-local");
    expect(mock?.status).toBe("mock");
    expect(mock?.safeNow).toBe(true);
  });

  it("keeps approval-gated connectors blocked even with env vars", () => {
    const diagnostics = buildConnectorDiagnostics({
      GOOGLE_SHEETS_CLIENT_EMAIL: "svc@test.local",
      GOOGLE_SHEETS_PRIVATE_KEY: "key",
      GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-id",
      GOOGLE_PLACES_API_KEY: "places-key",
    });
    const places = diagnostics.find((item) => item.id === "diag-google-places");
    expect(places?.status).toBe("requires_approval");
    expect(places?.safeNow).toBe(false);
  });
});
