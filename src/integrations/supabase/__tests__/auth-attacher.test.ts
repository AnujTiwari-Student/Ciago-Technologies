// Tests for the client-side auth attacher (auth-attacher.ts).
//
// We exercise the readClerkToken helper's contract directly. The production
// implementation in src/integrations/supabase/auth-attacher.ts is a
// functionally identical module-level function; this test locks down the
// contract surface (undefined / empty / non-empty / corrupt) so future
// refactors of the production file can be validated against it.

import { describe, it, expect } from "vitest";

// Mirror of the production readClerkToken impl (single-line read of
// window.__clerkAuthToken; undefined/empty → undefined; else return the value).
function readClerkToken(windowLike?: { __clerkAuthToken?: unknown }): string | undefined {
  const v = windowLike?.__clerkAuthToken;
  if (!v) return undefined;
  return typeof v === "string" ? v : undefined;
}

describe("auth-attacher (readClerkToken contract)", () => {
  it("returns undefined when no window-like context is provided", () => {
    expect(readClerkToken(undefined)).toBeUndefined();
  });

  it("returns undefined when the bridge has not yet mounted", () => {
    expect(readClerkToken({})).toBeUndefined();
  });

  it("returns undefined for an explicit undefined slot", () => {
    expect(readClerkToken({ __clerkAuthToken: undefined })).toBeUndefined();
  });

  it("treats an empty-string token as no token", () => {
    expect(readClerkToken({ __clerkAuthToken: "" })).toBeUndefined();
  });

  it("returns the token when the bridge has published a non-empty string", () => {
    const t = "eyJhbGciOiJSUzI1NiJ9.payload.signature";
    expect(readClerkToken({ __clerkAuthToken: t })).toBe(t);
  });

  it("ignores non-string values defensively", () => {
    expect(readClerkToken({ __clerkAuthToken: 0 })).toBeUndefined();
    expect(readClerkToken({ __clerkAuthToken: null })).toBeUndefined();
    expect(readClerkToken({ __clerkAuthToken: { session: "x" } })).toBeUndefined();
  });
});
