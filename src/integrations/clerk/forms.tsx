// Clerk-backed auth form components — lazily imported from src/routes/auth.tsx.
//
// Why a separate file lazily imported: Clerk's React hooks
// (useSignIn/useSignUp/useClerk) can only be called from components rendered
// *inside* <ClerkProvider>. Step 6's ClerkProviderBoundary mounts that
// provider when the flag is on, and Step 10's auth.tsx only imports this
// file when the flag is on. So:
//   - Flag off: this file's code never runs, the import path is never
//     evaluated, and `@clerk/tanstack-react-start` stays out of the client bundle
//     (verified via the Step 6 boundary).
//   - Flag on: this file loads eagerly within the Clerk fragment chunk. The
//     Clerk React SDK is already mounted by the boundary, so all hooks resolve
//     against the live Clerk context.
//
// All visual UI is identical to the legacy forms — same input fields, same
// labels, same submit-button labels. Only the action handlers swap from
// `supabase.auth.signInWithPassword` to `signIn.create({ identifier, password })`
// plus `setActive`.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSignIn, useSignUp } from "@clerk/tanstack-react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  resolveMyPortal,
  FORBIDDEN_CORPORATE_ERROR,
  STAFF_ON_CANDIDATE_ERROR,
} from "@/lib/portal.functions";

type Portal = "candidate" | "employee";

type SocialProvider = "google" | "apple" | "github";

// Maps our SocialProvider literal to the Clerk strategy constant
// expected by signIn.authenticateWithRedirect({ strategy }).
const CLERK_STRATEGY: Record<SocialProvider, string> = {
  google: "oauth_google",
  apple: "oauth_apple",
  github: "oauth_github",
};



// Public surface that auth.tsx imports as `ClerkForms`.
export function ClerkForms({
  variant,
  redirectTo,
  provider,
  label,
  busy,
  setBusy,
}: {
  variant: "candidate" | "employee-portal" | "social";
  redirectTo: string;
  provider?: SocialProvider;
  label?: string;
  busy?: boolean;
  setBusy?: (v: boolean) => void;
}) {
  if (variant === "candidate") return <ClerkCandidateForms redirectTo={redirectTo} />;
  if (variant === "employee-portal") return <ClerkEmployeeSignIn redirectTo={redirectTo} />;
  if (variant === "social") {
    return (
      <ClerkSocialButton
        provider={provider ?? "google"}
        label={label ?? ""}
        busy={!!busy}
        setBusy={setBusy ?? (() => {})}
      />
    );
  }
  return null;
}

function ClerkCandidateForms({ redirectTo }: { redirectTo: string }) {
  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Sign up</TabsTrigger>
      </TabsList>
      <TabsContent value="signin" className="mt-6">
        <ClerkSignInForm portal="candidate" redirectTo={redirectTo} />
      </TabsContent>
      <TabsContent value="signup" className="mt-6">
        <ClerkSignUpForm redirectTo={redirectTo} />
      </TabsContent>
    </Tabs>
  );
}

function ClerkEmployeeSignIn({ redirectTo }: { redirectTo: string }) {
  return <ClerkSignInForm portal="employee" redirectTo={redirectTo} />;
}

function ClerkSignInForm({ portal, redirectTo }: { portal: Portal; redirectTo: string }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) {
      // Don't surface this as a user error — Clerk's SDK is still hydrating.
      // Disable interactions and wait for the next render.
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      const sessionId = result?.createdSessionId;
      if (!sessionId) {
        setBusy(false);
        return toast.error("Sign-in incomplete — MFA / verification required.");
      }
      await setActive?.({ session: sessionId });
      const dest = await resolveMyPortal({ data: { portal, requested: redirectTo } });
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
        disabled={busy || !isLoaded}
        className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
      >
        {busy ? "Signing in…" : !isLoaded ? "Loading…" : portal === "employee" ? "Sign in to Employee Portal" : "Sign in"}
      </Button>
    </form>
  );
}

