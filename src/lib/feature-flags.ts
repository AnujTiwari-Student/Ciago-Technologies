// Single source of truth for kill-switch feature flags.
// Read at runtime; do not cache — the app must respond to a flag flip
// without a redeploy (except where noted in WORKFLOW.md / migration plan).
//
// `USE_CLERK_AUTH` directs the auth wiring: when false, the app continues
// to use the legacy Supabase-auth path; when true, the code routes through
// Clerk. Default is false so the migration is non-destructive.
//
// `USE_NEON_DB` directs the database client: when false, auth middleware
// uses Supabase client + GoTrue JWT; when true, uses Neon/Prisma + RLS
// via app.current_user_id. Requires USE_CLERK_AUTH=true.

export type FeatureFlags = {
  // When true, auth providers, server-fs middleware, and route guards use
  // Clerk wiring (src/integrations/clerk/*). When false, the original
  // Supabase path is used unchanged.
  USE_CLERK_AUTH: boolean;

  // When true, auth middleware uses Neon/Prisma instead of Supabase client.
  // Only effective when USE_CLERK_AUTH is also true.
  USE_NEON_DB: boolean;
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
  USE_NEON_DB: readFlag("USE_NEON_DB", false),
};

export const FEATURE_FLAGS = {
  // -- Authentication --------------------------------------------------------
  // ConfigCat key: clerkAuthentication (confirmed ON in ConfigCat dashboard)
  clerkAuthentication: "clerkAuthentication",
  authenticationButton: "authenticationButtonEnabled",
  // -- Dashboard -------------------------------------------------------------
  // Controls whether the authenticated dashboard UI surfaces are accessible.
  // When false, authenticated users are redirected to a maintenance/splash page.
  dashboard: "dashboardEnabled",
  // -- HR features -----------------------------------------------------------
  documentUploads: "documentUploadsEnabled",
  interviewScheduling: "interviewSchedulingEnabled",
  offerManagement: "offerManagementEnabled",
  // -- Analytics -------------------------------------------------------------
  advancedAnalytics: "advancedAnalyticsEnabled",
  // -- System ----------------------------------------------------------------
  maintenanceMode: "maintenanceMode",
  // -- Architecture Migration ------------------------------------------------
  newArchitecture: "new_architecture_enabled",
  // -- OrangeHRM Integration -------------------------------------------------
  essAutoProvisioning: "ess_auto_provisioning_enabled",
  orangehrmSalarySync: "orangehrm_salary_sync_enabled",
  orangehrmEmployeeSync: "orangehrm_employee_sync_enabled",
  // -- Frappe HR Integration -------------------------------------------------
  frappeEmployeeSync: "frappe_employee_sync_enabled",
  // -- Email -----------------------------------------------------------------
  resendEmailSending: "resend_email_sending_enabled",
  // -- Provisioning & Offboarding --------------------------------------------
  autoOffboardingTrigger: "auto_offboarding_trigger_enabled",
  // -- Background Verification -----------------------------------------------
  manualBackgroundVerificationOnly: "manual_background_verification_only",
} as const;

export type FeatureKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type Capabilities = Record<FeatureKey, boolean>;

export const DEFAULT_CAPABILITIES: Capabilities = {
  // Authentication
  clerkAuthentication: false,
  authenticationButtonEnabled: false,
  // Dashboard — on by default; flip off to show maintenance screen
  dashboardEnabled: true,
  // HR features
  documentUploadsEnabled: true,
  interviewSchedulingEnabled: true,
  offerManagementEnabled: true,
  // Analytics
  advancedAnalyticsEnabled: false,
  // System
  maintenanceMode: false,
  // Architecture Migration
  new_architecture_enabled: false,
  // OrangeHRM Integration
  ess_auto_provisioning_enabled: false,
  orangehrm_salary_sync_enabled: false,
  orangehrm_employee_sync_enabled: false,
  // Frappe HR Integration
  frappe_employee_sync_enabled: false,
  // Email
  resend_email_sending_enabled: false,
  // Provisioning & Offboarding
  auto_offboarding_trigger_enabled: false,
  // Background Verification
  manual_background_verification_only: false,
};

export const FEATURE_KEYS = Object.values(FEATURE_FLAGS) as FeatureKey[];

export function getCapabilityDefault(key: FeatureKey): boolean {
  return DEFAULT_CAPABILITIES[key];
}
