import { useAdminRedirect } from "@/hooks/use-admin-redirect";
import { createFileRoute } from "@tanstack/react-router";
import { Award, Eye, Layers, Shield, Zap, GitBranch, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { TechStackGrid } from "@/components/site/TechStackGrid";
import { IllusTeamwork } from "@/components/site/Illustration";

export const Route = createFileRoute("/about-us")({
  head: () => ({
    meta: [
      { title: "About Us — Senior Engineering Team | Ciago Technologies" },
      {
        name: "description",
        content:
          "The story, values and team behind Ciago Technologies — a senior engineering firm building resilient software and cloud platforms for ambitious brands worldwide.",
      },
      { property: "og:title", content: "About Us — Ciago Technologies" },
      {
        property: "og:description",
        content: "Our story, our values and the brands we build for.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/about-us" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "About Us — Ciago Technologies" },
      {
        name: "twitter:description",
        content: "Our story, our values and the brands we build for.",
      },
    ],
    links: [{ rel: "canonical", href: "/about-us" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Ciago Technologies",
          url: "https://ciago-vision-hub.lovable.app/about-us",
          description:
            "The story, values and team behind Ciago Technologies — a senior engineering firm building resilient software and cloud platforms.",
          mainEntity: {
            "@type": "Organization",
            name: "Ciago Technologies",
            url: "https://ciago-vision-hub.lovable.app",
          },
        }),
      },
    ],
  }),
  component: AboutUs,
});

const clients = ["NORTHWIND", "ACME CO.", "CIRRUS", "HELIX", "MERIDIAN", "OCTANT"];

const stats = [
  { k: "2026", v: "Founded — building from day one." },
  { k: "Senior", v: "Founding team of shipped-before engineers." },
  { k: "Remote", v: "Distributed and async by default." },
];

const values = [
  {
    icon: Award,
    title: "Engineering Excellence",
    desc: "We optimize for craft — code review culture, deep testing and reliability budgets, not shortcuts.",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    desc: "Open estimates, honest status, visible tradeoffs. Our clients see what we see, always.",
  },
  {
    icon: Layers,
    title: "Scalable Thinking",
    desc: "Every decision is weighed against future load, future team size and future maintainers.",
  },
];

const principles = [
  {
    id: "resilience",
    icon: Shield,
    title: "Resilience by Default",
    tagline: "Every system assumes failure — and heals.",
    body: "Blast-radius isolation, circuit breakers, retries with jitter, and multi-AZ replication are non-negotiable. We rehearse failure with regular GameDays and injection tests, so incidents are training, not surprises.",
    proof: ["99.99% uptime target", "Sub-5-minute MTTR", "Zero data-loss RPO"],
  },
  {
    id: "velocity",
    icon: Zap,
    title: "Velocity Through Rigor",
    tagline: "Discipline is the shortest path to shipping fast.",
    body: "Fast feedback loops beat heroics. Trunk-based development, CI < 10 minutes, automated canaries, and reversible releases let teams ship confidently to production every day.",
    proof: ["Multiple deploys/day", "10-minute CI", "Instant rollback"],
  },
  {
    id: "clarity",
    icon: GitBranch,
    title: "Clarity in Architecture",
    tagline: "Boring, legible systems compound.",
    body: "We choose proven tools over shiny ones, write ADRs for every non-trivial decision, and keep service boundaries obvious. The best architecture is one a new engineer can navigate in a day.",
    proof: ["ADR-first culture", "Documented invariants", "1-day ramp for seniors"],
  },
];

const milestones = [
  {
    year: "Q1 2026",
    title: "Ciago Technologies founded",
    body: "Started with a simple bet — a senior-only team, taking on the projects nobody else wants to touch.",
  },
  {
    year: "Q2 2026",
    title: "First platform shipped",
    body: "Delivered our first end-to-end production platform for a design partner — architecture, code, deploy, on-call.",
  },
  {
    year: "Q2 2026",
    title: "Cloud & DevOps practice live",
    body: "Formalized our Kubernetes, AWS and SRE playbook — reproducible infra from day one.",
  },
  {
    year: "Q3 2026",
    title: "Remote-first, async by default",
    body: "Locked in the operating rhythm — deep-work time protected, decisions written down, reviews open.",
  },
  {
    year: "Q4 2026",
    title: "Design partners onboarded",
    body: "Small cohort of ambitious brands working with us on custom engineering and platform builds.",
  },
  {
    year: "2027",
    title: "Scaling the senior bench",
    body: "Deliberately growing at each seniority level — every engagement led by people who've shipped the thing before.",
  },
];

