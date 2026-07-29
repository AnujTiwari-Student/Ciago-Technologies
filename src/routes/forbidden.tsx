import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  reason: z
    .enum([
      "corporate",
      "role",
      "doj",
      "dashboard_disabled",
      "clerk_auth_disabled",
      "authentication_button_disabled",
    ])
    .optional(),
});

export const Route = createFileRoute("/forbidden")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Access denied | Ciago Technologies" },
      { name: "description", content: "You don't have permission to view this page." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForbiddenPage,
});

function ForbiddenPage() {
  const { reason } = Route.useSearch();

  const copy =
    reason === "corporate"
      ? {
          badge: "403 · Unauthorized",
          title: "Corporate credentials required",
          body: "Unauthorized: Corporate credentials required. The Corporate Login is restricted to Ciago Technologies staff. This attempt has been logged. If you meant to apply for a role, use the Candidate tab on the sign-in page.",
        }
      : reason === "doj"
        ? {
            badge: "403 · Not yet active",
            title: "Your employment starts on your DOJ",
            body: "Your account is verified but your Date of Joining hasn't arrived yet. You'll get full portal access on your start date.",
          }
        : {
            badge: "403 · Forbidden",
            title: "You don't have access to this area",
            body: "This page is restricted to Ciago Technologies staff. If you believe this is a mistake, contact your workspace owner.",
          };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-destructive">
          {copy.badge}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{copy.title}</h1>
        <p className="mt-3 text-muted-foreground">{copy.body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-brand text-brand-foreground hover:bg-brand-glow">
            <Link to="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth" search={{ portal: "candidate" }}>
              Candidate sign-in
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
