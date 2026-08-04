// Clerk→Neon identity provisioning (Stage 4: Neon migration). SERVER-ONLY.
//
// This is the Neon/Prisma port of provision.server.ts.
//
// Maintains the public.clerk_user_map table using Prisma instead of Supabase.
// Since we're bypassing GoTrue, we manage auth.users rows directly via raw SQL.
//
// Flow (idempotent):
//   1. Look up existing mapping by clerk_user_id
//   2. If none and email verified, look up by email (cross-provider reuse)
//   3. If still none, create auth.users row + clerk_user_map entry
//
// All operations use the admin Prisma client (bypasses RLS).

import type { AppRole, PrismaClient } from "@prisma/client";

export type ClerkIdentity = {
  clerkUserId: string;
  email: string | null;
  emailVerified: boolean | null;
  fullName?: string | null;
};

export type ProvisionResult = {
  authUserId: string;
  created: boolean;
  reused: boolean;
};

export type ProvisionError =
  | { kind: "missing_clerk_user_id" }
  | { kind: "missing_email" }
  | { kind: "create_user_failed"; message: string }
  | { kind: "link_failed"; message: string };

function ok(authUserId: string, created: boolean, reused: boolean): ProvisionResult {
  return { authUserId, created, reused };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  // Postgres unique violation error code
  if (maybe.code === "23505") return true;
  // Prisma unique violation error code
  if (maybe.code === "P2002") return true;
  if (typeof maybe.message === "string" && /unique constraint/i.test(maybe.message)) return true;
  if (typeof maybe.message === "string" && /duplicate key value/i.test(maybe.message)) return true;
  return false;
}

/**
 * Map a Clerk identity to a Neon auth.users row, creating both the auth.users
 * row and clerk_user_map entry as needed. Idempotent.
 *
 * @param adminDb - Admin Prisma client (bypasses RLS)
 * @param identity - Clerk user identity
 */
