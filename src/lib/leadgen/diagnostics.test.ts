import { describe, expect, it } from "vitest";
import { buildConnectorDiagnostics } from "@/lib/leadgen/diagnostics";

describe("leadgen diagnostics", () => {
  it("shows missing env for sheets when vars are absent", () => {
    const diagnostics = buildConnectorDiagnostics({});
    const sheets = diagnostics.find((item) => item.id === "diag-sheets-export");
    expect(sheets?.status).toBe("missing_env");
  });

  it("shows missing env for yelp when key is absent", () => {
    const diagnostics = buildConnectorDiagnostics({});
    const yelp = diagnostics.find((item) => item.id === "diag-yelp-fusion");
    expect(yelp?.status).toBe("missing_env");
  });

  it("marks mock provider as mock and safe", () => {
    const diagnostics = buildConnectorDiagnostics({});
    const mock = diagnostics.find((item) => item.id === "diag-mock-local");
    expect(mock?.status).toBe("mock");
    expect(mock?.safeNow).toBe(true);
  });

  it("keeps connectors gated when live toggle is off", () => {
    const diagnostics = buildConnectorDiagnostics({
      GOOGLE_SHEETS_CLIENT_EMAIL: "svc@test.local",
      GOOGLE_SHEETS_PRIVATE_KEY: "key",
      GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-id",
      GOOGLE_PLACES_API_KEY: "places-key",
      YELP_API_KEY: "yelp-key",
      LEADGEN_LIVE_CONNECTORS_ENABLED: "false",
      LEADGEN_SANDBOX_MODE: "false",
    });
    const places = diagnostics.find((item) => item.id === "diag-google-places");
    const yelp = diagnostics.find((item) => item.id === "diag-yelp-fusion");
    expect(places?.status).toBe("requires_approval");
    expect(yelp?.status).toBe("requires_approval");
    expect(places?.safeNow).toBe(false);
  });

  it("marks live connectors ready when env keys and runtime toggles are enabled", () => {
    const diagnostics = buildConnectorDiagnostics({
      GOOGLE_PLACES_API_KEY: "places-key",
      YELP_API_KEY: "yelp-key",
      LEADGEN_LIVE_CONNECTORS_ENABLED: "true",
      LEADGEN_SANDBOX_MODE: "false",
    });
    const places = diagnostics.find((item) => item.id === "diag-google-places");
    const yelp = diagnostics.find((item) => item.id === "diag-yelp-fusion");
    expect(places?.status).toBe("ready");
    expect(places?.safeNow).toBe(true);
    expect(yelp?.status).toBe("ready");
    expect(yelp?.safeNow).toBe(true);
  });
});
