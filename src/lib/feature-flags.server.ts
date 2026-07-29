import { getClient, PollingMode } from "@configcat/sdk";
import {
  DEFAULT_CAPABILITIES,
  FEATURE_KEYS,
  getCapabilityDefault,
  type Capabilities,
  type FeatureKey,
} from "@/lib/feature-flags";

type FlagTargetContext = {
  identifier?: string;
  email?: string;
  role?: string;
  custom?: Record<string, string | number | boolean>;
};

let clientSingleton: ReturnType<typeof getClient> | null | undefined;

function readServerSdkKey(): string | undefined {
  return (
    process.env.CONFIGCAT_SERVER_SDK_KEY ||
    process.env.CONFIGCAT_SDK_KEY ||
    process.env.VITE_CONFIGCAT_SDK_KEY
  );
}

export function getConfigCatClient(): ReturnType<typeof getClient> | null {
  if (clientSingleton !== undefined) return clientSingleton;
  const sdkKey = readServerSdkKey();
  if (!sdkKey) {
    console.warn(
      "[configcat] Missing CONFIGCAT_SERVER_SDK_KEY/CONFIGCAT_SDK_KEY. Falling back to default flag values.",
    );
    clientSingleton = null;
    return clientSingleton;
  }
  clientSingleton = getClient(sdkKey, PollingMode.AutoPoll, { pollIntervalSeconds: 60 });
  return clientSingleton;
}

function toTargetUser(target?: FlagTargetContext): Record<string, unknown> | undefined {
  if (!target) return undefined;
  const identifier = target.identifier || target.email;
  if (!identifier && !target.custom && !target.role) return undefined;
  return {
    identifier: identifier ?? "anonymous",
    email: target.email,
    custom: {
      ...(target.custom ?? {}),
      ...(target.role ? { role: target.role } : {}),
    },
  };
}

export async function isFlagOn(
  key: FeatureKey,
  target?: FlagTargetContext,
  defaultValue = getCapabilityDefault(key),
): Promise<boolean> {
  const client = getConfigCatClient();
  if (!client) return defaultValue;
  try {
    return await client.getValueAsync<boolean>(key, defaultValue, toTargetUser(target));
  } catch (error) {
    console.error("[configcat] Flag evaluation failed", key, error);
    return defaultValue;
  }
}

export async function getAllFeatureFlags(target?: FlagTargetContext): Promise<Capabilities> {
  const entries = await Promise.all(
    FEATURE_KEYS.map(async (key) => [key, await isFlagOn(key, target)] as const),
  );
  return Object.fromEntries(entries) as Capabilities;
}

export function getDefaultCapabilities(): Capabilities {
  return { ...DEFAULT_CAPABILITIES };
}

/**
 * Returns true when the dashboard is enabled for the given target.
 * Used by route guards and server actions to gate dashboard access.
 */
export async function isDashboardEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn("dashboardEnabled", target, DEFAULT_CAPABILITIES.dashboardEnabled);
}