function ClerkSignUpForm({ redirectTo }: { redirectTo: string }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (!isLoaded || !signUp) return; // wait for SDK hydration
    setBusy(true);
    try {
      const firstSpace = name.indexOf(" ");
      const firstName = firstSpace === -1 ? name : name.slice(0, firstSpace);
      const result = await signUp.create({ emailAddress: email, password, firstName });
      const sessionId = result?.createdSessionId;
      if (!sessionId) {
        setBusy(false);
        // Clerk sign-up often requires email verification before session can be activated.
        return toast.success("Check your inbox to confirm your email, then sign in.");
      }
      await setActive?.({ session: sessionId });
      const dest = await resolveMyPortal({
        data: { portal: "candidate", requested: redirectTo === "/" ? "/" : redirectTo },
      });
      toast.success("Account created. You can apply now.");
      navigate({ to: dest });
    } catch (err) {
      const msg =
        (err as { errors?: Array<{ message?: string }>; message?: string })?.errors?.[0]?.message ??
        (err as { message?: string })?.message ??
        "Sign-up blocked.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
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
        disabled={busy || !isLoaded}
        className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
      >
        {busy ? "Creating…" : !isLoaded ? "Loading…" : "Create account"}
      </Button>
    </form>
  );
}

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
  const { isLoaded, signIn } = useSignIn();
  const sdkReady = isLoaded && !!signIn;
  async function onClick() {
    if (!isLoaded || !signIn) {
      // Clerk SDK is still hydrating. The button itself will re-render
      // with `disabled` once isLoaded flips; for now skip the click.
      return;
    }
    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: CLERK_STRATEGY[provider],
        redirectUrl: `${window.location.origin}/auth?clerk_redirect=1`,
        redirectUrlComplete: `${window.location.origin}/auth?clerk_redirect=complete`,
      });
      // The browser will follow the OAuth redirect; we don't need to do
      // anything else here. After successful OAuth, Clerk auto-activates the
      // session and the AuthPage useEffect navigates to the redirect target.
    } catch (err) {
      setBusy(false);
      toast.error(formatSocialError(err, provider));
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={busy || !sdkReady}
      className="w-full justify-center"
    >
      {busy
        ? "Opening…"
        : !sdkReady
          ? "Loading…"
          : label}
    </Button>
  );
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

// Translate Clerk's OAuth errors into actionable copy. The Clerk server
// returns messages like "Unsupported provider: missing OAuth secret" when a
// provider has been enabled in app code but not yet wired in the Clerk
// Dashboard (configure step hasn't been completed). Surfacing the raw
// string leaves users stuck; this maps known failure shapes to copy that
// points at the actual fix.
function formatSocialError(err: unknown, provider: SocialProvider): string {
  const pretty = (provider === "google" ? "Google" : provider === "apple" ? "Apple" : "GitHub") + " sign-in";
  const raw = (err as { errors?: Array<{ code?: string; message?: string }>; message?: string })
    .errors?.[0]?.message
    ?? (err as { message?: string })?.message
    ?? "";
  const lower = raw.toLowerCase();
  if (lower.includes("unsupported provider") || lower.includes("missing oauth secret")) {
    return `${pretty} isn't configured on this Clerk app yet. Ask an admin to enable ${provider === "google" ? "Google" : provider === "apple" ? "Apple" : "GitHub"} under Configure → SSO Connections in the Clerk Dashboard.`;
  }
  if (lower.includes("not enabled") || lower.includes("not configured")) {
    return `${pretty} isn't enabled for this environment. Contact an admin.`;
  }
  if (lower.includes("redirect") && lower.includes("mismatch")) {
    return `${pretty} failed because the redirect URL doesn't match Clerk's allowlist. Add ${window.location.origin} under Configure → Domains in the Clerk Dashboard.`;
  }
  if (!raw) return `Sign-in via ${provider} failed. Please try email + password instead.`;
  return `${pretty} failed: ${raw}`;
}
