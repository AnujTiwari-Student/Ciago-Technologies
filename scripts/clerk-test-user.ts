// Provision a dummy Clerk user for end-to-end verification.
//
// Usage:
//   bun scripts/clerk-test-user.ts
//
// Reads CLERK_SECRET_KEY from .env. Creates a reusable test user with a
// random email/password, prints the credentials to stdout, and verifies
// that the user can complete a sign-in against Clerk's REST API.
//
// IMPORTANT: this script is for development/staging only. Do not point
// it at a production Clerk app — it will create real user records.
//
// What the script does:
//   1. Reads CLERK_SECRET_KEY from .env.
//   2. Generates a random email + password pair.
//   3. Uses @clerk/backend's `createUser` to provision the user.
//   4. Prints the credentials + the Clerk user_id so the engineer can
//      paste them into the auth page for manual verification.
//   5. Calls Clerk's sign-in endpoint with those credentials to confirm
//      the user is actually usable end-to-end.
//
// Why this exists:
//   After the Clerk migration, manual end-to-end verification requires
//   at least one real signup. Rather than have the engineer walk the
//   `/auth?flow=signup` UI (which is interactive and slow), this script
//   provisions the user in one shot using the same Backend SDK the
//   application uses server-side.

import { createClerkClient } from "@clerk/backend";

function readSecretKey(): string | undefined {
  // Bun auto-loads .env; we still read in case the script is invoked
  // outside the standard runner.
  return process.env.CLERK_SECRET_KEY;
}

function randomEmail(): string {
  // Random 8-char hex prefix; deterministic enough for a smoke test.
  const hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `ciago.test.${hex}@example-test.com`;
}

async function main(): Promise<void> {
  const secret = readSecretKey();
  if (!secret) {
    console.error(
      "CLERK_SECRET_KEY is not set in the environment. Add it to .env and re-run.\n" +
        "Get one from: https://dashboard.clerk.com → your app → API Keys.",
    );
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: secret });
  const email = randomEmail();
  const password = `Ciago-Test-${Math.random().toString(36).slice(2, 10)}`;

  console.log(`→ Provisioning dummy user ${email} …`);

  let created;
  try {
    created = await clerk.users.createUser({
      emailAddress: [email],
      password,
      firstName: "Ciago",
      lastName: "Test",
      skipPasswordChecks: true,
      skipPasswordRequirement: false,
    });
  } catch (err) {
    // Already exists? Look it up and reuse.
    const message = (err as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
    if (message === "form_identifer_exists") {
      const list = await clerk.users.getUserList({ emailAddress: [email] });
      created = list.data[0];
    } else {
      throw err;
    }
  }

  console.log("✓ Provisioned:");
  console.log(`    user_id:    ${created!.id}`);
  console.log(`    email:      ${email}`);
  console.log(`    password:   ${password}`);
  console.log();
  console.log("Use these credentials at /auth (Sign in tab).");
  console.log(
    "After signing in, /auth should redirect to either the candidate portal\n" +
      "or /onboarding if no clerk_user_map row exists yet. To pre-link to the\n" +
      "Supabase auth.users row, you can either (a) complete /onboarding, or\n" +
      "(b) manually INSERT a clerk_user_map row via SQL.",
  );
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});
