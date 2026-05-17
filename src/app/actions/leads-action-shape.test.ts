import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// REGRESSION GUARD for the production "use server" module-evaluation crash:
//
//     ⨯ Error: A "use server" file can only export async functions, found object.
//
// src/app/actions/leads.ts is a "use server" file. Next.js's server-actions
// compiler refuses to load such a module if it has ANY export that is not an
// async function. The previous failure mode was: `export const leadFormSchema`
// (a Zod object) lived in the same file, which crashed module evaluation
// and made every audit-form submission render the global error boundary
// ("Something broke / Unexpected error"). The schema now lives in
// `src/app/actions/leads-schema.ts` and only async server actions are
// exported from `leads.ts`. This static check locks that invariant so a
// later edit cannot reintroduce the production crash silently.

describe("src/app/actions/leads.ts module shape (use-server safety)", () => {
  const filePath = path.resolve(__dirname, "leads.ts");
  const source = readFileSync(filePath, "utf8");

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
        ? `Forbidden non-function exports in src/app/actions/leads.ts:\n${offenders
            .map((o) => `  L${o.lineNumber}: ${o.line.trim()}`)
            .join("\n")}\nMove these to a non-"use server" module (e.g. leads-schema.ts).`
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
