// Pure role-based access matrix. Mirrors the guards enforced by route files
// so we can unit-test which surfaces each role is allowed to see.

export type AppRole = "user" | "employee" | "manager" | "hr" | "admin";

export type Surface =
  | "public"
  | "careers"
  | "my-applications"
  | "onboarding"
  | "employee"
  | "manager"
  | "hr"
  | "admin";

const RANK: Record<AppRole, number> = {
  user: 0,
  employee: 1,
  manager: 2,
  hr: 3,
  admin: 4,
};

export function canAccess(role: AppRole | null | undefined, surface: Surface): boolean {
  const r = role ?? "user";
  switch (surface) {
    case "public":
    case "careers":
    case "my-applications":
    case "onboarding":
      return true; // any authenticated (or public) user, per current route rules
    case "employee":
      return RANK[r] >= RANK.employee;
    case "manager":
      return RANK[r] >= RANK.manager;
    case "hr":
      return r === "hr" || r === "admin";
    case "admin":
      return r === "admin";
    default:
      return false;
  }
}

/** Whether the onboarding banner should be shown to a role. */
export function shouldShowOnboardingBanner(role: AppRole | null | undefined): boolean {
  return (role ?? "user") === "user";
}
