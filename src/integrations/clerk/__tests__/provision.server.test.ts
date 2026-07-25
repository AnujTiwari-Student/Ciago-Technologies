import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  provisionClerkUser,
  lookupClerkIdByAuthUserId,
  type ClerkIdentity,
  type ProvisionError,
} from "@/integrations/clerk/provision.server";

// -------- mock supabase builder (typed) --------

type MaybeSingleResult = {
  data: { auth_user_id?: string; clerk_user_id?: string } | null;
  error?: { code?: string; message?: string };
};

type Chain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn<[], Promise<MaybeSingleResult>>>;
  upsert: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

type CreateUserMock = ReturnType<typeof vi.fn>;

function makeMockSupabase(
  maybeSingleSequence: MaybeSingleResult[],
  opts: {
    upsertResult?: { error?: { code?: string; message?: string } } | null;
    insertResult?: { error?: { code?: string; message?: string } } | null;
    createUser?: { data: { user: { id: string } | null }; error?: { message?: string } } | null;
  } = {},
) {
  let callIdx = 0;
  const fromCalls: string[] = [];
  const eqCalls: string[] = [];
  const createUserMock: CreateUserMock = vi.fn(
    async () => opts.createUser ?? { data: { user: { id: "" } } },
  );
  const supabaseAdmin = {
    from: vi.fn((_table: string) => {
      fromCalls.push(_table);
      const chain: Chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((col: string) => {
          eqCalls.push(col);
          return chain;
        }),
        maybeSingle: vi.fn(async () => {
          const r = maybeSingleSequence[Math.min(callIdx, maybeSingleSequence.length - 1)];
          callIdx++;
          return r ?? { data: null };
        }),
        upsert: vi.fn(async () => opts.upsertResult ?? { data: null }),
        insert: vi.fn(async () => opts.insertResult ?? { error: null }),
      };
      return chain;
    }),
    auth: { admin: { createUser: createUserMock } },
  };
  return {
    supabaseAdmin: supabaseAdmin as unknown as SupabaseClient<Database>,
    fromCalls,
    eqCalls,
    createUserMock,
  };
}

const baseIdentity: ClerkIdentity = {
  clerkUserId: "user_2vX1ABC",
  email: "***",
  emailVerified: true,
  fullName: "Jane Doe",
};

// --------------------------------------------------------------------------

describe("provisionClerkUser", () => {
  it("returns the existing mapping when a clerk_user_id is already mapped", async () => {
    const { supabaseAdmin, createUserMock } = makeMockSupabase([
      { data: { auth_user_id: "11111111-1111-1111-1111-111111111111" } },
    ]);
    const res = await provisionClerkUser(supabaseAdmin, baseIdentity);
    expect(res).toEqual({
      authUserId: "11111111-1111-1111-1111-111111111111",
      created: false,
      reused: true,
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects an identity without a clerk_user_id", async () => {
    const { supabaseAdmin } = makeMockSupabase([{ data: null }]);
    const res = (await provisionClerkUser(supabaseAdmin, {
      ...baseIdentity,
      clerkUserId: "",
    })) as ProvisionError;
    expect(res.kind).toBe("missing_clerk_user_id");
  });

  it("rejects an identity without an email", async () => {
    const { supabaseAdmin } = makeMockSupabase([{ data: null }]);
    const res = (await provisionClerkUser(supabaseAdmin, {
      ...baseIdentity,
      email: null,
    })) as ProvisionError;
    expect(res.kind).toBe("missing_email");
  });

  it("reuses an existing auth.users row when the email is already mapped", async () => {
    // Sequence: direct (null), by-email (existing mapping).
    const { supabaseAdmin, createUserMock } = makeMockSupabase(
      [{ data: null }, { data: { auth_user_id: "22222222-2222-2222-2222-222222222222" } }],
      { upsertResult: { error: null } },
    );
    const res = await provisionClerkUser(supabaseAdmin, baseIdentity);
    expect(res).toEqual({
      authUserId: "22222222-2222-2222-2222-222222222222",
      created: false,
      reused: true,
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("creates a new auth.users row when no partial mapping exists and inserts the map", async () => {
    // Sequence: direct (null), by-email (null), insert succeeds.
    const { supabaseAdmin, createUserMock } = makeMockSupabase([{ data: null }, { data: null }], {
      insertResult: { error: null },
      createUser: { data: { user: { id: "33333333-3333-3333-3333-333333333333" } } },
    });
    const res = await provisionClerkUser(supabaseAdmin, baseIdentity);
    expect(res).toEqual({
      authUserId: "33333333-3333-3333-3333-333333333333",
      created: true,
      reused: false,
    });
    expect(createUserMock).toHaveBeenCalledTimes(1);
    const call = (createUserMock as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.email).toBe("***");
    // We confirm the email directly because Clerk has already verified it;
    // Supabase must NOT send its own verification email.
    expect(call.email_confirm).toBe(true);
    expect(call.user_metadata?.full_name).toBe("Jane Doe");
  });

  it("falls back to the existing row on a unique-violation during insert (provisioning race)", async () => {
    // Sequence: direct (null) — emailVerified:false skips the by-email probe
    //         → createUser → insert throws 23505 → tie-break maybeSingle (mapping exists).
    const { supabaseAdmin } = makeMockSupabase(
      [{ data: null }, { data: { auth_user_id: "55555555-5555-5555-5555-555555555555" } }],
      {
        insertResult: { error: { code: "23505", message: "duplicate key value" } },
        createUser: { data: { user: { id: "44444444-4444-4444-4444-444444444444" } } },
      },
    );
    const res = await provisionClerkUser(supabaseAdmin, {
      ...baseIdentity,
      emailVerified: false,
    });
    expect(res).toEqual({
      authUserId: "55555555-5555-5555-5555-555555555555",
      created: false,
      reused: true,
    });
  });
});

describe("lookupClerkIdByAuthUserId", () => {
  it("returns the clerk_user_id when a mapping exists", async () => {
    const { supabaseAdmin } = makeMockSupabase([{ data: { clerk_user_id: "user_lookup" } }]);
    const out = await lookupClerkIdByAuthUserId(supabaseAdmin, "***");
    expect(out).toBe("user_lookup");
  });

  it("returns null when no mapping exists", async () => {
    const { supabaseAdmin } = makeMockSupabase([{ data: null }]);
    const out = await lookupClerkIdByAuthUserId(supabaseAdmin, "***");
    expect(out).toBeNull();
  });
});
