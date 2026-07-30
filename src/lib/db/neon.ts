// Neon database connection utilities for Prisma with RLS support
//
// Since SET LOCAL only works within transactions, we create wrapper clients
// that enforce transaction-scoped RLS context automatically.

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Extended Prisma client that automatically wraps all operations in a transaction
 * with app.current_user_id set for RLS enforcement.
 */
export type UserPrismaClient = Omit<PrismaClient, "$transaction"> & {
  /**
   * Execute a query with RLS context. All operations must use this method.
   * The userId is automatically set via SET LOCAL before the query runs.
   */
  withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;

  /**
   * Direct access to underlying Prisma client (bypasses RLS - use with caution)
   */
  unsafe: PrismaClient;
};

/**
 * Create a user-scoped Prisma client that enforces RLS via transaction-scoped
 * app.current_user_id setting.
 *
 * Usage in middleware:
 *   const db = createUserDb(DATABASE_URL, authUserId);
 *
 *   // All queries must use withRLS:
 *   const roles = await db.withRLS(tx => tx.userRole.findMany({ where: { userId } }));
 */
export function createUserDb(databaseUrl: string, userId: string): UserPrismaClient {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

  return Object.assign(prisma, {
    async withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        // Use dollar-quoted string to avoid escaping issues with UUID casting
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = $$${userId}$$::uuid`);
        return fn(tx);
      });
    },

    unsafe: prisma,
  }) as unknown as UserPrismaClient;
}

/**
 * Create an admin Prisma client with owner privileges (bypasses RLS).
 *
 * Use for system operations: clerk_user_map lookups, admin queries, provisioning.
 */
export function createAdminDb(databaseUrl: string): PrismaClient {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });
}
