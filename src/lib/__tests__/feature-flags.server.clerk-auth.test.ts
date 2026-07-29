import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockClient = {
  forceRefreshAsync: () => Promise<void>;
  getValueAsync: <T>(key: string, defaultValue: T, user?: unknown) => Promise<T>;
};

const getClientMock = vi.fn();

vi.mock("@configcat/sdk", () => ({
  PollingMode: { AutoPoll: "AutoPoll" },
  getClient: (...args: unknown[]) => getClientMock(...args),
}));

describe("isClerkAuthenticationEnabled", () => {
  const oldEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    getClientMock.mockReset();
    process.env.CONFIGCAT_SERVER_SDK_KEY = "sdk-key";
  });

  afterEach(() => {
    process.env = { ...oldEnv };
  });

  it("returns true when clerkAuthentication flag is enabled", async () => {
    const client: MockClient = {
      forceRefreshAsync: vi.fn(async () => {}),
      getValueAsync: async <T>(_key: string, _defaultValue: T) => true as T,
    };
    getClientMock.mockReturnValue(client);
    const mod = await import("@/lib/feature-flags.server");
    await expect(mod.isClerkAuthenticationEnabled()).resolves.toBe(true);
  });

  it("returns false when clerkAuthentication flag is disabled", async () => {
    const client: MockClient = {
      forceRefreshAsync: vi.fn(async () => {}),
      getValueAsync: async <T>(_key: string, _defaultValue: T) => false as T,
    };
    getClientMock.mockReturnValue(client);
    const mod = await import("@/lib/feature-flags.server");
    await expect(mod.isClerkAuthenticationEnabled()).resolves.toBe(false);
  });

  it("falls back to secure default when SDK key is missing", async () => {
    delete process.env.CONFIGCAT_SERVER_SDK_KEY;
    delete process.env.CONFIGCAT_SDK_KEY;
    delete process.env.VITE_CONFIGCAT_SDK_KEY;
    const mod = await import("@/lib/feature-flags.server");
    await expect(mod.isClerkAuthenticationEnabled()).resolves.toBe(false);
  });

  it("fails securely when SDK refresh/evaluation throws", async () => {
    const client: MockClient = {
      forceRefreshAsync: vi.fn(async () => {
        throw new Error("refresh failed");
      }),
      getValueAsync: async <T>(_key: string, _defaultValue: T) => true as T,
    };
    getClientMock.mockReturnValue(client);
    const mod = await import("@/lib/feature-flags.server");
    await expect(mod.isClerkAuthenticationEnabled()).resolves.toBe(false);
  });
});
