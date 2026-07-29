import { useAdminRedirect } from "@/hooks/use-admin-redirect";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { requestResource } from "@/lib/resources.functions";
import { Turnstile } from "@/components/site/Turnstile";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources & Whitepapers | Ciago Technologies" },
      {
        name: "description",
        content:
          "Engineering blueprints from Ciago Technologies — zero-downtime Kubernetes migrations, securing fintech APIs with Go, SRE playbooks and cloud cost optimization guides.",
      },
      { property: "og:title", content: "Resources & Whitepapers — Ciago Technologies" },
      {
        property: "og:description",
        content: "Enterprise engineering blueprints on Kubernetes, Go APIs, SRE and cloud cost.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/resources" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Resources & Whitepapers — Ciago Technologies" },
      {
        name: "twitter:description",
        content: "Enterprise engineering blueprints from our senior team.",
      },
    ],
    links: [{ rel: "canonical", href: "/resources" }],
  }),
  component: ResourcesPage,
});

const resources = [
  {
    slug: "k8s-zero-downtime",
    title: "The Zero-Downtime Kubernetes Migration Blueprint",
    desc: "A step-by-step playbook for moving critical workloads to Kubernetes without dropping a single request — covering traffic shifting, database cutovers, and rollback strategy.",
    file: "ciago-k8s-blueprint.pdf",
  },
  {
    slug: "fintech-go-security",
    title: "Securing Fintech APIs with Go",
    desc: "How we design authentication, request signing, rate limiting and audit trails for regulated financial APIs — plus the Go patterns we reach for by default.",
    file: "ciago-fintech-go.pdf",
  },
  {
    slug: "sre-playbook",
    title: "SRE Playbook: SLOs, Error Budgets & On-Call",
    desc: "The reliability practices our teams use to keep enterprise platforms above 99.95% — including alerting anti-patterns to avoid.",
    file: "ciago-sre-playbook.pdf",
  },
  {
    slug: "cloud-cost-guide",
    title: "The Cloud Cost Optimization Guide",
    desc: "A field-tested framework for cutting cloud spend 30–60% without touching product roadmap — covering right-sizing, Savings Plans, and architectural levers.",
    file: "ciago-cloud-cost.pdf",
  },
];

type Resource = (typeof resources)[number];

function ResourcesPage() {
  useAdminRedirect();
  const submit = useServerFn(requestResource);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [hp, setHp] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      await submit({ data: { email: email.trim(), slug: selected.slug, turnstileToken, hp } });
      toast.success("Your download is ready.");
      // Trigger download of placeholder file (project owner can host the real PDF here).
      const link = document.createElement("a");
      link.href = `/resources/${selected.file}`;
      link.download = selected.file;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSelected(null);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">Resources</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Engineering <span className="brand-gradient-text">blueprints.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Field-tested playbooks from platforms we run in production for regulated, high-traffic
              customers.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {resources.map((r) => (
              <Card
                key={r.slug}
                className="group flex flex-col justify-between border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
              >
                <CardContent className="p-7">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                      <FileText className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="uppercase tracking-widest">
                      PDF
                    </Badge>
                  </div>
                  <h2 className="mt-5 text-xl font-bold">{r.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
                  <Button
                    onClick={() => setSelected(r)}
                    className="mt-6 bg-brand text-brand-foreground hover:bg-brand-glow"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download resource
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            We only use your email for this download and occasional engineering updates. Unsubscribe
            anytime.
          </p>
        </section>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => (!o ? setSelected(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>Enter your work email to unlock the download.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-email">Work email</Label>
              <Input
                id="res-email"
                type="email"
                required
                maxLength={200}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {/* Honeypot */}
            <div aria-hidden className="hidden" style={{ position: "absolute", left: "-10000px" }}>
              <label>
                Website (leave blank)
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                />
              </label>
            </div>
            <Turnstile onToken={setTurnstileToken} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand text-brand-foreground hover:bg-brand-glow"
              >
                {submitting ? "Preparing…" : "Get download"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SiteFooter />
      <Toaster />
    </div>
  );
}
