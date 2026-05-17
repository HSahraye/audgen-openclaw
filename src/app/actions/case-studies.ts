"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";

const caseStudySchema = z.object({
  title: z.string().min(1).max(160),
  result: z.string().min(1).max(160),
  description: z.string().min(1).max(1200),
  imageUrl: z.string().url().optional().or(z.literal("")),
  category: z.string().max(80).optional(),
});

export async function createCaseStudyAction(_prevState: unknown, formData: FormData) {
  const { role: actorRole, workspaceId } = await requireSessionRole(["owner", "admin", "sales", "member"]);
  const parsed = caseStudySchema.safeParse({
    title: formData.get("title"),
    result: formData.get("result"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid case study." };

  await prisma.caseStudy.create({
    data: {
      workspaceId,
      title: parsed.data.title,
      result: parsed.data.result,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl || null,
      category: parsed.data.category || null,
    },
  });

  revalidatePath("/");
  await writeAuditLog({ action: "case-study.create", actorRole, metadata: { title: parsed.data.title }, workspaceId });
  return { ok: true, error: "" };
}
