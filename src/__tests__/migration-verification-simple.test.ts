/**
 * Simple Migration Verification Test
 *
 * Verifies: Clerk → Neon → R2
 * Run with: bun test src/__tests__/migration-verification-simple.test.ts
 */

import { describe, it, expect } from "vitest";
import { createClerkClient } from "@clerk/backend";
import { getAdminDb } from "@/lib/db/admin";
import { getStorage } from "@/lib/storage";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY not set");
}

describe("Migration Verification", () => {
  it(
    "Clerk → Neon → R2 pipeline works",
    { timeout: 20000 },
    async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      let clerkUserId: string | null = null;
      let authUserId: string | null = null;
      const testFilePath = `test-${Date.now()}/file.txt`;

      try {
        console.log("\n=== Migration Stack Verification ===\n");

        // 1. Create Clerk user
        console.log("1. Creating Clerk user...");
        const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY! });
        const user = await clerk.users.createUser({
          emailAddress: [testEmail],
          firstName: "Test",
          lastName: "User",
          skipPasswordRequirement: true,
        });
        clerkUserId = user.id;
        console.log(`   ✓ Clerk user: ${clerkUserId}`);

        // 2. Provision to Neon
        console.log("2. Provisioning to Neon...");
        const { provisionClerkUser } = await import(
          "@/integrations/clerk/provision-neon.server"
        );
        const adminDb = getAdminDb();
        const result = await provisionClerkUser(adminDb, {
          clerkUserId,
          email: testEmail,
          emailVerified: true,
          fullName: "Test User",
        });

        expect(result).toHaveProperty("authUserId");
        authUserId = (result as any).authUserId;
        console.log(`   ✓ Neon user: ${authUserId}`);

        // Verify mapping
        const mapping = await adminDb.clerkUserMap.findUnique({
          where: { clerkUserId },
        });
        expect(mapping?.authUserId).toBe(authUserId);
        console.log(`   ✓ clerk_user_map verified`);

        // 3. Upload to R2
        console.log("3. Uploading to R2...");
        const storage = getStorage();
        const buffer = Buffer.from("Test file content", "utf-8");
        const uploadResult = await storage.upload("avatars", testFilePath, buffer, "text/plain");

        expect(uploadResult.error).toBeNull();
        console.log(`   ✓ R2 upload: ${uploadResult.path}`);

        // 4. Generate signed URL
        console.log("4. Generating R2 signed URL...");
        const signedUrl = await storage.createSignedUrl("avatars", testFilePath, 300);
        expect(signedUrl.error).toBeNull();
        expect(signedUrl.signedUrl).toMatch(/^https:/);
        console.log(`   ✓ Signed URL: ${signedUrl.signedUrl!.substring(0, 60)}...`);

        console.log("\n✅ Migration verified: Clerk → Neon → R2\n");
      } finally {
        // Cleanup
        if (clerkUserId) {
          try {
            const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY! });
            await clerk.users.deleteUser(clerkUserId);
          } catch {}
        }
        if (authUserId) {
          try {
            const adminDb = getAdminDb();
            await adminDb.clerkUserMap.deleteMany({ where: { authUserId } });
            await adminDb.$queryRawUnsafe(
              `DELETE FROM auth.users WHERE id = '${authUserId}'::uuid`,
            );
          } catch {}
        }
        try {
          const storage = getStorage();
          await storage.remove("avatars", [testFilePath]);
        } catch {}
      }
    },
  );
});
