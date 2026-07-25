import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  ArrowRight,
  Rocket,
  Boxes,
  Cpu,
  Cloud,
  ShoppingBag,
  Workflow,
  Users,
  LayoutDashboard,
  Server,
  ShieldCheck,
  Container,
  Network,
  Gauge,
  Activity,
  GitBranch,
  Mail,
  Layers,
  Globe2,
  Compass,
  PencilRuler,
  Code2,
  Zap,
  Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { IllusHero } from "@/components/site/Illustration";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ciago Technologies — Custom Software & Cloud Engineering" },
      {
        name: "description",
        content:
          "Custom software, ERP/CRM, SaaS platforms and cloud-native infrastructure on AWS, GCP and Azure — engineered end-to-end by a senior team.",
      },
      {
        name: "keywords",
        content:
          "custom software development, ERP, CRM, SaaS platform, Kubernetes, AWS, DevOps, SRE, backend engineering, cloud infrastructure",
      },
      {
        property: "og:title",
        content: "Ciago Technologies — Architecting the Future of Digital Business",
      },
      {
        property: "og:description",
        content:
          "Custom software, industry solutions, backend engineering and cloud infrastructure — one integrated senior team.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Ciago Technologies — Architecting the Future of Digital Business",
      },
      {
        name: "twitter:description",
        content:
          "Custom software, industry solutions, backend engineering and cloud infrastructure — one integrated senior team.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Ciago Technologies",
          description:
            "Premium technology services & consulting for teams building scalable software, cloud infrastructure and enterprise solutions.",
        }),
      },
    ],
  }),
  component: Index,
});

