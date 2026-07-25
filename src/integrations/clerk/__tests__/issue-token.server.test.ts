import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  issueSupabaseTokenForAuthUser,
  invalidateSupabaseToken,
  type IssuedToken,
  type IssueError,
} from "@/integrations/clerk/issue-token.server";

// -------- typed mock for the supabase admin & anon clients --------

const dummyJwt = (exp: number) => {
  // Minimal JWT with { exp } payload (valid base64url, sig ignored for tests).
  const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(exp / 1000) }))
    .toString("base64")
    .replace(/=+$/, "");
  const sig = "sig";
  return `${header}.${payload}.${sig}`;
};

const AUTH_USER_ID = "11111111-1111-1111-1111-111111111111";
const EMAIL = "***";

function makeMockClients({
  generateLinkError,
  generateLinkResult,
  verifyError,
  verifyResult,
}: {
  generateLinkError?: { message: string };
  generateLinkResult?: { hashed_token: string };
  verifyError?: { message: string };
  verifyResult?: { session: { access_token: string } };
}) {
  const generateLinkMock = vi.fn(async () => ({
    data: generateLinkResult ?? {
      properties: { hashed_token: "hashed-token-abc", action_link: "", email_otp: "otp" },
      user: { id: AUTH_USER_ID },
    },
    error: generateLinkError ?? null,
  }));
  const verifyOtpMock = vi.fn(async () => ({
    data: verifyResult ?? { session: { access_token: dummyJwt(Date.now() + 3_600_000) } },
    error: verifyError ?? null,
  }));
  const adminSupabase = {
    auth: { admin: { generateLink: generateLinkMock } },
  } as unknown as SupabaseClient<Database>;
  const anonSupabase = {
    auth: { verifyOtp: verifyOtpMock },
  } as unknown as SupabaseClient<Database>;
  return { adminSupabase, anonSupabase, generateLinkMock, verifyOtpMock };
}

beforeEach(() => {
  invalidateSupabaseToken(AUTH_USER_ID);
});

describe("issueSupabaseTokenForAuthUser", () => {
  it("returns missing_args when an input is missing", async () => {
    const { adminSupabase, anonSupabase } = makeMockClients({});
    const r = (await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: "",
      email: EMAIL,
    })) as IssueError;
    expect(r.kind).toBe("missing_args");
  });

  it("mints a token via generateLink + verifyOtp on the cold path", async () => {
    const { adminSupabase, anonSupabase, generateLinkMock, verifyOtpMock } = makeMockClients({});
    const r = (await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    })) as IssuedToken;
    expect(r.access_token).toContain(".");
    expect(typeof r.expires_at).toBe("string");
    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    // generateLink { type: "magiclink", email } was called.
    const call = generateLinkMock.mock.calls[0][0];
    expect(call.type).toBe("magiclink");
    expect(call.email).toBe(EMAIL);
    // verifyOtp { type: "email", token: hashed_token, email } was called.
    const verifyCall = verifyOtpMock.mock.calls[0][0];
    expect(verifyCall.token).toBe("hashed-token-abc");
    expect(verifyCall.email).toBe(EMAIL);
    expect(verifyCall.type).toBe("email");
  });

  it("caches the issued token and reuses it on the second call within TTL", async () => {
    const { adminSupabase, anonSupabase, generateLinkMock, verifyOtpMock } = makeMockClients({});
    // Cold-start guarantee: beforeEach already invalidates, but our cache is
    // module-level in the issuer so we explicitly drop it here too.
    invalidateSupabaseToken(AUTH_USER_ID);
    // First call: cold path. Issues a new token via generateLink + verifyOtp.
    const r1 = (await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    })) as IssuedToken;
    expect(r1.access_token).toContain(".");
    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    // Second call (within TTL): warm path. No new mint round-trips expected.
    const r2 = (await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    })) as IssuedToken;
    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    // The cached token matches the originally-issued one.
    expect(r2.access_token).toBe(r1.access_token);
  });

  it("surfaces generate_link_failed when generateLink errors", async () => {
    const { adminSupabase, anonSupabase } = makeMockClients({
      generateLinkError: { message: "rate limited" },
    });
    const r = (await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    })) as IssueError;
    expect(r.kind).toBe("generate_link_failed");
    expect(r.message).toBe("rate limited");
  });

  it("surfaces verify_failed when verifyOtp errors", async () => {
    const { adminSupabase, anonSupabase } = makeMockClients({
      verifyError: { message: "token already used" },
    });
    const r = (await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    })) as IssueError;
    expect(r.kind).toBe("verify_failed");
    expect(r.message).toBe("token already used");
  });

  it("invalidates the cache on sign-out", async () => {
    const { adminSupabase, anonSupabase, generateLinkMock, verifyOtpMock } = makeMockClients({});
    await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    });
    invalidateSupabaseToken(AUTH_USER_ID);
    generateLinkMock.mockClear();
    verifyOtpMock.mockClear();
    await issueSupabaseTokenForAuthUser({
      supabaseAdmin: adminSupabase,
      supabaseAnon: anonSupabase,
      authUserId: AUTH_USER_ID,
      email: EMAIL,
    });
    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
  });
});
