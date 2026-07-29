import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags.server", () => ({
  isClerkAuthenticationEnabled: vi.fn(),
}));

describe("auth middleware clerk flag enforcement", () => {
  it("allows server auth branch when flag is enabled", async () => {
    const { isClerkAuthenticationEnabled } = await import("@/lib/feature-flags.server");
    vi.mocked(isClerkAuthenticationEnabled).mockResolvedValueOnce(true);
    const { assertClerkAuthFeatureEnabledForServer } =
      await import("@/integrations/supabase/auth-middleware");
    await expect(assertClerkAuthFeatureEnabledForServer()).resolves.toBeUndefined();
  });

  it("blocks server auth branch when flag is disabled", async () => {
    const { isClerkAuthenticationEnabled } = await import("@/lib/feature-flags.server");
    vi.mocked(isClerkAuthenticationEnabled).mockResolvedValueOnce(false);
    const { assertClerkAuthFeatureEnabledForServer } =
      await import("@/integrations/supabase/auth-middleware");
    await expect(assertClerkAuthFeatureEnabledForServer()).rejects.toThrow(
      "Clerk authentication is disabled by feature flag",
    );
  });
});
