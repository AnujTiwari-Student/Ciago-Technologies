import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({
  FLAGS: { USE_CLERK_AUTH: true },
}));

vi.mock("@/lib/feature-flags.functions", () => ({
  isClerkAuthEnabledFn: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@/lib/roles.functions", () => ({
  getMyAuthUserId: vi.fn(async () => "user-1"),
  getMyRoles: vi.fn(async () => ({
    isAdmin: false,
    isHr: false,
    isManager: false,
    isEmployee: true,
    isStaff: true,
    departmentId: null,
  })),
}));

describe("clerk auth route/callback enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { window?: { __clerkAuthToken?: string } }).window = {
      __clerkAuthToken: "token",
    };
  });

  it("blocks protected-route auth when clerkAuthentication is OFF", async () => {
    const { isClerkAuthEnabledFn } = await import("@/lib/feature-flags.functions");
    (isClerkAuthEnabledFn as any).mockResolvedValueOnce(false);
    const { requireAuthenticated } = await import("@/routes/_authenticated/-guard");

    await expect(requireAuthenticated("/employee")).rejects.toMatchObject({
      options: {
        to: "/forbidden",
        search: { reason: "clerk_auth_disabled" },
      },
    });
  });

  it("blocks direct callback access when clerkAuthentication is OFF", async () => {
    const { isClerkAuthEnabledFn } = await import("@/lib/feature-flags.functions");
    (isClerkAuthEnabledFn as any).mockResolvedValueOnce(false);
    const { enforceSsoCallbackAccess } = await import("@/routes/auth.sso-callback");

    await expect(enforceSsoCallbackAccess()).rejects.toMatchObject({
      options: {
        to: "/forbidden",
        search: { reason: "clerk_auth_disabled" },
      },
    });
  });

  it("allows callback when clerkAuthentication is ON", async () => {
    const { isClerkAuthEnabledFn } = await import("@/lib/feature-flags.functions");
    (isClerkAuthEnabledFn as any).mockResolvedValueOnce(true);
    const { enforceSsoCallbackAccess } = await import("@/routes/auth.sso-callback");
    await expect(enforceSsoCallbackAccess()).resolves.toBeUndefined();
  });
});
