import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createUserDb, createAdminDb, type UserPrismaClient } from "@/lib/db/neon";
import { isClerkAuthenticationEnabled } from "@/lib/feature-flags.server";

async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConnectionError =
        err?.message?.includes("connection timeout") ||
        err?.message?.includes("Connection terminated") ||
        err?.message?.includes("ECONNREFUSED") ||
        err?.message?.includes("ENOTFOUND") ||
        err?.message?.includes("Client has encountered a connection error") ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT";
      if (!isConnectionError || attempt === retries) throw err;
      console.warn(`[auth-middleware] DB connection failed (attempt ${attempt + 1}), retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Unreachable");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
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

    const { verifyToken, createClerkClient } = await import("@clerk/backend");
    const { provisionClerkUser } = await import("@/integrations/clerk/provision-neon.server");

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
      console.error("[auth] token verification failed", message);
      throw new Error(`Unauthorized: ${message}`);
    }

    const clerkUserId = clerkClaims.sub as string | undefined;
    if (!clerkUserId) {
      throw new Error("Unauthorized: Clerk token has no subject");
    }

    const adminDb = createAdminDb(DATABASE_URL);
    let mapping = await withDbRetry(() =>
      adminDb.clerkUserMap.findUnique({
        where: { clerkUserId },
        select: { authUserId: true },
      })
    );

    if (!mapping) {
      const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
      const user = await clerkClient.users.getUser(clerkUserId);
      const primaryEmailObj = user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId);
      const email = primaryEmailObj?.emailAddress;
      const emailVerified = Boolean(primaryEmailObj?.verification?.status === "verified");

      if (!email) {
        throw new Error("Unauthorized: Clerk user has no primary email address");
      }

      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

      const prov = await withDbRetry(() =>
        provisionClerkUser(adminDb, {
          clerkUserId,
          email,
          emailVerified,
          fullName,
        })
      );

      if (!("authUserId" in prov)) {
        const message =
          "kind" in prov ? ("message" in prov ? prov.message : prov.kind) : "provision failed";
        console.error("[auth] provisioning failed", message);
        throw new Error(`Unauthorized: ${message}`);
      }

      mapping = { authUserId: prov.authUserId };
    }

    const userDb = createUserDb(DATABASE_URL, mapping.authUserId);

    return next({
      context: {
        db: userDb,
        userId: mapping.authUserId,
        claims: clerkClaims,
      },
    });
  },
);