export async function provisionClerkUser(
  adminDb: PrismaClient,
  identity: ClerkIdentity,
): Promise<ProvisionResult | ProvisionError> {
  if (!identity.clerkUserId) return { kind: "missing_clerk_user_id" };
  if (!identity.email) return { kind: "missing_email" };

  const email = identity.email.trim().toLowerCase();
  if (!email) return { kind: "missing_email" };

  try {
    // (1) Direct lookup by Clerk user id
    const direct = await adminDb.clerkUserMap.findUnique({
      where: { clerkUserId: identity.clerkUserId },
      select: { authUserId: true },
    });

    if (direct) {
      return ok(direct.authUserId, false, true);
    }

    // (2) Lookup by verified email (cross-provider reuse)
    if (identity.emailVerified) {
      const byEmail = await adminDb.clerkUserMap.findFirst({
        where: { email },
        select: { authUserId: true, clerkUserId: true },
      });

      if (byEmail) {
        // Reuse the mapped auth_user_id and move mapping to this Clerk user id when needed.
        try {
          if (byEmail.clerkUserId === identity.clerkUserId) {
            await adminDb.clerkUserMap.update({
              where: { clerkUserId: identity.clerkUserId },
              data: { email, primaryEmailVerified: true },
            });
          } else {
            await adminDb.clerkUserMap.update({
              where: { authUserId: byEmail.authUserId },
              data: {
                clerkUserId: identity.clerkUserId,
                email,
                primaryEmailVerified: true,
              },
            });
          }
          return ok(byEmail.authUserId, false, true);
        } catch (err) {
          if (!isUniqueViolation(err)) {
            const message = err instanceof Error ? err.message : String(err);
            return { kind: "link_failed", message };
          }
          // Concurrent write won - re-read by current Clerk user id.
          const tieBreak = await adminDb.clerkUserMap.findUnique({
            where: { clerkUserId: identity.clerkUserId },
            select: { authUserId: true },
          });
          if (tieBreak) {
            return ok(tieBreak.authUserId, false, true);
          }
        }
      }
    }

    // (3) No mapping yet - create auth.users row and mapping atomically
    try {
      const authUserId = await adminDb.$transaction(async (tx) => {
        // Check for existing user by email first to avoid duplicate
        const existingByEmail = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id::text FROM auth.users WHERE email = ${email} LIMIT 1
        `;

        let newAuthUserId: string;

        if (existingByEmail.length > 0) {
          // User already exists, reuse it
          newAuthUserId = existingByEmail[0].id;
        } else {
          // Create auth.users row with raw SQL (Prisma doesn't have auth schema)
          const result = await tx.$queryRaw<Array<{ id: string }>>`
            INSERT INTO auth.users (email, email_confirmed_at, raw_user_meta_data)
            VALUES (
              ${email},
              CASE WHEN ${identity.emailVerified} THEN NOW() ELSE NULL END,
              ${identity.fullName ? JSON.stringify({ full_name: identity.fullName }) : "{}"}::jsonb
            )
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING id::text
          `;

          if (!result[0]?.id) {
            throw new Error("Failed to create auth.users row");
          }

          newAuthUserId = result[0].id;
        }

        // Create or update clerk_user_map entry while preserving auth_user_id uniqueness.
        const existingByAuth = await tx.clerkUserMap.findUnique({
          where: { authUserId: newAuthUserId },
          select: { clerkUserId: true },
        });

        if (existingByAuth) {
          await tx.clerkUserMap.update({
            where: { authUserId: newAuthUserId },
            data: {
              clerkUserId: identity.clerkUserId,
              email,
              primaryEmailVerified: Boolean(identity.emailVerified),
            },
          });
        } else {
          await tx.clerkUserMap.upsert({
            where: { clerkUserId: identity.clerkUserId },
            create: {
              clerkUserId: identity.clerkUserId,
              authUserId: newAuthUserId,
              email,
              primaryEmailVerified: Boolean(identity.emailVerified),
            },
            update: {
              authUserId: newAuthUserId,
              email,
              primaryEmailVerified: Boolean(identity.emailVerified),
            },
          });
        }

        // Create default user role if none exists
        const existingRole = await tx.userRole.findFirst({
          where: { userId: newAuthUserId },
        });

        if (!existingRole) {
          await tx.userRole.create({
            data: {
              userId: newAuthUserId,
              role: "user" as AppRole,
            },
          });
        }

        return newAuthUserId;
      });

      return ok(authUserId, true, false);
    } catch (innerErr) {
      if (isUniqueViolation(innerErr)) {
        // Concurrent provision won - re-read the mapping
        const tieBreak = await adminDb.clerkUserMap.findUnique({
          where: { clerkUserId: identity.clerkUserId },
          select: { authUserId: true },
        });

        if (tieBreak) {
          return ok(tieBreak.authUserId, false, true);
        }
      }
      throw innerErr; // Re-throw to outer catch
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Concurrent provision won - re-read the mapping
      const tieBreak = await adminDb.clerkUserMap.findUnique({
        where: { clerkUserId: identity.clerkUserId },
        select: { authUserId: true },
      });

      if (tieBreak) {
        return ok(tieBreak.authUserId, false, true);
      }

      return {
        kind: "link_failed",
        message: "concurrent provision collision not resolvable",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return { kind: "create_user_failed", message };
  }
}

/**
 * Reverse lookup — given auth_user_id, return the Clerk user id if mapped.
 */
export async function lookupClerkIdByAuthUserId(
  adminDb: PrismaClient,
  authUserId: string,
): Promise<string | null> {
  try {
    const mapping = await adminDb.clerkUserMap.findUnique({
      where: { authUserId },
      select: { clerkUserId: true },
    });
    return mapping?.clerkUserId ?? null;
  } catch (err) {
    console.error("[clerk-neon] reverse lookup failed", err);
    return null;
  }
}
