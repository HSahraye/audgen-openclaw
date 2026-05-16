import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAuditAccessToken } from "@/lib/audit-links";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Slack / iMessage / Twitter etc. fetch the short-link URL to build a
 * preview before following the redirect, so we need OG/Twitter metadata
 * directly on /a/[slug] in addition to /audit/[id]. We resolve the
 * business name where possible but always opt out of search-engine
 * indexing because these are 1:1 shared assets.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const generic: Metadata = {
    title: `${BRAND.productName} audit`,
    description: "Personalised AuditGen findings for your business.",
    robots: { index: false, follow: false },
  };
  try {
    const { slug } = await params;
    const lead = await prisma.lead.findUnique({
      where: { shortSlug: String(slug || "").toLowerCase() },
      select: { businessName: true, location: true },
    });
    if (!lead) return generic;
    const where = lead.location
      ? `${lead.businessName} · ${lead.location}`
      : lead.businessName;
    const title = `${lead.businessName} · ${BRAND.productName} audit`;
    const description = `Personalised audit and growth recommendations for ${where}.`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { type: "article", title, description },
      twitter: { card: "summary_large_image", title, description },
    };
  } catch {
    return generic;
  }
}

export default async function ShortAuditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lead = await prisma.lead.findUnique({
    where: { shortSlug: String(slug || "").toLowerCase() },
    select: { id: true, shortSlug: true },
  });

  if (!lead) notFound();

  const token = createAuditAccessToken(lead.id);
  redirect(`/audit/${lead.id}?token=${encodeURIComponent(token)}`);
}
