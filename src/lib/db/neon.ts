// Neon database connection utilities for Prisma with RLS support
//
// Since SET LOCAL only works within transactions, we create wrapper clients
// that enforce transaction-scoped RLS context automatically.

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // Pool cache to prevent connection exhaustion
  // We cache pools but create fresh Prisma clients to avoid state issues
  var __neonUserPool: Pool | undefined;
  var __neonAdminPool: Pool | undefined;
}

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
  // Reuse pool to avoid connection exhaustion, but create fresh Prisma client
  // Note: We cache a single pool, not per-user, since RLS is set per-transaction
  if (!globalThis.__neonUserPool) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    // Increase max listeners to prevent warnings since multiple Prisma clients share this pool
    pool.setMaxListeners(100);
    // Also set max listeners on the error emitter to prevent warnings
    pool.on("error", () => {});
    pool.removeAllListeners("error");
    pool.setMaxListeners(100);
    globalThis.__neonUserPool = pool;
  }

  const adapter = new PrismaPg(globalThis.__neonUserPool);
  const prisma = new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

  return Object.assign(prisma, {
    async withRLS<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        // Set the user ID for RLS context using $executeRawUnsafe with proper string escaping
        await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
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
  // Reuse admin pool to avoid connection exhaustion, but create fresh Prisma client
  if (!globalThis.__neonAdminPool) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    // Increase max listeners to prevent warnings since multiple Prisma clients share this pool
    pool.setMaxListeners(100);
    // Also set max listeners on the error emitter to prevent warnings
    pool.on("error", () => {});
    pool.removeAllListeners("error");
    pool.setMaxListeners(100);
    globalThis.__neonAdminPool = pool;
  }

  const adapter = new PrismaPg(globalThis.__neonAdminPool);
  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });
}
