import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const BUILD_TIME_DATABASE_URL_FALLBACK = "postgresql://build:build@localhost:5432/build";
const isBuildTimeEvaluation = process.env.NEXT_PHASE === "phase-production-build";
const prismaDatabaseUrl = process.env.DATABASE_URL?.trim()
  || (isBuildTimeEvaluation ? BUILD_TIME_DATABASE_URL_FALLBACK : undefined);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: prismaDatabaseUrl ? { db: { url: prismaDatabaseUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
