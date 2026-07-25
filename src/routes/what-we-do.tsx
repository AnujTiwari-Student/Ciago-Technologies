import { useAdminRedirect } from "@/hooks/use-admin-redirect";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Cloud,
  Cpu,
  Layers,
  Workflow,
  Users,
  LayoutDashboard,
  Server,
  Zap,
  Smartphone,
  ShoppingBag,
  Truck,
  Network,
  ShieldCheck,
  Container,
  Activity,
  GitBranch,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { TechStackGrid } from "@/components/site/TechStackGrid";

export const Route = createFileRoute("/what-we-do")({
  head: () => ({
    meta: [
      { title: "Services — Software, Cloud & DevOps | Ciago" },
      {
        name: "description",
        content:
          "Custom software, ERP/CRM, SaaS, high-throughput backends, Kubernetes, AWS architecture and 24/7 SRE — engineered end-to-end.",
      },
      { name: "keywords", content: "custom software development, ERP development, CRM development, SaaS platform, backend engineering, Kubernetes consulting, AWS architecture, DevOps services, SRE, cloud infrastructure" },
      { property: "og:title", content: "Services — Ciago Technologies" },
      {
        property: "og:description",
        content:
          "Custom software, industry solutions, backend engineering and cloud infrastructure — one integrated team.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/what-we-do" },
      { property: "og:site_name", content: "Ciago Technologies" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Services — Ciago Technologies" },
      {
        name: "twitter:description",
        content:
          "Custom software, industry solutions, backend engineering and cloud infrastructure services.",
      },
    ],
    links: [{ rel: "canonical", href: "/what-we-do" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType:
            "Custom software development, cloud infrastructure and DevOps consulting",
          provider: {
            "@type": "Organization",
            name: "Ciago Technologies",
          },
          areaServed: "Worldwide",
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Ciago Technologies services",
            itemListElement: [
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Custom Software & Digital Products" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Core Industry Solutions" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Backend Engineering & Application Security" } },
              { "@type": "Offer", itemOffered: { "@type": "Service", name: "Cloud Infrastructure & DevOps" } },
            ],
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What types of custom software does Ciago Technologies build?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We build ERP and CRM platforms, multi-tenant SaaS products, internal admin dashboards, cross-platform mobile apps and bespoke web applications — engineered end-to-end for your operations.",
              },
            },
            {
              "@type": "Question",
              name: "Do you provide ongoing DevOps and SRE support?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. We run production Kubernetes clusters, CI/CD pipelines, observability and 24/7 SRE coverage on AWS, GCP and Azure — with SLOs, alerting and postmortems as standard.",
              },
            },
            {
              "@type": "Question",
              name: "How do you approach application security?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Security is built into the SDLC from day one: robust authentication, strict access control, input validation, end-to-end encryption for data in transit and at rest, and secure session management.",
              },
            },
            {
              "@type": "Question",
              name: "Can you modernize legacy systems?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. We wrap legacy software in secure custom APIs, containerize workloads, and progressively migrate to cloud-native architectures with zero-downtime deployments.",
              },
            },
            {
              "@type": "Question",
              name: "What industries do you serve?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "We specialize in retail & e-commerce, logistics, fintech and manufacturing — but the underlying engineering practice is industry-agnostic.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: WhatWeDo,
});


type Item = {
  id: string;
  icon: typeof Boxes;
  name: string;
  summary: string;
};

type Group = {
  id: string;
  title: string;
  items: Item[];
};

type Section = {
  id: string;
  icon: typeof Boxes;
  tag: string;
  title: string;
  blurb: string;
  groups: Group[];
};

const sections: Section[] = [
  {
    id: "software",
    icon: Layers,
    tag: "01",
    title: "Custom Software & Digital Products",
    blurb: "Bespoke platforms built around your operations — not the other way around.",
    groups: [
      {
        id: "enterprise",
        title: "Enterprise Systems & Workflow Automation",
        items: [
          {
            id: "erp",
            icon: Workflow,
            name: "Custom ERP Development",
            summary:
              "Bespoke Enterprise Resource Planning systems tailored to your exact operational workflows. We unify disparate business processes into a single source of truth, eliminating data silos and improving cross-departmental efficiency.",
          },
          {
            id: "crm",
            icon: Users,
            name: "CRM Solutions",
            summary:
              "Custom Customer Relationship Management platforms designed around your specific sales and client onboarding pipelines, giving your team the exact tools they need to track leads and retain customers.",
          },
          {
            id: "dashboards",
            icon: LayoutDashboard,
            name: "Interactive Dashboards & Admin Panels",
            summary:
              "Intuitive, high-performance dashboards that transform raw data into actionable insights. Our administrative portals let internal teams manage complex operations seamlessly.",
          },
        ],
      },
      {
        id: "saas",
        title: "SaaS & Web Applications",
        items: [
          {
            id: "multitenant",
            icon: Server,
            name: "Scalable Multi-Tenant Architecture",
            summary:
              "Platform foundations built to handle rapid user growth safely. We implement strict data isolation and secure authentication workflows so client data stays completely separate and secure.",
          },
          {
            id: "webperf",
            icon: Zap,
            name: "High-Performance Web Interfaces",
            summary:
              "Web experiences focused on speed and user retention. We optimize how pages load and render, delivering lightning-fast applications that improve both UX and search visibility.",
          },
        ],
      },
      {
        id: "mobile",
        title: "Mobile Application Development",
        items: [
          {
            id: "crossplatform",
            icon: Smartphone,
            name: "Unified Cross-Platform Mobile",
            summary:
              "High-quality, performant applications for iOS and Android simultaneously — consistent user experience across devices while significantly reducing development time and maintenance overhead.",
          },
        ],
      },
    ],
  },
  {
    id: "industry",
    icon: Boxes,
    tag: "02",
    title: "Core Industry Solutions",
    blurb: "Domain-aware platforms tuned to the constraints of your sector.",
    groups: [
      {
        id: "retail",
        title: "Retail & E-commerce Modernization",
        items: [
          {
            id: "storefronts",
            icon: ShoppingBag,
            name: "API-First Digital Storefronts",
            summary:
              "Custom, headless commerce architectures that separate the frontend from the backend. Modern frameworks and lightweight APIs eliminate loading bottlenecks for a seamless, instant shopping experience.",
          },
          {
            id: "inventory",
            icon: LayoutDashboard,
            name: "Smart Back-Office & Inventory Tools",
            summary:
              "Modular backend systems and custom admin dashboards to manage complex retail operations. Optional AI-assisted data processing helps teams categorize inventory, search records faster and streamline daily tasks.",
          },
        ],
      },
      {
        id: "logistics",
        title: "Logistics & Operational Technology",
        items: [
          {
            id: "throughput",
            icon: Truck,
            name: "High-Throughput Data Processing",
            summary:
              "Highly concurrent backend microservices that process massive amounts of real-time operational data — tracking updates, telemetry, system logs — without slowing down or crashing.",
          },
          {
            id: "legacy",
            icon: Network,
            name: "Legacy System API Modernization",
            summary:
              "Bridge older operational software with modern cloud environments. We wrap legacy systems in secure, custom-built APIs and deploy them inside reliable software containers.",
          },
        ],
      },
    ],
  },
  {
    id: "backend",
    icon: Cpu,
    tag: "03",
    title: "Backend Engineering & Application Security",
    blurb: "High-throughput services and secure-by-default architecture.",
    groups: [
      {
        id: "highperf",
        title: "High-Performance Backend Systems",
        items: [
          {
            id: "concurrency",
            icon: Gauge,
            name: "Concurrency & Scale",
            summary:
              "When out-of-the-box solutions bottleneck your traffic, we engineer custom microservices for maximum throughput. Memory-efficient backends handle thousands of simultaneous requests while keeping cloud compute costs low.",
          },
          {
            id: "apiarch",
            icon: Network,
            name: "Robust API Architecture",
            summary:
              "The connective tissue for digital platforms. Custom APIs shipped with strict rate limiting, robust data validation and clear documentation — for seamless integration with mobile apps, web frontends and third-party services.",
          },
        ],
      },
      {
        id: "security",
        title: "Application & Data Security",
        items: [
          {
            id: "appsec",
            icon: ShieldCheck,
            name: "Proactive App Security",
            summary:
              "Security is built into our development lifecycle from day one. Robust authentication, strict access controls and comprehensive input validation protect your app from common vulnerabilities and unauthorized access.",
          },
          {
            id: "datasec",
            icon: ShieldCheck,
            name: "Secure Data Management",
            summary:
              "Sensitive user and business data managed securely — end-to-end encryption for data in transit and at rest, alongside secure session management to safeguard your infrastructure.",
          },
        ],
      },
    ],
  },
  {
    id: "cloud",
    icon: Cloud,
    tag: "04",
    title: "Cloud Infrastructure & DevOps Services",
    blurb: "Production-grade platforms with the receipts to prove it.",
    groups: [
      {
        id: "cloudarch",
        title: "Cloud Architecture & Cost Optimization",
        items: [
          {
            id: "ha",
            icon: Server,
            name: "Highly Available Cloud Design",
            summary:
              "Cloud infrastructure built for resilience. Multi-region setups and automated failover strategies keep your application online even during unexpected server issues.",
          },
          {
            id: "cost",
            icon: Gauge,
            name: "Resource & Budget Governance",
            summary:
              "Prevent cloud budget bloat with strict access policies and automated cost-optimization workflows — you only pay for the server resources you actually use.",
          },
        ],
      },
      {
        id: "sre",
        title: "Site Reliability & Automated Operations",
        items: [
          {
            id: "cicd",
            icon: GitBranch,
            name: "Zero-Downtime Deployments (CI/CD)",
            summary:
              "Eliminate manual deployment errors. Automated code testing and infrastructure provisioning enable seamless, zero-downtime updates so your application improves without interrupting users.",
          },
          {
            id: "containers",
            icon: Container,
            name: "Container Orchestration",
            summary:
              "Package applications into isolated, efficient containers managed by industry-standard orchestration tools — scale up automatically during high traffic and scale down during quiet periods.",
          },
          {
            id: "monitoring",
            icon: Activity,
            name: "Proactive System Monitoring",
            summary:
              "You cannot fix what you cannot see. Centralized logging and performance monitoring alert our team to anomalies and bottlenecks long before your users notice them.",
          },
        ],
      },
    ],
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "What kinds of custom software do you build?",
    a: "ERP and CRM platforms, multi-tenant SaaS products, internal admin dashboards, cross-platform mobile apps and bespoke web applications — engineered around your operations, not a template.",
  },
  {
    q: "Do you offer ongoing DevOps and SRE support?",
    a: "Yes. We run production Kubernetes clusters, CI/CD pipelines, observability and 24/7 SRE coverage on AWS, GCP and Azure — with SLOs, alerting and postmortems as standard practice.",
  },
  {
    q: "How do you handle application and data security?",
    a: "Security is built into the SDLC from day one — robust authentication, strict access control, input validation, end-to-end encryption for data in transit and at rest, and secure session management.",
  },
  {
    q: "Can you modernize a legacy platform without a full rewrite?",
    a: "Yes. We wrap legacy software in secure custom APIs, containerize workloads, and progressively migrate to cloud-native architectures with zero-downtime deployments.",
  },
  {
    q: "What does an engagement typically look like?",
    a: "We start with a paid discovery sprint to align on scope, architecture and success metrics. From there we run in small, senior, cross-functional teams shipping to production every week.",
  },
  {
    q: "Which industries do you have the deepest experience in?",
    a: "Retail & e-commerce, logistics and supply chain, fintech and manufacturing — though the underlying engineering practice is industry-agnostic and translates well across domains.",
  },
];


function SectionBlock({ sec }: { sec: Section }) {
  const Icon = sec.icon;
  return (
    <div>
      <div className="mb-8 flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <p className="font-mono text-xs text-muted-foreground">Section {sec.tag}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{sec.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sec.blurb}</p>
        </div>
      </div>

      <div className="space-y-10">
        {sec.groups.map((g) => (
          <div key={g.id}>
            <h3 className="mb-4 text-lg font-bold tracking-tight text-foreground/90">{g.title}</h3>
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
              {g.items.map((it) => {
                const It = it.icon;
                return (
                  <Card
                    key={it.id}
                    className="group self-start border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
                          <It className="h-5 w-5" aria-hidden />
                        </div>
                        <CardTitle className="text-base font-bold leading-tight sm:text-lg">
                          {it.name}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible>
                        <AccordionItem value={`${sec.id}-${g.id}-${it.id}`} className="border-b-0">
                          <AccordionTrigger className="py-2 text-sm font-semibold text-brand hover:no-underline">
                            Read more
                          </AccordionTrigger>
                          <AccordionContent>
                            <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                              {it.summary}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

function WhatWeDo() {
  useAdminRedirect();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--brand)_20%,transparent),transparent_70%)]"
          />
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">What we do</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Client services, <span className="brand-gradient-text">engineered end-to-end.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Four practice areas — custom software, industry solutions, backend engineering and
              cloud platform — delivered by one integrated team.
            </p>
          </div>
        </section>

        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Tabs defaultValue={sections[0].id} className="w-full">
              <TabsList
                aria-label="Practice areas"
                className="mx-auto grid h-auto w-full max-w-4xl grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/40 p-2 shadow-sm backdrop-blur lg:grid-cols-4"
              >
                {sections.map((s) => {
                  const Icon = s.icon;
                  return (
                    <TabsTrigger
                      key={s.id}
                      value={s.id}
                      aria-label={`${s.title} — section ${s.tag}`}
                      className="group flex h-auto flex-col items-start gap-1.5 rounded-xl px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-md data-[state=active]:shadow-brand/25"
                    >
                      <div className="flex w-full items-center justify-between">
                        <Icon className="h-4 w-4 opacity-80" aria-hidden />
                        <span className="font-mono text-[10px] opacity-70">{s.tag}</span>
                      </div>
                      <span className="text-sm font-semibold leading-tight">
                        {s.title.split(" & ")[0]}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {sections.map((s) => (
                <TabsContent key={s.id} value={s.id} className="mt-12 focus-visible:outline-none">
                  <SectionBlock sec={s} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </section>

        <section className="border-t border-border bg-muted/20 py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">FAQ</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Questions we hear a lot.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                A quick primer on how we scope, ship and support the platforms we build.
              </p>
            </div>
            <Accordion type="single" collapsible className="mt-10 w-full">
              {faqs.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="mb-3 rounded-xl border border-border bg-card px-5 transition-colors hover:border-brand"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline sm:text-lg">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <TechStackGrid />

      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
