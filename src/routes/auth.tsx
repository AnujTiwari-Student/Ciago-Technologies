import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Briefcase, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";

const searchSchema = z.object({
  redirect: z.string().optional(),
  portal: z.enum(["candidate", "employee"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign In — Ciago Technologies" },
      {
        name: "description",
        content:
          "Sign in as a candidate to track applications, or as staff to access the Ciago Technologies employee portal.",
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

async function resolvePostLoginDestination(portal: Portal, requested: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return requested;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  const isStaff =
    roleSet.has("employee") || roleSet.has("manager") || roleSet.has("admin") || roleSet.has("hr");

  if (portal === "employee") {
    if (!isStaff) {
      // Strict MNC isolation: candidates using Corporate Login are rejected with an
      // explicit 403 screen. We sign the user out first so their session cannot linger.
      await supabase.auth.signOut();
      throw new Error("__FORBIDDEN_CORPORATE__");
    }
    if (roleSet.has("admin")) return "/admin";
    if (roleSet.has("hr")) return "/hr";
    if (roleSet.has("manager")) return "/manager";
    return "/employee";
  }
  // Candidate tab: staff accounts must use the Corporate Gateway. Block and sign out.
  if (isStaff) {
    await supabase.auth.signOut();
    throw new Error("__STAFF_ON_CANDIDATE__");
  }
  if (requested === "/") return "/my-applications";
  return requested;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user, loading } = useAuth();
  const redirectTo = safePath(search.redirect);
  const [portal, setPortal] = useState<Portal>(search.portal ?? "candidate");

  useEffect(() => {
    if (!loading && user) navigate({ to: redirectTo });
  }, [loading, user, navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:py-24">
        <h1 className="text-3xl font-black tracking-tight">Welcome to Ciago</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Choose how you're signing in.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Tabs value={portal} onValueChange={(v) => setPortal(v as Portal)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="candidate" className="gap-2">
                <Briefcase className="h-4 w-4" /> Candidate
              </TabsTrigger>
              <TabsTrigger value="employee" className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Employee
              </TabsTrigger>
            </TabsList>

            <TabsContent value="candidate" className="mt-6">
              <p className="mb-4 text-xs text-muted-foreground">
                Apply for roles and track your applications.
              </p>
              <CandidateForms redirectTo={redirectTo} />
            </TabsContent>

            <TabsContent value="employee" className="mt-6">
              <div className="mb-4 rounded-lg border border-brand/30 bg-brand/5 p-3 text-xs text-foreground/80">
                Restricted to Ciago Technologies staff. Use your corporate email.
              </div>
              <EmployeeSignIn redirectTo={redirectTo === "/" ? "/employee" : redirectTo} />
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or continue with{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            <SocialButton provider="google" label="Continue with Google" />
            <SocialButton provider="apple" label="Continue with Apple" />
          </div>
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

function CandidateForms({ redirectTo }: { redirectTo: string }) {
  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Sign up</TabsTrigger>
      </TabsList>
      <TabsContent value="signin" className="mt-6">
        <SignInForm portal="candidate" redirectTo={redirectTo} />
      </TabsContent>
      <TabsContent value="signup" className="mt-6">
        <SignUpForm redirectTo={redirectTo} />
      </TabsContent>
    </Tabs>
  );
}

function EmployeeSignIn({ redirectTo }: { redirectTo: string }) {
  return <SignInForm portal="employee" redirectTo={redirectTo} />;
}

function SignInForm({ portal, redirectTo }: { portal: Portal; redirectTo: string }) {
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
    } catch (err: any) {
      if (err?.message === "__FORBIDDEN_CORPORATE__") {
        toast.error("Corporate Login is restricted to Ciago Technologies staff.");
        navigate({ to: "/forbidden", search: { reason: "corporate" } });
      } else if (err?.message === "__STAFF_ON_CANDIDATE__") {
        toast.error("Account active on Corporate Gateway. Please log in via Staff Login.");
      } else {
        toast.error(err?.message || "Sign-in blocked.");
      }
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
        {busy ? "Signing in…" : portal === "employee" ? "Sign in to Employee Portal" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm({ redirectTo }: { redirectTo: string }) {
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

function SocialButton({ provider, label }: { provider: "google" | "apple"; label: string }) {
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message || "Sign-in failed");
      return;
    }
    if (result.redirected) return;
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
