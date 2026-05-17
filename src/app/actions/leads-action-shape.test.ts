import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the production "use server" module-evaluation crash:
//
//     ⨯ Error: A "use server" file can only export async functions, found object.
//
// Next.js's server-actions compiler refuses to load a "use server" module
// if it has ANY export that is not an async function. The original failure
// mode was: `export const leadFormSchema` (a Zod object) lived in
// `src/app/actions/leads.ts`, which crashed module evaluation and made
// every audit-form submission render the global error boundary
// ("Something broke / Unexpected error"). A second instance of the same
// class of bug was caught by `next build` immediately before this commit:
// the LeadGen action module exported `selectAddSelectedBanner` and a few
// type aliases. Both have since moved to non-"use server" siblings
// (leads-schema.ts and leadgen-result.ts). This static check sweeps EVERY
// "use server" file under src/app/actions so a later edit cannot
// reintroduce the production crash silently — regardless of which action
// file the regression lands in.

const ACTIONS_DIR = path.resolve(__dirname);
const useServerFiles = readdirSync(ACTIONS_DIR)
  .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"))
  .map((entry) => ({ entry, abs: path.join(ACTIONS_DIR, entry), source: readFileSync(path.join(ACTIONS_DIR, entry), "utf8") }))
  .filter(({ source }) => {
    const firstStmt = source
      .split("\n")
      .find((line) => line.trim().length > 0 && !line.trim().startsWith("//"));
    return Boolean(firstStmt && /^["']use server["'];?$/.test(firstStmt.trim()));
  });

describe("src/app/actions/*.ts use-server module shape", () => {
  it("discovers at least one 'use server' module to lint", () => {
    expect(useServerFiles.length).toBeGreaterThan(0);
  });

  for (const { entry, source } of useServerFiles) {
    describe(entry, () => {
      it('starts with "use server" so it is treated as a server-actions module', () => {
        const firstStmt = source
          .split("\n")
          .find((line) => line.trim().length > 0 && !line.trim().startsWith("//"));
        expect(firstStmt?.trim()).toMatch(/^["']use server["'];?$/);
      });

      it("does not export any const/let/var/class/enum (only async functions allowed)", () => {
        const offenders = source
          .split("\n")
          .map((line, idx) => ({ line, lineNumber: idx + 1 }))
          .filter(({ line }) => /^\s*export\s+(const|let|var|class|enum)\b/.test(line));
        expect(
          offenders,
          offenders.length
            ? `Forbidden non-function exports in src/app/actions/${entry}:\n${offenders
                .map((o) => `  L${o.lineNumber}: ${o.line.trim()}`)
                .join("\n")}\nMove these to a non-"use server" sibling module (see leads-schema.ts / leadgen-result.ts for the pattern).`
            : "ok",
        ).toEqual([]);
      });

      it("does not re-export schemas via 'export {' (would also fail use-server check)", () => {
        const offenders = source
          .split("\n")
          .map((line, idx) => ({ line, lineNumber: idx + 1 }))
          .filter(({ line }) => /^\s*export\s*\{/.test(line));
        expect(offenders).toEqual([]);
      });
    });
  }
});
