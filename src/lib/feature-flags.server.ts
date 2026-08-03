import { getClient, PollingMode } from "@configcat/sdk";
import {
  DEFAULT_CAPABILITIES,
  FEATURE_KEYS,
  getCapabilityDefault,
  type Capabilities,
  type FeatureKey,
} from "@/lib/feature-flags";
import type { IUser } from "@configcat/sdk";

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

function toTargetUser(target?: FlagTargetContext): IUser | undefined {
  if (!target) return undefined;
  const identifier = target.identifier || target.email || "anonymous";
  if (!identifier && !target.custom && !target.role) return undefined;
  return {
    identifier: identifier,
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

async function isCriticalFlagOn(
  key: FeatureKey,
  target?: FlagTargetContext,
  defaultValue = getCapabilityDefault(key),
): Promise<boolean> {
  const client = getConfigCatClient();
  if (!client) return defaultValue;
  try {
    await client.forceRefreshAsync();
    return await client.getValueAsync<boolean>(key, defaultValue, toTargetUser(target));
  } catch (error) {
    console.error("[configcat] Critical flag evaluation failed", key, error);
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

/**
 * Authentication is security-critical. We force-refresh before evaluating it and
 * deny by default when evaluation fails.
 */
export async function isClerkAuthenticationEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isCriticalFlagOn("clerkAuthentication", target, DEFAULT_CAPABILITIES.clerkAuthentication);
}

/**
 * Controls whether unauthenticated visitors can enter the sign-in flow.
 * This is evaluated on the server so SSR never imports the browser-only
 * ConfigCat React provider.
 */
export async function isAuthenticationButtonEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn(
    "authenticationButtonEnabled",
    target,
    DEFAULT_CAPABILITIES.authenticationButtonEnabled,
  );
}

/**
 * Controls whether OrangeHRM employee creation + ESS account provisioning
 * happens automatically on hire.
 */
export async function isOrangeHRMProvisioningEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn(
    "ess_auto_provisioning_enabled",
    target,
    DEFAULT_CAPABILITIES.ess_auto_provisioning_enabled,
  );
}

/**
 * Controls whether salary is fetched from OrangeHRM API and shown in Employment tab.
 */
export async function isOrangeHRMSalarySyncEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn(
    "orangehrm_salary_sync_enabled",
    target,
    DEFAULT_CAPABILITIES.orangehrm_salary_sync_enabled,
  );
}

/**
 * Controls whether emails are actually sent via Resend API.
 * When false, emails are logged but not sent.
 */
export async function isResendEmailEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn(
    "resend_email_sending_enabled",
    target,
    DEFAULT_CAPABILITIES.resend_email_sending_enabled,
  );
}

/**
 * Controls whether automatic offboarding is triggered on last_working_day.
 * When false, offboarding must be done manually.
 */
export async function isAutoOffboardingEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn(
    "auto_offboarding_trigger_enabled",
    target,
    DEFAULT_CAPABILITIES.auto_offboarding_trigger_enabled,
  );
}

/**
 * Controls whether OrangeHRM employee is automatically created at APPLIED state.
 * When false, no OrangeHRM provisioning occurs at APPLIED.
 * When true, APPLIED status transition triggers employee creation in OrangeHRM.
 */
export async function isOrangeHRMEmployeeSyncEnabled(target?: FlagTargetContext): Promise<boolean> {
  return isFlagOn(
    "orangehrm_employee_sync_enabled",
    target,
    DEFAULT_CAPABILITIES.orangehrm_employee_sync_enabled,
  );
}

/**
 * Controls whether Frappe HR employee is automatically created at APPLIED state.
 * When false, no Frappe provisioning occurs at APPLIED.
 * When true, APPLIED status transition triggers employee creation in Frappe HR.
 * Independent of OrangeHRM flag - both can be enabled for parallel testing.
 * DEFAULT: false (must be explicitly enabled)
 *
 * Priority: 1) Environment variable FRAPPE_EMPLOYEE_SYNC_ENABLED
 *           2) ConfigCat flag frappe_employee_sync_enabled
 *           3) Default false
 */
export async function isFrappeEmployeeSyncEnabled(target?: FlagTargetContext): Promise<boolean> {
  // Allow environment variable override for development validation
  // This is critical for testing before ConfigCat flag is registered
  const envOverride = process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED;
  if (envOverride === "true") {
    return true;
  }
  if (envOverride === "false") {
    return false;
  }

  // Fall back to ConfigCat
  return isFlagOn(
    "frappe_employee_sync_enabled",
    target,
    DEFAULT_CAPABILITIES.frappe_employee_sync_enabled,
  );
}
