/**
 * Demo data reset: wipe + re-seed.
 *
 * For staging/preview only. Never touches a production workspace
 * because:
 *  1. It only deletes rows belonging to the demo workspace slug
 *     (default "demo-agency"; override via DEMO_WORKSPACE_SLUG).
 *  2. It refuses to run when NODE_ENV=production AND
 *     APP_AUTH_ENABLED=true unless DEMO_FORCE=true is also set
 *     (audit-trail moment).
 *
 * Usage:
 *   DATABASE_URL=<staging-db> npm run db:reset:demo
 *
 * Behaviour:
 *  - Drops every Lead / Activity / OutreachLog / ViewLog / PaymentLog
 *    row that belongs to the demo workspace.
 *  - Drops the workspace itself.
 *  - Runs the seeder again afterwards (same logic as seed-demo-data.ts
 *    via dynamic require).
 *
 * Why a separate script:
 *  - seed-demo-data.ts is idempotent for *upserts* but does not delete
 *    leftover rows that get stale (e.g. a lead you removed from the
 *    seed list).
 *  - reset-demo-data.ts is the "give me a clean preview" button.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_WORKSPACE_SLUG = process.env.DEMO_WORKSPACE_SLUG || "demo-agency";

async function refuseProductionUnlessForced() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.APP_AUTH_ENABLED === "true" &&
    process.env.DEMO_FORCE !== "true"
  ) {
    console.error(
      JSON.stringify({
        level: "error",
        message:
          "Refusing to reset demo data in production. Set DEMO_FORCE=true to override.",
      }),
    );
    process.exit(2);
  }
}

async function dropDemoWorkspace(slug: string) {
  const ws = await prisma.workspace.findUnique({ where: { slug } });
  if (!ws) {
    console.log(JSON.stringify({ level: "info", message: "no demo workspace to drop", slug }));
    return null;
  }

  // Delete child rows we know about. Most are cascade-on-delete via the
  // schema, but be explicit so we don't depend on schema details that
  // might shift later.
  const leadIds = (
    await prisma.lead.findMany({ where: { workspaceId: ws.id }, select: { id: true } })
  ).map((l) => l.id);

  // Activity is workspace-scoped, lead-id may be null.
  await prisma.activity.deleteMany({ where: { workspaceId: ws.id } });
  if (leadIds.length > 0) {
    await prisma.outreachLog.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.viewLog.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.paymentLog.deleteMany({ where: { leadId: { in: leadIds } } });
  }
  await prisma.lead.deleteMany({ where: { workspaceId: ws.id } });

  // Other workspace-scoped tables to keep the slate clean.
  await prisma.workspaceSettings.deleteMany({ where: { workspaceId: ws.id } });
  await prisma.workspace.delete({ where: { id: ws.id } });
  console.log(
    JSON.stringify({ level: "info", message: "demo workspace dropped", slug, leadIds: leadIds.length }),
  );
  return ws.id;
}

async function main() {
  await refuseProductionUnlessForced();
  await dropDemoWorkspace(DEMO_WORKSPACE_SLUG);
  // Hand off to the seeder by importing it. Using dynamic import keeps
  // the seeder a single source of truth for what gets created.
  // tsx will resolve the .ts extension at runtime.
  await import("./seed-demo-data");
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ level: "error", message: "reset failed", err: String(err) }));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
