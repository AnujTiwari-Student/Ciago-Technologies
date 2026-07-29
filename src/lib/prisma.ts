// Prisma client singleton for Ciago Technologies.
//
// Prisma 7 requires the connection URL to be passed directly to PrismaClient
// (not via schema.prisma datasource block). The URL comes from DATABASE_URL
// environment variable, with DIRECT_URL used for migrations.
//
// For Cloudflare Workers (edge runtime), the Neon serverless driver is used
// via @prisma/adapter-neon. This requires:
//   bun add @prisma/adapter-neon @neondatabase/serverless
//
// Usage:
//   import { prisma } from "@/lib/prisma";
//   const users = await prisma.userRole.findMany({ where: { userId } });
//
// RLS usage (use prisma.$transaction):
//   await prisma.$transaction(async (tx) => {
//     await tx.$executeRaw`SET LOCAL app.current_user_id = ${userId}::uuid`;
//     return tx.userRole.findMany({ where: { userId } });
//   });

import { PrismaClient } from "@prisma/client";

declare global {
  // Prevent multiple PrismaClient instances in development (HMR-safe).
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const datasourceUrl = process.env["DATABASE_URL"];
  return new PrismaClient({
    datasourceUrl,
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient =
  process.env["NODE_ENV"] === "production"
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());

export default prisma;
