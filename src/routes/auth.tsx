import { createFileRoute, useNavigate, useSearch, Link, redirect } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { FLAGS } from "@/lib/feature-flags";

const supabase = null as any;
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";
import { FORBIDDEN_CORPORATE_ERROR, STAFF_ON_CANDIDATE_ERROR } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: ({ context }) => {
    if (!context.authButtonEnabled) {
      throw redirect({ to: "/forbidden", search: { reason: "authentication_button_disabled" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign In — Ciago Technologies" },
      {
        name: "description",
        content:
          "Sign in to track applications or access the Ciago Technologies admin dashboard.",
      },
      { property: "og:title", content: "Sign In — Ciago Technologies" },
      {
        property: "og:description",
        content: "Candidate and employee sign-in for Ciago Technologies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function safePath(p?: string): string {
  if (!p) return "/";
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}

type Portal = "candidate" | "employee";

// OAuth providers supported in the legacy branch (Supabase broker) and the
// Clerk branch (Clerk's signIn.authenticateWithRedirect strategy map).
// Supabase's broker supports google / apple / github / microsoft; Clerk
// supports oauth_google / oauth_apple / oauth_github / oauth_microsoft.
// Adding a provider here requires the matching strategy hookup in
// forms.tsx's ClerkSocialButton and the legacy OAuth provider be enabled
// in the Supabase Authentication dashboard.
type SocialProvider = "google" | "apple" | "github";

// Maps our SocialProvider literal to the Clerk strategy constant
// expected by signIn.authenticateWithRedirect({ strategy }).
const CLERK_STRATEGY: Record<SocialProvider, string> = {
  google: "oauth_google",
  apple: "oauth_apple",
  github: "oauth_github",
};

// ---------------------------------------------------------------------------
// Legacy client-side resolver — kept verbatim for the flag-off path so the
// Supabase-backed sign-in continues to land on the exact same destination
// as before.
// ---------------------------------------------------------------------------
async function resolvePostLoginDestination(portal: Portal, requested: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return requested;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
  const isStaff =
    roleSet.has("employee") || roleSet.has("manager") || roleSet.has("admin") || roleSet.has("hr");

  if (portal === "employee") {
    if (!isStaff) {
      await supabase.auth.signOut();
      throw new Error("__FORBIDDEN_CORPORATE__");
    }
    if (roleSet.has("admin")) return "/admin";
    return "/my-applications";
  }
  if (isStaff) {
    await supabase.auth.signOut();
    throw new Error("__STAFF_ON_CANDIDATE__");
  }
  if (requested === "/") return "/my-applications";
  return requested;
}

function handlePortalError(err: unknown, navigate: ReturnType<typeof useNavigate>) {
  const msg = (err as { message?: string })?.message ?? "";
  if (msg === FORBIDDEN_CORPORATE_ERROR) {
    toast.error("Corporate Login is restricted to Ciago Technologies staff.");
    navigate({ to: "/forbidden", search: { reason: "corporate" } });
  } else if (msg === STAFF_ON_CANDIDATE_ERROR) {
    toast.error("Account active on Corporate Gateway. Please log in via Staff Login.");
  } else {
    toast.error(msg || "Sign-in blocked.");
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user, loading, signOut } = useAuth();
  const redirectTo = safePath(search.redirect);
  const [clerkAuthEnabled, setClerkAuthEnabled] = useState(!FLAGS.USE_CLERK_AUTH);
  const [clerkAuthLoading, setClerkAuthLoading] = useState(FLAGS.USE_CLERK_AUTH);
  const disabledSignOutAttemptedRef = useRef(false);

  useEffect(() => {
    if (!FLAGS.USE_CLERK_AUTH) return;
    let cancelled = false;
    (async () => {
      try {
        const enabled = await isClerkAuthEnabledFn();
        if (!cancelled) setClerkAuthEnabled(enabled);
      } catch (error) {
        console.error("[auth] Failed to evaluate clerkAuthentication flag", error);
        if (!cancelled) setClerkAuthEnabled(false);
      } finally {
        if (!cancelled) setClerkAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!FLAGS.USE_CLERK_AUTH) {
      if (user) navigate({ to: redirectTo });
      return;
    }
    if (clerkAuthLoading) return;
    if (!clerkAuthEnabled) {
      if (user && !disabledSignOutAttemptedRef.current) {
        disabledSignOutAttemptedRef.current = true;
        void signOut().catch((error) => {
          console.error("[auth] Clerk sign-out failed while auth was disabled", error);
        });
      }
      return;
    }
    if (user) navigate({ to: redirectTo });
  }, [loading, user, navigate, redirectTo, clerkAuthEnabled, clerkAuthLoading, signOut]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:py-24">
        <h1 className="text-3xl font-black tracking-tight">Welcome to Ciago</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Choose how you're signing in.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="mb-4 text-xs text-muted-foreground">
            Sign in to access your account
          </p>
          <CandidateForms
            redirectTo={redirectTo}
            clerkAuthEnabled={clerkAuthEnabled}
            clerkAuthLoading={clerkAuthLoading}
          />

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or continue with{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <SocialButton
            provider="google"
            label="Continue with Google"
            clerkAuthEnabled={clerkAuthEnabled}
            clerkAuthLoading={clerkAuthLoading}
          />
          <div className="h-2" />
          <SocialButton
            provider="apple"
            label="Continue with Apple"
            clerkAuthEnabled={clerkAuthEnabled}
            clerkAuthLoading={clerkAuthLoading}
          />
          <div className="h-2" />
          <SocialButton
            provider="github"
            label="Continue with GitHub"
            clerkAuthEnabled={clerkAuthEnabled}
            clerkAuthLoading={clerkAuthLoading}
          />
          {FLAGS.USE_CLERK_AUTH && !clerkAuthLoading && !clerkAuthEnabled ? (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              Authentication is currently disabled by feature flag. Please contact support.
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline hover:text-brand">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-brand">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch dispatcher — Clerk-form code is split into a separate component
// that is only mounted when the flag is on. Clerk React hooks can only be
// called inside a component rendered under <ClerkProvider> (mounted by
// Step 6's boundary). Mounting the Clerk-form component only when the flag
// is on (and gating the rest via the boundary) means:
//   - Hooks correctly conditional without violating rules of hooks.
//   - The Clerk React SDK never enters the bundle when the flag is off
//     (the Clerk fragment is lazy-loaded, see `ClerkFormsLazy`).
// ---------------------------------------------------------------------------

function CandidateForms({
  redirectTo,
  clerkAuthEnabled,
  clerkAuthLoading,
}: {
  redirectTo: string;
  clerkAuthEnabled: boolean;
  clerkAuthLoading: boolean;
}) {
  if (!FLAGS.USE_CLERK_AUTH) {
    return <LegacyCandidateForms redirectTo={redirectTo} />;
  }
  if (clerkAuthLoading) return <FormsSkeleton />;
  if (!clerkAuthEnabled) return <AuthDisabledCard />;
  return (
    <Suspense fallback={<FormsSkeleton />}>
      <ClerkCandidateForms redirectTo={redirectTo} />
    </Suspense>
  );
}

function EmployeeSignIn({
  redirectTo,
  clerkAuthEnabled,
  clerkAuthLoading,
}: {
  redirectTo: string;
  clerkAuthEnabled: boolean;
  clerkAuthLoading: boolean;
}) {
  if (!FLAGS.USE_CLERK_AUTH) return <LegacyEmployeeSignIn redirectTo={redirectTo} />;
  if (clerkAuthLoading) return <FormsSkeleton />;
  if (!clerkAuthEnabled) return <AuthDisabledCard />;
  return (
    <Suspense fallback={<FormsSkeleton />}>
      <ClerkEmployeeSignIn redirectTo={redirectTo} />
    </Suspense>
  );
}

// Lazy-load the Clerk-enabled form bundle. This is the single point that
// pulls `@clerk/tanstack-react-start` into the client bundle; when the flag is
// off, the dynamic import never runs and the bundle stays small.
const ClerkFormsLazy = lazy(async () => {
  const mod = await import("@/integrations/clerk/forms");
  return { default: mod.ClerkForms };
});

function ClerkCandidateForms({ redirectTo }: { redirectTo: string }) {
  return <ClerkFormsLazy variant="candidate" redirectTo={redirectTo} />;
}

function ClerkEmployeeSignIn({ redirectTo }: { redirectTo: string }) {
  return <ClerkFormsLazy variant="employee-portal" redirectTo={redirectTo} />;
}

// ---------------------------------------------------------------------------
// Legacy branch — preserved byte-equivalent to pre-Step-10 behaviour.
// ---------------------------------------------------------------------------

function LegacyCandidateForms({ redirectTo }: { redirectTo: string }) {
  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Sign up</TabsTrigger>
      </TabsList>
      <TabsContent value="signin" className="mt-6">
        <LegacySignInForm portal="candidate" redirectTo={redirectTo} />
      </TabsContent>
      <TabsContent value="signup" className="mt-6">
        <LegacySignUpForm redirectTo={redirectTo} />
      </TabsContent>
    </Tabs>
  );
}

function LegacyEmployeeSignIn({ redirectTo }: { redirectTo: string }) {
  return <LegacySignInForm portal="employee" redirectTo={redirectTo} />;
}

function LegacySignInForm({ portal, redirectTo }: { portal: Portal; redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      const dest = await resolvePostLoginDestination(portal, redirectTo);
      toast.success("Signed in.");
      navigate({ to: dest });
    } catch (err) {
      handlePortalError(err, navigate);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${portal}-email`}>
          {portal === "employee" ? "Corporate email" : "Email"}
        </Label>
        <Input
          id={`${portal}-email`}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${portal}-password`}>Password</Label>
        <Input
          id={`${portal}-password`}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
      >
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function LegacySignUpForm({ redirectTo }: { redirectTo: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${redirectTo}`,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can apply now.");
    navigate({ to: redirectTo === "/" ? "/my-applications" : redirectTo });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="su-name">Full name</Label>
        <Input
          id="su-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input
          id="su-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password">Password</Label>
        <Input
          id="su-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
      >
        {busy ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Social auth — flag-aware button using the same Clerk branch dispatcher.
// ---------------------------------------------------------------------------
function SocialButton({
  provider,
  label,
  clerkAuthEnabled,
  clerkAuthLoading,
}: {
  provider: SocialProvider;
  label: string;
  clerkAuthEnabled: boolean;
  clerkAuthLoading: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!FLAGS.USE_CLERK_AUTH) {
    return <LegacySocialButton provider={provider} label={label} setBusy={setBusy} busy={busy} />;
  }
  if (clerkAuthLoading) return <ButtonSkeleton label={label} />;
  if (!clerkAuthEnabled) {
    return (
      <Button type="button" variant="outline" disabled className="w-full justify-center">
        {label}
      </Button>
    );
  }
  return (
    <Suspense fallback={<ButtonSkeleton label={label} />}>
      <ClerkSocialButton provider={provider} label={label} setBusy={setBusy} busy={busy} />
    </Suspense>
  );
}

function LegacySocialButton({
  provider,
  label,
  busy,
  setBusy,
}: {
  provider: SocialProvider;
  label: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  async function onClick() {
    setBusy(true);
    // Supabase OAuth direct — supabase.auth.signInWithOAuth redirects the
    // browser to the provider, which returns to `redirectTo` after consent.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message || "Sign-in failed");
    }
    // On success the browser is redirected off-site to the OAuth provider;
    // we just leave `busy=true` while the page navigates away.
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      className="w-full justify-center"
    >
      {busy ? "Opening…" : label}
    </Button>
  );
}

// Re-uses the same lazy fragment so Clerk React SDK hooks are reachable.
function ClerkSocialButton({
  provider,
  label,
  busy,
  setBusy,
}: {
  provider: SocialProvider;
  label: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  // Importing here would call React hooks; instead delegate via the lazy
  // forms fragment which contains the actual Clerk social handler.
  return (
    <ClerkFormsLazy
      variant="social"
      redirectTo=""
      provider={provider}
      label={label}
      busy={busy}
      setBusy={setBusy}
    />
  );
}

// ---------------------------------------------------------------------------
// Suspense fallbacks for the lazy-loaded Clerk fragments.
// ---------------------------------------------------------------------------
function FormsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-9 rounded-md bg-muted/50" />
      <div className="h-9 rounded-md bg-muted/50" />
      <div className="h-9 rounded-md bg-brand/40" />
    </div>
  );
}

function ButtonSkeleton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" disabled className="w-full justify-center">
      {label}
    </Button>
  );
}

function AuthDisabledCard() {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
      Authentication is currently disabled by feature flag.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoc helpers — kept exported for tests/manual inspection.
// ---------------------------------------------------------------------------