const services = [
  {
    icon: Layers,
    title: "Custom Software & Digital Products",
    tag: "Category 01",
    items: [
      {
        name: "Custom ERP & CRM Platforms",
        desc: "Bespoke systems tuned to your operational workflows.",
        icon: Workflow,
      },
      {
        name: "Multi-Tenant SaaS",
        desc: "Scalable, secure platforms with strict data isolation.",
        icon: Server,
      },
      {
        name: "Admin Dashboards",
        desc: "Interactive portals that turn data into decisions.",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    icon: Boxes,
    title: "Core Industry Solutions",
    tag: "Category 02",
    items: [
      {
        name: "Retail & E-commerce",
        desc: "API-first digital storefronts and headless commerce.",
        icon: ShoppingBag,
      },
      {
        name: "Logistics & OpTech",
        desc: "High-throughput services for real-time operations.",
        icon: Network,
      },
      {
        name: "Legacy Modernization",
        desc: "Wrap and migrate legacy systems to the cloud.",
        icon: GitBranch,
      },
    ],
  },
  {
    icon: Cpu,
    title: "Backend Engineering & Security",
    tag: "Category 03",
    items: [
      {
        name: "High-Performance Backends",
        desc: "Concurrent microservices built for scale.",
        icon: Gauge,
      },
      {
        name: "Robust API Architecture",
        desc: "Rate-limited, validated, documented APIs.",
        icon: Code2,
      },
      {
        name: "Secure by Default",
        desc: "AuthZ, encryption and session hardening from day one.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    icon: Cloud,
    title: "Cloud Infrastructure & DevOps",
    tag: "Category 04",
    items: [
      {
        name: "Kubernetes & Containers",
        desc: "Production-grade, highly-available orchestration.",
        icon: Container,
      },
      {
        name: "Cloud Architecture",
        desc: "Multi-region AWS/GCP/Azure with cost governance.",
        icon: Server,
      },
      {
        name: "SRE & CI/CD",
        desc: "Zero-downtime deployments and 24/7 monitoring.",
        icon: Activity,
      },
    ],
  },
];

const businessServices = [
  {
    icon: Rocket,
    title: "App Deployment & Release Engineering",
    desc: "Zero-downtime releases across environments — Kubernetes, blue/green, canary rollouts and automated rollback wired into your CI/CD pipeline.",
  },
  {
    icon: Layers,
    title: "Cross-Platform App Development",
    desc: "Apps that run on iOS, Android and desktop from a single codebase using React Native and Flutter — without sacrificing native feel or performance.",
  },
  {
    icon: Globe2,
    title: "Web Development",
    desc: "A full range of web engineering — from marketing sites and portals to complex web applications and internal platforms, built for speed and scale.",
  },
];

const process = [
  {
    icon: Compass,
    title: "Discover",
    desc: "A paid discovery sprint to align on scope, architecture and success metrics — no vague estimates.",
  },
  {
    icon: PencilRuler,
    title: "Design",
    desc: "Small, senior teams shape the product, the data model and the platform in parallel.",
  },
  {
    icon: Code2,
    title: "Build",
    desc: "Weekly production shipments, trunk-based development, and observability from day one.",
  },
  {
    icon: Handshake,
    title: "Operate",
    desc: "24/7 SRE coverage with SLOs, alerting and postmortems — we stay on the pager with you.",
  },
];

const whyUs = [
  {
    icon: Zap,
    title: "Senior-only teams",
    desc: "Every engineer has shipped it before. No proxy managers, no ticket shuffling.",
  },
  {
    icon: ShieldCheck,
    title: "Security by default",
    desc: "SDLC hardened with authN/Z, input validation, encryption in transit and at rest.",
  },
  {
    icon: Gauge,
    title: "Built to scale",
    desc: "Concurrent Go/Node backends and Kubernetes platforms that survive real traffic.",
  },
  {
    icon: Users,
    title: "Long-term partners",
    desc: "Most engagements run multi-year. We optimize for outcomes, not billable hours.",
  },
];

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--brand)_25%,transparent),transparent_70%)]"
      />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px] shadow-brand" />
            Enterprise-grade engineering, on demand
          </div>
          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Architecting the <span className="brand-gradient-text">Future of Digital</span>{" "}
            Business.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            We partner with ambitious teams to design scalable software, resilient cloud
            infrastructure, and enterprise solutions that ship — from first commit to global
            production.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand-glow"
              onClick={() =>
                document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore Our Services <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border"
              onClick={() =>
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Book a Consultation
            </Button>
          </div>
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
            {[
              { k: "120+", v: "Products shipped" },
              { k: "99.99%", v: "Uptime SLOs" },
              { k: "24/7", v: "SRE coverage" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-2xl font-bold text-brand">{s.k}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand/20 via-transparent to-brand-glow/10 blur-2xl" />
          <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-brand/10">
            <IllusHero className="h-full w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

function BusinessServices() {
  return (
    <section className="border-y border-border bg-slate-50 py-20 dark:bg-muted/30 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">
            For your business
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Services we provide for your business.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Ship the right surface for every audience — from web platforms to cross-platform apps
            and production-grade deployments.
          </p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {businessServices.map(({ icon: I, title, desc }) => (
            <Card
              key={title}
              className="group border-border bg-card text-center shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
            >
              <CardContent className="p-8">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand ring-4 ring-brand/5">
                  <I className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">What we do</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Full-stack capabilities, engineered end-to-end.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Four practice areas, one integrated team — so strategy, product and platform move as
            one.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-2">
          {services.map((cat) => {
            const Icon = cat.icon;
            return (
              <Card
                key={cat.title}
                className="group relative self-start overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/10"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand to-brand-glow transition-transform duration-300 group-hover:scale-x-100" />
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{cat.tag}</span>
                  </div>
                  <CardTitle className="text-lg font-bold leading-tight">{cat.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cat.items.map((it) => {
                    const ItemIcon = (it as { icon?: typeof Rocket }).icon;
                    return (
                      <div key={it.name} className="flex gap-3">
                        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-brand">
                          {ItemIcon ? (
                            <ItemIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{it.name}</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="border-t border-border bg-muted/20 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">How we work</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            A tight loop from idea to production.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Small senior teams, weekly production shipments and observability from the first commit.
          </p>
        </div>
        <ol className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {process.map((p, i) => {
            const I = p.icon;
            return (
              <li
                key={p.title}
                className="relative rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-lg hover:shadow-brand/10"
              >
                <span className="absolute right-4 top-4 font-mono text-xs text-muted-foreground">
                  0{i + 1}
                </span>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                  <I className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">Why Ciago</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Engineering partners, not vendors.
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              We embed senior engineers into your team, share the pager, and build platforms that
              outlast the roadmap that started them.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {whyUs.map(({ icon: I, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-brand hover:shadow-lg hover:shadow-brand/10"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
                  <I className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      (e.target as HTMLFormElement).reset();
      toast.success("Thanks! We'll be in touch within one business day.");
    }, 700);
  }

  return (
    <section id="contact" className="relative border-t border-border bg-muted/20 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              Get started
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Accelerate Your Project.
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Tell us where you're headed. A senior engineer will scope your idea within one
              business day — no sales funnel, no runaround.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                { icon: ShieldCheck, t: "NDA on request, always." },
                { icon: Mail, t: "hello@ciago.tech" },
                { icon: Activity, t: "Response within 24 hours." },
              ].map(({ icon: I, t }) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
                    <I className="h-4 w-4" />
                  </span>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="border-border bg-card/60 backdrop-blur">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" required placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" name="company" required placeholder="Acme Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service">Service required</Label>
                  <Select name="service">
                    <SelectTrigger id="service">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.title} value={s.title}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="details">Project details</Label>
                  <Textarea
                    id="details"
                    name="details"
                    required
                    rows={5}
                    placeholder="Tell us about goals, timeline, and current stack…"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand-glow"
                  size="lg"
                >
                  {submitting ? "Sending…" : "Send project brief"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Index() {
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (checked && isAdmin) navigate({ to: "/admin", replace: true });
  }, [checked, isAdmin, navigate]);

  if (checked && isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Redirecting to Command Center…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <BusinessServices />
        <Services />
        <Process />
        <WhyUs />
        <ContactSection />
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
