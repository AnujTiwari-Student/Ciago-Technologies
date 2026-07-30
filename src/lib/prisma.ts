// Prisma client singleton for Ciago Technologies.
//
// Prisma 7 with serverless requires a driver adapter. We use @prisma/adapter-pg
// with the standard pg Pool, which works with Neon's PostgreSQL-compatible pooler.
//
// The DATABASE_URL comes from .env and points to Neon's pooler connection string.
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
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // Prevent multiple PrismaClient instances in development (HMR-safe).
  var __prisma: PrismaClient | undefined;
  var __pgPool: Pool | undefined;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Reuse pool in development to avoid connection leaks during HMR
  const pool = globalThis.__pgPool ?? new Pool({ connectionString: databaseUrl });
  if (process.env["NODE_ENV"] !== "production") {
    globalThis.__pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient =
  process.env["NODE_ENV"] === "production"
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());

export default prisma;
