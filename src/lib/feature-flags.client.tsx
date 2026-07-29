import { createContext, useContext, type ReactNode } from "react";
import { ConfigCatProvider, useFeatureFlag } from "configcat-react";
import {
  FEATURE_FLAGS,
  getCapabilityDefault,
  type Capabilities,
  type FeatureKey,
} from "@/lib/feature-flags";

const FlagProviderStateContext = createContext<{ enabled: boolean }>({ enabled: false });

function readClientSdkKey(): string | undefined {
  return (
    (typeof import.meta !== "undefined" &&
    import.meta.env &&
    "VITE_CONFIGCAT_SDK_KEY" in import.meta.env
      ? (import.meta.env.VITE_CONFIGCAT_SDK_KEY as string | undefined)
      : undefined) ||
    process.env.VITE_CONFIGCAT_SDK_KEY ||
    process.env.CONFIGCAT_SDK_KEY
  );
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const sdkKey = readClientSdkKey();
  if (!sdkKey) {
    return (
      <FlagProviderStateContext.Provider value={{ enabled: false }}>
        {children}
      </FlagProviderStateContext.Provider>
    );
  }

  return (
    <FlagProviderStateContext.Provider value={{ enabled: true }}>
      <ConfigCatProvider sdkKey={sdkKey}>{children}</ConfigCatProvider>
    </FlagProviderStateContext.Provider>
  );
}

export function useFlagSafe(
  key: FeatureKey,
  defaultValue = getCapabilityDefault(key),
): readonly [boolean, boolean] {
  const { enabled } = useContext(FlagProviderStateContext);
  // Always call the hook unconditionally to satisfy Rules of Hooks.
  const { value, loading } = useFeatureFlag(key, defaultValue);
  if (!enabled) return [defaultValue, false] as const;
  return [value, loading] as const;
}

/** Returns [isDashboardEnabled, loading]. */
export function useDashboardFlag(): readonly [boolean, boolean] {
  return useFlagSafe(FEATURE_FLAGS.dashboard);
}

export function useMaintenanceMode(): readonly [boolean, boolean] {
  return useFlagSafe(FEATURE_FLAGS.maintenanceMode);
}

/** Returns [isClerkAuthEnabled, loading]. Mirrors clerkAuthentication ConfigCat key. */
export function useClerkAuthFlag(): readonly [boolean, boolean] {
  return useFlagSafe(FEATURE_FLAGS.clerkAuthentication);
}

export function useAuthenticationButtonFlag(): readonly [boolean, boolean] {
  return useFlagSafe(FEATURE_FLAGS.authenticationButton);
}

export function toCapabilities(flags: Partial<Record<FeatureKey, boolean>>): Capabilities {
  return {
    clerkAuthentication:
      flags.clerkAuthentication ?? getCapabilityDefault(FEATURE_FLAGS.clerkAuthentication),
    dashboardEnabled: flags.dashboardEnabled ?? getCapabilityDefault(FEATURE_FLAGS.dashboard),
    employeePortalEnabled:
      flags.employeePortalEnabled ?? getCapabilityDefault(FEATURE_FLAGS.employeePortal),
    managerPortalEnabled:
      flags.managerPortalEnabled ?? getCapabilityDefault(FEATURE_FLAGS.managerPortal),
    hrPortalEnabled: flags.hrPortalEnabled ?? getCapabilityDefault(FEATURE_FLAGS.hrPortal),
    onboardingPortalEnabled:
      flags.onboardingPortalEnabled ?? getCapabilityDefault(FEATURE_FLAGS.onboardingPortal),
    documentUploadsEnabled:
      flags.documentUploadsEnabled ?? getCapabilityDefault(FEATURE_FLAGS.documentUploads),
    interviewSchedulingEnabled:
      flags.interviewSchedulingEnabled ?? getCapabilityDefault(FEATURE_FLAGS.interviewScheduling),
    offerManagementEnabled:
      flags.offerManagementEnabled ?? getCapabilityDefault(FEATURE_FLAGS.offerManagement),
    leaveManagementEnabled:
      flags.leaveManagementEnabled ?? getCapabilityDefault(FEATURE_FLAGS.leaveManagement),
    attendanceEnabled: flags.attendanceEnabled ?? getCapabilityDefault(FEATURE_FLAGS.attendance),
    timesheetsEnabled: flags.timesheetsEnabled ?? getCapabilityDefault(FEATURE_FLAGS.timesheets),
    payrollPortalEnabled:
      flags.payrollPortalEnabled ?? getCapabilityDefault(FEATURE_FLAGS.payrollPortal),
    referralsEnabled: flags.referralsEnabled ?? getCapabilityDefault(FEATURE_FLAGS.referrals),
    internalMobilityEnabled:
      flags.internalMobilityEnabled ?? getCapabilityDefault(FEATURE_FLAGS.internalMobility),
    advancedAnalyticsEnabled:
      flags.advancedAnalyticsEnabled ?? getCapabilityDefault(FEATURE_FLAGS.advancedAnalytics),
    maintenanceMode: flags.maintenanceMode ?? getCapabilityDefault(FEATURE_FLAGS.maintenanceMode),
    authenticationButtonEnabled:
      flags.authenticationButtonEnabled ?? getCapabilityDefault(FEATURE_FLAGS.authenticationButton),
  };
}
