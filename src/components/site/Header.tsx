import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LogIn,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import { useAuth, displayName } from "@/lib/auth";
import { NotificationBell } from "@/components/site/NotificationBell";
import { useMyRoles } from "@/hooks/use-my-roles";
import { Route as RootRoute } from "@/routes/__root";

type NavItem = {
  label: string;
  to: string;
  search?: Record<string, unknown>;
};

export const publicNavItems: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "What we do", to: "/what-we-do" },
  { label: "What we think", to: "/what-we-think" },
  { label: "About Us", to: "/about-us" },
  { label: "Careers", to: "/careers" },
  { label: "Resources", to: "/resources" },
];

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", to: "/admin" },
  { label: "Applications", to: "/admin", search: { tab: "applications" } },
  { label: "By Job", to: "/admin", search: { tab: "by-role" } },
  { label: "Job Postings", to: "/admin", search: { tab: "postings" } },
  { label: "Users", to: "/admin", search: { tab: "users" } },
  { label: "Audit Logs", to: "/admin", search: { tab: "audit" } },
  { label: "Profile", to: "/admin", search: { tab: "profile" } },
];

export const navItems = publicNavItems;

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className="rounded-full"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

export function BrandLogo({ className = "h-14 w-auto sm:h-16" }: { className?: string }) {
  return (
    <>
      <img
        src="/logo-light.svg"
        alt="Ciago Technologies"
        className={`${className} block dark:hidden`}
      />
      <img
        src="/logo-dark.svg"
        alt="Ciago Technologies"
        className={`${className} hidden dark:block`}
      />
    </>
  );
}

function AuthMenu({
  isAdmin,
  isHr,
  isManager,
  isEmployee,
  authButtonEnabled,
}: {
  isAdmin: boolean;
  isHr: boolean;
  isManager: boolean;
  isEmployee: boolean;
  authButtonEnabled: boolean;
}) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) {
    if (!authButtonEnabled) return null;
    return (
      <Link
        to="/auth"
        className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:border-brand hover:text-brand sm:inline-flex"
      >
        <LogIn className="h-4 w-4" />
        Sign in
      </Link>
    );
  }
  const label = displayName(user);
  const isStaff = isAdmin || isHr || isManager || isEmployee;

  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/15 text-brand">
              <UserIcon className="h-4 w-4" />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate text-xs text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-medium">{label || user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isAdmin && (
            <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
              <ShieldCheck className="mr-2 h-4 w-4 text-brand" />
              Admin Portal
            </DropdownMenuItem>
          )}
          {!isStaff && (
            <>
              <DropdownMenuItem onClick={() => navigate({ to: "/my-applications" })}>
                My applications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/careers" })}>
                Open roles
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
            <Settings className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { authButtonEnabled } = RootRoute.useRouteContext();
  const { user } = useAuth();
  const { isAdmin, isDashboardUser } = useMyRoles();

  const items: NavItem[] = isDashboardUser ? adminNavItems : publicNavItems;
  const homeHref = isDashboardUser ? "/admin" : "/";
  const isStaff = isDashboardUser;

  return (
    <header className="glass-nav sticky top-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to={homeHref}
          className="flex min-w-0 items-center gap-2"
          aria-label="Ciago Technologies — Home"
        >
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {items.map((item) => {
            const key = `${item.to}${item.search ? `?${JSON.stringify(item.search)}` : ""}`;
            return (
              <Link
                key={key}
                to={item.to}
                {...(item.search ? { search: item.search } : {})}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                activeOptions={{ exact: true, includeSearch: !!item.search }}
                activeProps={{ className: "text-brand", "aria-current": "page" }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <AuthMenu
            isAdmin={isAdmin}
            isHr={false}
            isManager={false}
            isEmployee={false}
            authButtonEnabled={authButtonEnabled}
          />
          {!isStaff && (
            <Link
              to="/careers"
              className="hidden rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-colors hover:bg-brand-glow sm:inline-flex"
            >
              Join Us
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {items.map((item) => {
              const key = `${item.to}${item.search ? `?${JSON.stringify(item.search)}` : ""}`;
              return (
                <Link
                  key={key}
                  to={item.to}
                  {...(item.search ? { search: item.search } : {})}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent"
                  activeOptions={{ exact: true, includeSearch: !!item.search }}
                  activeProps={{ className: "text-brand", "aria-current": "page" }}
                >
                  {item.label}
                </Link>
              );
            })}

            {!user && authButtonEnabled && (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground/80 hover:border-brand hover:text-brand"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
