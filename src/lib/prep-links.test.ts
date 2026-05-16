import { describe, it, expect } from "vitest";
import { buildPrepPath } from "./prep-links";

describe("buildPrepPath", () => {
  it("prefers shortSlug over id", () => {
    expect(buildPrepPath({ id: "lead_long_id_xyz", shortSlug: "acme" })).toBe(
      "/prep/acme",
    );
  });

  it("falls back to id when shortSlug is null", () => {
    expect(buildPrepPath({ id: "lead_xyz", shortSlug: null })).toBe(
      "/prep/lead_xyz",
    );
  });

  it("falls back to id when shortSlug is empty", () => {
    expect(buildPrepPath({ id: "lead_xyz", shortSlug: "" })).toBe(
      "/prep/lead_xyz",
    );
  });

  it("falls back to id when shortSlug is undefined", () => {
    expect(buildPrepPath({ id: "lead_xyz" })).toBe("/prep/lead_xyz");
  });

  it("URL-encodes path-unsafe characters in the chosen key", () => {
    expect(buildPrepPath({ id: "lead/with#special?chars" })).toBe(
      "/prep/lead%2Fwith%23special%3Fchars",
    );
    expect(buildPrepPath({ id: "x", shortSlug: "café-shop" })).toBe(
      "/prep/caf%C3%A9-shop",
    );
  });
});
