// Neon database connection utilities for Prisma with RLS support
//
// Uses @prisma/adapter-neon which connects over WebSocket (port 443)
// instead of raw TCP (port 5432). This works even when port 5432 is blocked.

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

if (typeof WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {}
}

/**
 * Extended Prisma client that automatically wraps all operations in a transaction
 * with app.current_user_id set for RLS enforcement.
 */
export type UserPrismaClient = Omit<PrismaClient, "$transaction"> & {
  withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  unsafe: PrismaClient;
};

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Create a user-scoped Prisma client that enforces RLS via transaction-scoped
 * app.current_user_id setting.
 */
export function createUserDb(databaseUrl: string, userId: string): UserPrismaClient {
  if (!isValidUUID(userId)) {
    throw new Error(`Invalid userId format: expected UUID, got "${userId}"`);
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

  return Object.assign(prisma, {
    async withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
        return fn(tx);
      });
    },
    unsafe: prisma,
  }) as unknown as UserPrismaClient;
}

/**
 * Create an admin Prisma client with owner privileges (bypasses RLS).
 */
export function createAdminDb(databaseUrl: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });
}
