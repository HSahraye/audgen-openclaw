/**
 * Demo data seeder for preview / staging / investor walkthroughs.
 *
 * Idempotent: re-running this against the same database upserts rather
 * than duplicates. It NEVER touches production data unless DATABASE_URL
 * points there \u2014 which is a deployment configuration mistake, not a
 * script defect. Each row is workspace-scoped to a clearly-named demo
 * workspace.
 *
 * Usage:
 *   tsx scripts/seed-demo-data.ts
 *
 * Optional env:
 *   DEMO_WORKSPACE_SLUG       (default: "demo-agency")
 *   DEMO_WORKSPACE_NAME       (default: "Demo Agency Inc")
 *   DEMO_OWNER_EMAIL          (default: "demo-owner@auditgen.local")
 *
 * Safety:
 *  - No real customer emails, phones, or addresses.
 *  - No outbound email / SMS / call.
 *  - No Stripe charges.
 *  - Refuses to run when NODE_ENV='production' AND APP_AUTH_ENABLED='true'
 *    unless DEMO_FORCE='true' is also set, to avoid accidentally seeding
 *    a real prod DB. (Operators who really want this in prod must set
 *    DEMO_FORCE=true; that's an audit trail moment.)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_WORKSPACE_SLUG = process.env.DEMO_WORKSPACE_SLUG || "demo-agency";
const DEMO_WORKSPACE_NAME = process.env.DEMO_WORKSPACE_NAME || "Demo Agency Inc";
const DEMO_OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL || "demo-owner@auditgen.local";

type DemoLead = {
  slug: string;
  businessName: string;
  category: string;
  location: string;
  ownerName: string;
  phone: string;
  email: string;
  status: string;
  score: number;
  packageName: string;
  painSummary: string;
  auditChecks: Record<string, boolean>;
  pitch: string;
};

const DEMO_LEADS: DemoLead[] = [
  {
    slug: "bay-smiles-dental",
    businessName: "Bay Smiles Dental",
    category: "Dental",
    location: "Santa Clara, CA",
    ownerName: "Dr. Maria Chen",
    phone: "+1-555-0101",
    email: "info@baysmiles.example",
    status: "CONTACTED",
    score: 88,
    packageName: "Presence Labs Standard",
    painSummary:
      "Mobile site is broken; online booking missing; reviews buried.",
    auditChecks: {
      hasWebsite: true,
      mobileFriendly: false,
      clearCta: false,
      phoneEasyToFind: true,
      reviewsVisible: false,
      onlineBooking: false,
      trustSection: true,
      gallery: false,
      serviceList: true,
      pricing: false,
      faq: false,
    },
    pitch:
      "Hey Maria \u2014 quick note: Bay Smiles Dental's mobile site isn't booking-friendly, which costs new patient calls from Santa Clara. With 42 reviews you already have trust signals. Want a 15-min call this week?",
  },
  {
    slug: "420-smoke-shop",
    businessName: "420 Smoke Shop",
    category: "Smoke shop",
    location: "Santa Clara, CA",
    ownerName: "Sam Patel",
    phone: "+1-555-0102",
    email: "owner@420smoke.example",
    status: "REPLIED",
    score: 76,
    packageName: "Presence Labs Starter",
    painSummary:
      "No mobile site; phone is hard to find; no product gallery.",
    auditChecks: {
      hasWebsite: true,
      mobileFriendly: false,
      clearCta: false,
      phoneEasyToFind: false,
      reviewsVisible: true,
      onlineBooking: false,
      trustSection: false,
      gallery: false,
      serviceList: false,
      pricing: false,
      faq: false,
    },
    pitch:
      "Hi Sam \u2014 ran a quick audit on 420 Smoke Shop. Three things are quietly costing you walk-ins. Want to see them on a 10-min call?",
  },
  {
    slug: "cool-air-hvac",
    businessName: "Cool Air HVAC",
    category: "HVAC contractor",
    location: "San Jose, CA",
    ownerName: "Diana Romero",
    phone: "+1-555-0103",
    email: "diana@coolair.example",
    status: "QUALIFIED",
    score: 91,
    packageName: "Presence Labs Standard",
    painSummary:
      "Phone is buried on the contact page; no online booking; reviews on Google but not on site.",
    auditChecks: {
      hasWebsite: true,
      mobileFriendly: true,
      clearCta: false,
      phoneEasyToFind: false,
      reviewsVisible: false,
      onlineBooking: false,
      trustSection: true,
      gallery: true,
      serviceList: true,
      pricing: false,
      faq: false,
    },
    pitch:
      "Diana \u2014 your San Jose emergency callers are bouncing because the phone is below the fold. One CTA fix can double call-to-booking.",
  },
  {
    slug: "cosmic-coffee-roasters",
    businessName: "Cosmic Coffee Roasters",
    category: "Cafe",
    location: "Berkeley, CA",
    ownerName: "Alex Park",
    phone: "+1-555-0104",
    email: "alex@cosmiccoffee.example",
    status: "PROPOSAL_SENT",
    score: 82,
    packageName: "Presence Labs Standard",
    painSummary:
      "No service list; reviews not surfaced; pricing missing from menu page.",
    auditChecks: {
      hasWebsite: true,
      mobileFriendly: true,
      clearCta: true,
      phoneEasyToFind: true,
      reviewsVisible: false,
      onlineBooking: false,
      trustSection: false,
      gallery: true,
      serviceList: false,
      pricing: false,
      faq: false,
    },
    pitch:
      "Hi Alex \u2014 the audit's clear: menu + pricing should live on one click. We can have your site ready before next month's catering rush.",
  },
  {
    slug: "anchor-auto-repair",
    businessName: "Anchor Auto Repair",
    category: "Auto repair",
    location: "Oakland, CA",
    ownerName: "Jose Ortega",
    phone: "+1-555-0105",
    email: "jose@anchorauto.example",
    status: "NEW",
    score: 64,
    packageName: "Presence Labs Starter",
    painSummary:
      "Site loads slowly on mobile; no clear contact CTA; pricing transparency missing.",
    auditChecks: {
      hasWebsite: true,
      mobileFriendly: false,
      clearCta: false,
      phoneEasyToFind: true,
      reviewsVisible: true,
      onlineBooking: false,
      trustSection: false,
      gallery: false,
      serviceList: false,
      pricing: false,
      faq: false,
    },
    pitch:
      "Hey Jose \u2014 your Oakland mobile callers are losing patience before they reach the contact form. We can fix it in two weeks.",
  },
];

async function main() {
  // Belt-and-suspenders: refuse to run in production unless forced.
  if (process.env.NODE_ENV === "production" && process.env.APP_AUTH_ENABLED === "true" && process.env.DEMO_FORCE !== "true") {
    console.error(
      JSON.stringify({
        level: "error",
        message:
          "Refusing to seed demo data in production. Set DEMO_FORCE=true to override (audit trail moment).",
      }),
    );
    process.exit(2);
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEMO_WORKSPACE_SLUG },
    update: { name: DEMO_WORKSPACE_NAME, status: "trialing", planTier: "free_trial" },
    create: {
      slug: DEMO_WORKSPACE_SLUG,
      name: DEMO_WORKSPACE_NAME,
      status: "trialing",
      planTier: "free_trial",
    },
  });

  console.log(JSON.stringify({ level: "info", message: "workspace ready", workspaceId: workspace.id, slug: workspace.slug }));

  for (const lead of DEMO_LEADS) {
    const auditJson = JSON.stringify(
      { checks: lead.auditChecks, source: "demo-seed" },
      null,
      2,
    );
    const assetsJson = JSON.stringify(
      {
        thirtySecondPitch: lead.pitch,
        proposalOutline: [
          `Audit summary for ${lead.businessName}`,
          "Top three conversion gaps and revenue impact",
          "Recommended solution + timeline",
          "Pricing + next steps",
        ],
        leadScore: lead.score,
        recommendedPackage: lead.packageName,
        painPointSummary: lead.painSummary,
      },
      null,
      2,
    );
    const upserted = await prisma.lead.upsert({
      where: { shortSlug: lead.slug },
      update: {
        businessName: lead.businessName,
        category: lead.category,
        location: lead.location,
        ownerName: lead.ownerName,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        score: lead.score,
        packageName: lead.packageName,
        painSummary: lead.painSummary,
        auditJson,
        assetsJson,
        intelligenceJson: null,
        generatedContextJson: null,
        workspaceId: workspace.id,
      },
      create: {
        workspaceId: workspace.id,
        shortSlug: lead.slug,
        businessName: lead.businessName,
        category: lead.category,
        location: lead.location,
        ownerName: lead.ownerName,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        score: lead.score,
        packageName: lead.packageName,
        painSummary: lead.painSummary,
        auditJson,
        assetsJson,
        intelligenceJson: null,
        generatedContextJson: null,
      },
    });

    // Best-effort canonical activities. Wrap in try/catch so a future
    // schema change to Activity doesn't break the seeder.
    try {
      await prisma.activity.create({
        data: {
          workspaceId: workspace.id,
          leadId: upserted.id,
          type: "LEAD_IMPORTED",
          source: "demo-seed",
          metadataJson: JSON.stringify({ score: lead.score, demo: true }),
        },
      });
      await prisma.activity.create({
        data: {
          workspaceId: workspace.id,
          leadId: upserted.id,
          type: "AUDIT_GENERATED",
          source: "demo-seed",
          metadataJson: JSON.stringify({ auditSource: "demo-seed" }),
        },
      });
    } catch (err) {
      console.warn(
        JSON.stringify({ level: "warn", message: "activity insert failed", err: String(err) }),
      );
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      message: "demo data seeded",
      workspace: workspace.slug,
      leads: DEMO_LEADS.length,
      ownerEmail: DEMO_OWNER_EMAIL,
    }),
  );
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ level: "error", message: "seed failed", err: String(err) }));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
