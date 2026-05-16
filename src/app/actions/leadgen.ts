"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

const leadgenQueueInputSchema = z.object({
  businessName: z.string().min(1),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  source: z.string().optional(),
  presenceGaps: z.array(z.string()).optional(),
});

export type AddLeadgenToAudgenInput = z.infer<typeof leadgenQueueInputSchema>;

function normalizeWebsite(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export async function addSelectedLeadgenToAudgenAction(
  opportunities: AddLeadgenToAudgenInput[],
) {
  await requireRole(["admin", "sales"]);
  const { workspaceId } = await getWorkspaceContext();

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of opportunities) {
    const parsed = leadgenQueueInputSchema.safeParse(item);
    if (!parsed.success) {
      skipped += 1;
      errors.push("Invalid lead opportunity payload.");
      continue;
    }

    const location = [parsed.data.city, parsed.data.state].filter(Boolean).join(", ");
    const websiteKey = normalizeWebsite(parsed.data.website);

    const existingLead = await prisma.lead.findFirst({
      where: {
        ...withWorkspaceFallbackScope(workspaceId),
        OR: [
          websiteKey ? { websiteUrl: { contains: websiteKey } } : undefined,
          location
            ? {
                AND: [
                  { businessName: parsed.data.businessName },
                  { location },
                ],
              }
            : { businessName: parsed.data.businessName },
        ].filter(Boolean) as Array<
          { websiteUrl?: { contains: string } } | { businessName?: string } | { AND?: [{ businessName: string }, { location: string }] }
        >,
      },
    });

    if (existingLead) {
      skipped += 1;
      continue;
    }

    const existingQueueItem = await prisma.researchQueueItem.findFirst({
      where: {
        ...withWorkspaceFallbackScope(workspaceId),
        OR: [
          websiteKey ? { websiteUrl: { contains: websiteKey } } : undefined,
          location
            ? {
                AND: [
                  { businessName: parsed.data.businessName },
                  { location },
                ],
              }
            : { businessName: parsed.data.businessName },
        ].filter(Boolean) as Array<
          { websiteUrl?: { contains: string } } | { businessName?: string } | { AND?: [{ businessName: string }, { location: string }] }
        >,
      },
    });

    if (existingQueueItem) {
      skipped += 1;
      continue;
    }

    await prisma.researchQueueItem.create({
      data: {
        workspaceId,
        businessName: parsed.data.businessName,
        websiteUrl: parsed.data.website ?? null,
        location: location || null,
        category: parsed.data.category || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        source: parsed.data.source ? `leadgen:${parsed.data.source}` : "leadgen:manual",
        notes: parsed.data.presenceGaps?.length
          ? `LeadGen gaps: ${parsed.data.presenceGaps.join("; ")}`
          : "Lead imported from LeadGen Command Center.",
        status: "Queued",
        priority: 2,
      },
    });
    added += 1;
  }

  revalidatePath("/leadgen");
  revalidatePath("/research");
  return { ok: true, added, skipped, error: errors[0] ?? "" };
}
