import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("api health route", () => {
  it("returns ok JSON payload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("audgen-web");
  });
});