function AboutUs() {
  useAdminRedirect();
  const [activePrinciple, setActivePrinciple] = useState(principles[0].id);
  const active = principles.find((p) => p.id === activePrinciple)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--brand)_20%,transparent),transparent_70%)]"
          />
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">About us</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Engineering excellence, <span className="brand-gradient-text">deeply human.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
                Ciago Technologies was founded on a simple idea: great software is a craft. We're a
                distributed team of senior engineers, architects and designers who partner with
                ambitious brands to build platforms that outlast trends.
              </p>
              <dl className="mt-10 grid grid-cols-3 gap-6">
                {stats.map((s) => (
                  <div key={s.v}>
                    <dt className="text-2xl font-bold text-brand">{s.k}</dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand/25 via-transparent to-brand-glow/10 blur-3xl" />
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-brand/10">
                <IllusTeamwork className="mx-auto w-full max-w-md" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 sm:py-28">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                Our story
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                A brand-new firm, with a senior-only bench from day one.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-relaxed text-muted-foreground">
              <p>
                Ciago Technologies was founded in 2026 with a simple bet — great software is a
                craft, and the fastest path to shipping something durable is a small team of
                engineers who have already shipped the thing before.
              </p>
              <p>
                We're deliberately staying small at each seniority level. Every engagement is led
                end-to-end by senior engineers, architects and designers — no proxy management, no
                ticket shuffling, no handoffs between people who never touched the system.
              </p>
              <p>
                We're early, and that's the point. Design partners get the founding team, direct
                access, and platforms built to outlast the trend cycle.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/30 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                Our vision
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Core engineering principles.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Three commitments that shape every architecture review, every hire, and every
                release.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
              <div className="flex flex-col gap-3">
                {principles.map((p) => {
                  const Icon = p.icon;
                  const isActive = p.id === activePrinciple;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePrinciple(p.id)}
                      className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-300 ${
                        isActive
                          ? "border-brand bg-brand/5 shadow-lg shadow-brand/10"
                          : "border-border bg-card hover:border-brand/50"
                      }`}
                    >
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                          isActive ? "bg-brand text-brand-foreground" : "bg-brand/10 text-brand"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold">{p.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.tagline}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Card className="border-border bg-card">
                <CardContent className="p-8 sm:p-10">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                      <active.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                        Principle
                      </p>
                      <h3 className="text-2xl font-black tracking-tight">{active.title}</h3>
                    </div>
                  </div>
                  <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                    {active.body}
                  </p>
                  <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {active.proof.map((p) => (
                      <div
                        key={p}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                        <span className="text-sm font-semibold">{p}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                Milestones
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Year one, in motion.
              </h2>
              <p className="mt-4 text-muted-foreground">
                We started in 2026. Here's what we're building, quarter by quarter — and where we're
                headed next.
              </p>
            </div>

            <ol className="relative mt-14 space-y-8 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-gradient-to-b before:from-brand/60 before:via-border before:to-transparent sm:before:left-1/2">
              {milestones.map((m, i) => (
                <li
                  key={m.year}
                  className={`relative grid gap-3 sm:grid-cols-2 sm:gap-8 ${
                    i % 2 === 1 ? "sm:[&>*:first-child]:col-start-2" : ""
                  }`}
                >
                  <span className="absolute left-4 top-3 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-brand shadow-lg shadow-brand/40 sm:left-1/2" />
                  <Card
                    className={`ml-10 border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:shadow-xl hover:shadow-brand/10 sm:ml-0 ${
                      i % 2 === 0 ? "sm:mr-8" : "sm:ml-8"
                    }`}
                  >
                    <CardContent className="p-5">
                      <p className="text-xs font-black uppercase tracking-widest text-brand">
                        {m.year}
                      </p>
                      <h3 className="mt-1 text-lg font-bold">{m.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{m.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-border bg-muted/30 py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                Core values
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                What we optimize for.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Three principles that decide how we hire, how we build and how we say no.
              </p>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
              {values.map(({ icon: I, title, desc }) => (
                <Card
                  key={title}
                  className="group border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
                >
                  <CardContent className="p-6">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                      <I className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <TechStackGrid />

        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                Our clients
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Brands we've worked with.
              </h2>
              <p className="mt-4 text-muted-foreground">
                From venture-backed startups to Fortune 500 enterprises.
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {clients.map((name) => (
                <div
                  key={name}
                  className="grid h-20 place-items-center rounded-xl border border-border bg-secondary/60 text-xs font-bold tracking-[0.2em] text-muted-foreground grayscale transition-all duration-300 hover:border-brand hover:text-foreground hover:grayscale-0"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
