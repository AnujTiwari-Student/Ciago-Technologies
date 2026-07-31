// Neon-based auth middleware (Stage 4: Remove GoTrue)
//
// This middleware verifies Clerk JWT and injects a Neon Prisma client
// with RLS context, completely bypassing the GoTrue JWT issuance step.
//
// Flow:
//   1. Verify Clerk JWT
//   2. Look up auth_user_id from clerk_user_map (Neon)
//   3. Create user-scoped Prisma client with RLS context
//   4. Inject { db, userId, claims } into context

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createUserDb, createAdminDb, type UserPrismaClient } from "@/lib/db/neon";
import { isClerkAuthenticationEnabled } from "@/lib/feature-flags.server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const requireNeonAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    // Verify feature flag is enabled
    const enabled = await isClerkAuthenticationEnabled();
    if (!enabled) {
      throw new Error("Unauthorized: Clerk authentication is disabled by feature flag");
    }

    const CLERK_SECRET_KEY = requireEnv("CLERK_SECRET_KEY");
    const DATABASE_URL = requireEnv("DATABASE_URL");

    const request = getRequest();
    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    // Lazy imports to avoid bundle bloat when feature is disabled
    const { verifyToken, createClerkClient } = await import("@clerk/backend");

    // 1. Verify Clerk JWT
    let clerkClaims: Record<string, unknown>;
    try {
      clerkClaims = (await verifyToken(token, {
        secretKey: CLERK_SECRET_KEY,
        // Allow 60 seconds of clock skew to prevent false expiration errors
        // This matches the leeway on the client side
        clockSkewInMs: 60000,
      })) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : "verifyToken failed";
      console.error("[neon-auth] token verification failed", message);
      throw new Error(`Unauthorized: ${message}`);
    }

    const clerkUserId = clerkClaims.sub as string | undefined;
    if (!clerkUserId) {
      throw new Error("Unauthorized: Clerk token has no subject");
    }

    // 2. Look up auth_user_id from clerk_user_map
    const adminDb = createAdminDb(DATABASE_URL);
    const mapping = await adminDb.clerkUserMap.findUnique({
      where: { clerkUserId },
      select: { authUserId: true },
    });

    if (!mapping) {
      // User not provisioned - need to provision first
      const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
      const user = await clerkClient.users.getUser(clerkUserId);
      const primaryEmailObj = user.emailAddresses?.find(
        (e) => e.id === user.primaryEmailAddressId,
      );
      const email = primaryEmailObj?.emailAddress;
      const emailVerified = Boolean(primaryEmailObj?.verification?.status === "verified");

      if (!email) {
        throw new Error("Unauthorized: Clerk user has no primary email address");
      }

      const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

      // Provision user in Neon
      const { provisionClerkUser } = await import("@/integrations/clerk/provision-neon.server");
      const prov = await provisionClerkUser(adminDb, {
        clerkUserId,
        email,
        emailVerified,
        fullName,
      });

      if (!("authUserId" in prov)) {
        const message =
          "kind" in prov
            ? ("message" in prov ? prov.message : prov.kind)
            : "provision failed";
        console.error("[neon-auth] provisioning failed", message);
        throw new Error(`Unauthorized: ${message}`);
      }

      // Use the newly provisioned auth_user_id
      const userDb = createUserDb(DATABASE_URL, prov.authUserId);

      return next({
        context: {
          db: userDb,
          userId: prov.authUserId,
          claims: clerkClaims,
        },
      });
    }

    // 3. Create user-scoped Prisma client with RLS context
    const userDb = createUserDb(DATABASE_URL, mapping.authUserId);

    // 4. Inject context
    return next({
      context: {
        db: userDb,
        userId: mapping.authUserId,
        claims: clerkClaims,
      },
    });
  },
);
