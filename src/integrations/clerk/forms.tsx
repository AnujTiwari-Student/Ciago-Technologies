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
import type { OAuthStrategy } from "@clerk/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  resolveMyPortal,
  FORBIDDEN_CORPORATE_ERROR,
  STAFF_ON_CANDIDATE_ERROR,
} from "@/lib/portal.functions";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";

type Portal = "candidate" | "employee";

type SocialProvider = "google" | "apple" | "github";

// Maps our SocialProvider literal to the Clerk strategy constant
// expected by signIn.authenticateWithRedirect({ strategy }).
const CLERK_STRATEGY: Record<SocialProvider, OAuthStrategy> = {
  google: "oauth_google",
  apple: "oauth_apple",
  github: "oauth_github",
};

export async function canProceedWithClerkAuth(): Promise<boolean> {
  try {
    return await isClerkAuthEnabledFn();
  } catch (error) {
    console.error("[auth] Failed to evaluate clerkAuthentication flag", error);
    return false;
  }
}

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
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await canProceedWithClerkAuth())) {
      toast.error("Authentication is temporarily disabled.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await signIn.password({ identifier: email, password });
      if (error) {
        setBusy(false);
        toast.error(
          errors?.fields?.password?.message ??
            errors?.fields?.identifier?.message ??
            "Sign-in blocked.",
        );
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              setBusy(false);
              toast.error("Additional verification required.");
              return;
            }
            try {
              const dest = await resolveMyPortal({ data: { portal, requested: redirectTo } });
              toast.success("Signed in.");
              navigate({ to: dest });
            } catch (err) {
              setBusy(false);
              handlePortalError(err, navigate);
            }
          },
        });
      } else if (signIn.status === "needs_second_factor") {
        setBusy(false);
        toast.error("Sign-in incomplete — MFA / verification required.");
      } else {
        setBusy(false);
        toast.error("Sign-in incomplete. Please try again.");
      }
    } catch (err) {
      setBusy(false);
      const message = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(message);
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

function ClerkSignUpForm({ redirectTo }: { redirectTo: string }) {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await canProceedWithClerkAuth())) {
      toast.error("Authentication is temporarily disabled.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const firstSpace = name.indexOf(" ");
      const firstName = firstSpace === -1 ? name : name.slice(0, firstSpace);

      const { error } = await signUp.password({ emailAddress: email, password, firstName });
      if (error) {
        setBusy(false);
        toast.error(
          errors?.fields?.emailAddress?.message ??
            errors?.fields?.password?.message ??
            "Sign-up blocked.",
        );
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async () => {
            try {
              const dest = await resolveMyPortal({
                data: { portal: "candidate", requested: redirectTo },
              });
              toast.success("Account created. You can apply now.");
              navigate({ to: dest });
            } catch (err) {
              setBusy(false);
              handlePortalError(err, navigate);
            }
          },
        });
      } else if (signUp.status === "missing_requirements") {
        // Email verification required
        try {
          await signUp.verifications.sendEmailCode();
          setBusy(false);
          toast.success("Check your inbox to confirm your email, then sign in.");
        } catch (err) {
          setBusy(false);
          // If verification send fails, try to complete anyway
          toast.warning("Account created. Please sign in to continue.");
        }
      } else {
        setBusy(false);
        toast.error("Sign-up incomplete. Please try signing in instead.");
      }
    } catch (err) {
      setBusy(false);
      const message = err instanceof Error ? err.message : "Sign-up failed";
      toast.error(message);
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
        disabled={busy}
        className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
      >
        {busy ? "Creating…" : "Create account"}
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
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  async function onClick() {
    setBusy(true);
    try {
      if (!(await canProceedWithClerkAuth())) {
        setBusy(false);
        toast.error("Authentication is temporarily disabled.");
        return;
      }

      // Start OAuth flow
      const { error } = await signIn.sso({
        strategy: CLERK_STRATEGY[provider],
        redirectUrl: `${window.location.origin}/auth?clerk_redirect=1`,
        redirectCallbackUrl: `${window.location.origin}/auth/sso-callback`,
      });

      const nestedError = signIn.firstFactorVerification?.error;

      if (nestedError?.code === "external_account_not_found") {
        // No existing Clerk user for this OAuth identity — transfer to sign-up.
        const { error: suError } = await signUp.sso({
          strategy: CLERK_STRATEGY[provider],
          redirectUrl: `${window.location.origin}/auth?clerk_redirect=1`,
          redirectCallbackUrl: `${window.location.origin}/auth/sso-callback`,
        });
        if (suError) {
          setBusy(false);
          toast.error(formatSocialError(suError, provider));
          return;
        }
        // OAuth redirect will happen - leave busy state on
        return;
      }

      if (error || nestedError) {
        setBusy(false);
        toast.error(formatSocialError(error ?? nestedError, provider));
        return;
      }

      // OAuth redirect will happen - leave busy state on
      // The redirect will bring us back and the session will be established
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
      disabled={busy}
      className="w-full justify-center"
    >
      {busy ? "Opening…" : label}
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
  const pretty =
    (provider === "google" ? "Google" : provider === "apple" ? "Apple" : "GitHub") + " sign-in";
  const raw =
    (err as { errors?: Array<{ code?: string; message?: string }>; message?: string }).errors?.[0]
      ?.message ??
    (err as { message?: string })?.message ??
    "";
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
