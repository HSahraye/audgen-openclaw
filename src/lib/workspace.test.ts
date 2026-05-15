import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withWorkspaceFallbackScope, strictWorkspaceScope } from "@/lib/workspace";

describe("workspace scoping helpers", () => {
  const originalEnv = process.env.ALLOW_WORKSPACE_NULL_FALLBACK;
  beforeEach(() => {
    delete process.env.ALLOW_WORKSPACE_NULL_FALLBACK;
  });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ALLOW_WORKSPACE_NULL_FALLBACK;
    else process.env.ALLOW_WORKSPACE_NULL_FALLBACK = originalEnv;
  });

  it("withWorkspaceFallbackScope returns strict scope by default", () => {
    expect(withWorkspaceFallbackScope("ws_1")).toEqual({ workspaceId: "ws_1" });
  });

  it("withWorkspaceFallbackScope re-enables null fallback only when env flag is true", () => {
    process.env.ALLOW_WORKSPACE_NULL_FALLBACK = "true";
    expect(withWorkspaceFallbackScope("ws_1")).toEqual({
      OR: [{ workspaceId: "ws_1" }, { workspaceId: null }],
    });
  });

  it("strictWorkspaceScope ignores env flag", () => {
    process.env.ALLOW_WORKSPACE_NULL_FALLBACK = "true";
    expect(strictWorkspaceScope("ws_1")).toEqual({ workspaceId: "ws_1" });
  });
});
