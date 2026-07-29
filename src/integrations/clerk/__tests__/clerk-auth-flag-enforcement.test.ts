import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags.functions", () => ({
  isClerkAuthEnabledFn: vi.fn(),
}));

describe("clerk auth initiation enforcement", () => {
  it("allows auth initiation when clerkAuthentication is ON", async () => {
    const { isClerkAuthEnabledFn } = await import("@/lib/feature-flags.functions");
    vi.mocked(isClerkAuthEnabledFn).mockResolvedValueOnce(true);
    const { canProceedWithClerkAuth } = await import("@/integrations/clerk/forms");
    await expect(canProceedWithClerkAuth()).resolves.toBe(true);
  });

  it("denies auth initiation when clerkAuthentication is OFF", async () => {
    const { isClerkAuthEnabledFn } = await import("@/lib/feature-flags.functions");
    vi.mocked(isClerkAuthEnabledFn).mockResolvedValueOnce(false);
    const { canProceedWithClerkAuth } = await import("@/integrations/clerk/forms");
    await expect(canProceedWithClerkAuth()).resolves.toBe(false);
  });

  it("fails secure when flag evaluation errors", async () => {
    const { isClerkAuthEnabledFn } = await import("@/lib/feature-flags.functions");
    vi.mocked(isClerkAuthEnabledFn).mockRejectedValueOnce(new Error("network"));
    const { canProceedWithClerkAuth } = await import("@/integrations/clerk/forms");
    await expect(canProceedWithClerkAuth()).resolves.toBe(false);
  });
});
