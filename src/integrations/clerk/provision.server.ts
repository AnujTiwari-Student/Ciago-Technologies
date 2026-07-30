// Clerk→Neon identity provisioning. SERVER-ONLY.
//
// Maintains the public.clerk_user_map sidecar table.
//
// Responsibilities (in this order, all idempotent):
//   1. Find an existing mapping for the Clerk user id.
//   2. If none, find an existing mapping by verified email — the Clerk user
//      may have previously signed in via a different provider on the same
//      email address; reuse the linked auth.users row in that case.
//   3. If still none and an auth.users row already exists with that email,
//      link the Clerk id to it (atomic single insert).
//   4. Otherwise, mint a new auth.users row via raw SQL INSERT into auth.users
//      then insert the mapping.
//
// All writes go through the admin Prisma client (bypasses RLS).
//
// Returns the canonical auth_user_id (UUID) for the given Clerk identity.
// Callers use this value as the RLS-context user id.

import { getAdminDb } from "@/lib/db/admin";

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
  if (maybe.code === "P2002") return true;
  if (typeof maybe.message === "string" && /unique constraint/i.test(maybe.message)) return true;
  return false;
}

export async function provisionClerkUser(
  _unused: unknown,
  identity: ClerkIdentity,
): Promise<ProvisionResult | ProvisionError> {
  if (!identity.clerkUserId) return { kind: "missing_clerk_user_id" };
  if (!identity.email) return { kind: "missing_email" };
  const email = identity.email.trim().toLowerCase();
  if (!email) return { kind: "missing_email" };

  const adminDb = getAdminDb();

  // (1) Direct lookup by Clerk user id.
  const direct = await adminDb.clerkUserMap.findUnique({
    where: { clerkUserId: identity.clerkUserId },
    select: { authUserId: true },
  });
  if (direct) {
    return ok(direct.authUserId, false, true);
  }

  // (2) Lookup by verified email.
  if (identity.emailVerified) {
    const byEmail = await adminDb.clerkUserMap.findFirst({
      where: { email },
      select: { authUserId: true },
    });
    if (byEmail) {
      try {
        await adminDb.clerkUserMap.upsert({
          where: { clerkUserId: identity.clerkUserId },
          create: {
            clerkUserId: identity.clerkUserId,
            authUserId: byEmail.authUserId,
            email,
            primaryEmailVerified: true,
          },
          update: {},
        });
      } catch (e) {
        if (!isUniqueViolation(e)) {
          return { kind: "link_failed", message: String(e) };
        }
      }
      return ok(byEmail.authUserId, false, true);
    }
  }

  // (3) No mapping yet. Mint an auth.users row directly via raw SQL.
  let authUserId: string;
  try {
    const rows = await adminDb.$queryRaw<Array<{ id: string }>>`
      INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), ${email}, now(), ${JSON.stringify(identity.fullName ? { full_name: identity.fullName } : {})}::jsonb)
      RETURNING id::text
    `;
    if (!rows[0]?.id) {
      return { kind: "create_user_failed", message: "INSERT returned no user id" };
    }
    authUserId = rows[0].id;
  } catch (e: any) {
    if (isUniqueViolation(e)) {
      // Email already exists in auth.users — look it up and link.
      const existing = await adminDb.$queryRaw<Array<{ id: string }>>`
        SELECT id::text FROM auth.users WHERE lower(email) = ${email} LIMIT 1
      `;
      if (!existing[0]?.id) {
        return { kind: "create_user_failed", message: "auth.users row exists but cannot be read" };
      }
      authUserId = existing[0].id;
    } else {
      return { kind: "create_user_failed", message: e?.message ?? String(e) };
    }
  }

  // (4) Insert the mapping row.
  try {
    await adminDb.clerkUserMap.create({
      data: {
        clerkUserId: identity.clerkUserId,
        authUserId,
        email,
        primaryEmailVerified: Boolean(identity.emailVerified),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const tieBreak = await adminDb.clerkUserMap.findUnique({
        where: { clerkUserId: identity.clerkUserId },
        select: { authUserId: true },
      });
      if (!tieBreak) {
        return { kind: "link_failed", message: "concurrent provision collision not resolvable" };
      }
      return ok(tieBreak.authUserId, false, true);
    }
    return { kind: "link_failed", message: String(e) };
  }

  return ok(authUserId, true, false);
}

export async function lookupClerkIdByAuthUserId(
  _unused: unknown,
  authUserId: string,
): Promise<string | null> {
  const adminDb = getAdminDb();
  const row = await adminDb.clerkUserMap.findFirst({
    where: { authUserId },
    select: { clerkUserId: true },
  });
  return row?.clerkUserId ?? null;
}
