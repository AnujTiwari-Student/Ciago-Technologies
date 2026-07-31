// Pure role-based access matrix. Mirrors the guards enforced by route files
// so we can unit-test which surfaces each role is allowed to see.

export type AppRole = "user" | "admin";

export type Surface =
  | "public"
  | "careers"
  | "my-applications"
  | "onboarding"
  | "admin";

export function canAccess(role: AppRole | null | undefined, surface: Surface): boolean {
  const r = role ?? "user";
  switch (surface) {
    case "public":
    case "careers":
    case "my-applications":
    case "onboarding":
      return true;
    case "admin":
      return r === "admin";
    default:
      return false;
  }
}

export function shouldShowOnboardingBanner(role: AppRole | null | undefined): boolean {
  return (role ?? "user") === "user";
}
