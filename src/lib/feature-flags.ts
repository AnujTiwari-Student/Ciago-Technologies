// Single source of truth for kill-switch feature flags.
// Read at runtime; do not cache — the app must respond to a flag flip
// without a redeploy (except where noted in WORKFLOW.md / migration plan).
//
// `USE_CLERK_AUTH` directs the auth wiring: when false, the app continues
// to use the legacy Supabase-auth path; when true, the code routes through
// Clerk. Default is false so the migration is non-destructive.

export type FeatureFlags = {
  // When true, auth providers, server-fs middleware, and route guards use
  // Clerk wiring (src/integrations/clerk/*). When false, the original
  // Supabase path is used unchanged.
  USE_CLERK_AUTH: boolean;
};

function readFlag(name: keyof FeatureFlags, fallback: boolean): boolean {
  // Vite build-time replacement for the client bundle.
  const viteRaw =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as unknown as Record<string, string | undefined>)[`VITE_${String(name)}`]
      : undefined;
  // SSR / server bundle fallback.
  const procRaw =
    typeof process !== "undefined" && process.env
      ? (process.env as unknown as Record<string, string | undefined>)[String(name)]
      : undefined;
  const raw = viteRaw ?? procRaw;
  if (raw === undefined) return fallback;
  return raw === "1" || raw === "true";
}

export const FLAGS: FeatureFlags = {
  USE_CLERK_AUTH: readFlag("USE_CLERK_AUTH", false),
};

export const FEATURE_FLAGS = {
  // -- Authentication --------------------------------------------------------
  // ConfigCat key: clerkAuthentication (confirmed ON in ConfigCat dashboard)
  clerkAuthentication: "clerkAuthentication",
  // -- Dashboard -------------------------------------------------------------
  // Controls whether the authenticated dashboard UI surfaces are accessible.
  // When false, authenticated users are redirected to a maintenance/splash page.
  dashboard: "dashboardEnabled",
  // -- Employee portals ------------------------------------------------------
  employeePortal: "employeePortalEnabled",
  managerPortal: "managerPortalEnabled",
  hrPortal: "hrPortalEnabled",
  onboardingPortal: "onboardingPortalEnabled",
  // -- HR features -----------------------------------------------------------
  documentUploads: "documentUploadsEnabled",
  interviewScheduling: "interviewSchedulingEnabled",
  offerManagement: "offerManagementEnabled",
  // -- Employee self-service -------------------------------------------------
  leaveManagement: "leaveManagementEnabled",
  attendance: "attendanceEnabled",
  timesheets: "timesheetsEnabled",
  payrollPortal: "payrollPortalEnabled",
  referrals: "referralsEnabled",
  internalMobility: "internalMobilityEnabled",
  // -- Analytics -------------------------------------------------------------
  advancedAnalytics: "advancedAnalyticsEnabled",
  // -- System ----------------------------------------------------------------
  maintenanceMode: "maintenanceMode",
} as const;

export type FeatureKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type Capabilities = Record<FeatureKey, boolean>;

export const DEFAULT_CAPABILITIES: Capabilities = {
  // Authentication
  clerkAuthentication: false,
  // Dashboard — on by default; flip off to show maintenance screen
  dashboardEnabled: true,
  // Portals
  employeePortalEnabled: true,
  managerPortalEnabled: true,
  hrPortalEnabled: true,
  onboardingPortalEnabled: true,
  // HR features
  documentUploadsEnabled: true,
  interviewSchedulingEnabled: true,
  offerManagementEnabled: true,
  // Employee self-service
  leaveManagementEnabled: true,
  attendanceEnabled: true,
  timesheetsEnabled: true,
  payrollPortalEnabled: true,
  referralsEnabled: true,
  internalMobilityEnabled: true,
  // Analytics
  advancedAnalyticsEnabled: false,
  // System
  maintenanceMode: false,
};

export const FEATURE_KEYS = Object.values(FEATURE_FLAGS) as FeatureKey[];

export function getCapabilityDefault(key: FeatureKey): boolean {
  return DEFAULT_CAPABILITIES[key];
}
