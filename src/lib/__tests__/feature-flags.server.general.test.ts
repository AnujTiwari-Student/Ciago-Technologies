import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockClient = {
  getValueAsync: <T>(key: string, defaultValue: T, user?: unknown) => Promise<T>;
  forceRefreshAsync: () => Promise<void>;
};

const getClientMock = vi.fn();

vi.mock("@configcat/sdk", () => ({
  PollingMode: { AutoPoll: "AutoPoll" },
  getClient: (...args: unknown[]) => getClientMock(...args),
}));

describe("feature-flags.server general behavior", () => {
  const oldEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    getClientMock.mockReset();
    process.env.CONFIGCAT_SERVER_SDK_KEY = "sdk-key";
  });

  afterEach(() => {
    process.env = { ...oldEnv };
  });

  it("evaluates dashboardEnabled using ConfigCat", async () => {
    const client: MockClient = {
      forceRefreshAsync: vi.fn(async () => {}),
      getValueAsync: async <T>(key: string, _defaultValue: T) => (key === "dashboardEnabled" ? false : true) as T,
    };
    getClientMock.mockReturnValue(client);

    const mod = await import("@/lib/feature-flags.server");
    await expect(mod.isDashboardEnabled()).resolves.toBe(false);
  });

  it("returns fallback values when ConfigCat evaluation throws", async () => {
    const client: MockClient = {
      forceRefreshAsync: vi.fn(async () => {}),
      getValueAsync: async () => {
        throw new Error("configcat unavailable");
      },
    };
    getClientMock.mockReturnValue(client);

    const mod = await import("@/lib/feature-flags.server");
    await expect(mod.isFlagOn("maintenanceMode", undefined, false)).resolves.toBe(false);
  });

  it("evaluates all feature keys via getAllFeatureFlags", async () => {
    const client: MockClient = {
      forceRefreshAsync: vi.fn(async () => {}),
      getValueAsync: async <T>(_key: string, defaultValue: T) => defaultValue,
    };
    getClientMock.mockReturnValue(client);

    const mod = await import("@/lib/feature-flags.server");
    const flags = await mod.getAllFeatureFlags();
    expect(flags).toHaveProperty("clerkAuthentication");
    expect(flags).toHaveProperty("dashboardEnabled");
    expect(flags).toHaveProperty("maintenanceMode");
  });

  it("returns a defensive clone of default capabilities", async () => {
    const mod = await import("@/lib/feature-flags.server");
    const a = mod.getDefaultCapabilities();
    const b = mod.getDefaultCapabilities();
    expect(a).not.toBe(b);
    a.dashboardEnabled = false;
    expect(b.dashboardEnabled).toBe(true);
  });
});
