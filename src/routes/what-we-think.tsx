import { useAdminRedirect } from "@/hooks/use-admin-redirect";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { IllusMission, IllusVision } from "@/components/site/Illustration";

export const Route = createFileRoute("/what-we-think")({
  head: () => ({
    meta: [
      { title: "What We Think — Vision & Mission | Ciago Technologies" },
      {
        name: "description",
        content:
          "Ciago Technologies' vision and mission: architecting scalable, future-proof digital infrastructure for the next generation of businesses.",
      },
      { property: "og:title", content: "What We Think — Ciago Technologies" },
      {
        property: "og:description",
        content: "Our vision and mission — building future-proof digital infrastructure.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/what-we-think" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "What We Think — Ciago Technologies" },
      {
        name: "twitter:description",
        content: "Our vision and mission — building future-proof digital infrastructure.",
      },
    ],
    links: [{ rel: "canonical", href: "/what-we-think" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "What We Think — Ciago Technologies",
          url: "https://ciago-vision-hub.lovable.app/what-we-think",
          description:
            "Ciago Technologies' vision and mission — architecting scalable, future-proof digital infrastructure.",
          isPartOf: {
            "@type": "WebSite",
            name: "Ciago Technologies",
            url: "https://ciago-vision-hub.lovable.app",
          },
        }),
      },
    ],
  }),
  component: WhatWeThink,
});

function WhatWeThink() {
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
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              What we think
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              A point of view on the{" "}
              <span className="brand-gradient-text">future of software.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              We believe the next decade belongs to teams who treat their platform as a product —
              not a cost center.
            </p>
          </div>
        </section>

        {/* Vision */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div>
              <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand">
                Our Vision
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                A world where every ambitious idea has infrastructure worthy of it.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                We envision digital platforms that scale without friction, adapt without rewrites,
                and stay resilient under real-world load. Not lock-in. Not fragility. Just software
                that keeps up with the businesses that depend on it.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand/20 via-transparent to-brand-glow/10 blur-2xl" />
              <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-brand/10">
                <IllusVision className="h-full w-full" />
              </div>
            </div>
          </div>
        </section>

        {/* Mission — reversed */}
        <section className="border-t border-border bg-muted/30 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand/10 via-transparent to-brand/20 blur-2xl" />
              <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-brand/10">
                <IllusMission className="h-full w-full" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-flex rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand">
                Our Mission
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                To architect scalable, future-proof digital infrastructure.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                We pair senior engineering with pragmatic delivery — Go, Kubernetes, AWS, Three.js —
                to ship systems that stay understandable, observable and cheap to change five years
                from now.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
