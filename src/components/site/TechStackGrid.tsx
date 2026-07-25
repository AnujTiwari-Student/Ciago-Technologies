import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

type Tech = { name: string; why: string };
type Category = { id: string; label: string; items: Tech[] };

const categories: Category[] = [
  {
    id: "backend",
    label: "Backend & APIs",
    items: [
      { name: "Go", why: "Concurrent, statically-typed services that scale linearly with cores — ideal for high-throughput APIs." },
      { name: "Node.js / TypeScript", why: "Shared type contracts with frontends and mature ecosystem for real-time and edge workloads." },
      { name: "gRPC", why: "Strict schemas, streaming and multiplexing over HTTP/2 — the backbone of our internal microservice fabric." },
      { name: "GraphQL", why: "One flexible contract for product teams, with schema-first governance and precise field-level auth." },
    ],
  },
  {
    id: "cloud",
    label: "Cloud & DevOps",
    items: [
      { name: "Kubernetes", why: "Portable orchestration with rolling updates, autoscaling and blast-radius isolation across regions." },
      { name: "Docker", why: "Reproducible builds — same artifact from a laptop to production, immutable and auditable." },
      { name: "AWS", why: "Deep managed services (EKS, RDS, S3, IAM) and multi-account landing zones for regulated workloads." },
      { name: "Terraform", why: "Declarative, versioned infrastructure with plan/apply reviews — no more click-ops drift." },
      { name: "ArgoCD", why: "GitOps delivery that keeps clusters in sync with the repo — reversible, auditable, boring." },
    ],
  },
  {
    id: "mobile",
    label: "Mobile & Frontend",
    items: [
      { name: "React", why: "Battle-tested component model with a huge talent pool and mature testing story." },
      { name: "Next.js", why: "Hybrid rendering, edge runtime and image optimisation — production defaults, not experiments." },
      { name: "TypeScript", why: "Catches interface drift before it reaches production and doubles as living documentation." },
      { name: "React Native", why: "One codebase, native performance and shared business logic across iOS and Android." },
      { name: "Tailwind CSS", why: "Design tokens in code — consistent, themable UI without CSS bloat." },
    ],
  },
  {
    id: "security",
    label: "Security & Database",
    items: [
      { name: "PostgreSQL", why: "ACID, JSONB, partitioning and mature replication — a single engine for OLTP + analytics." },
      { name: "Redis", why: "Sub-millisecond caching, pub/sub and rate-limits for hot paths." },
      { name: "OAuth 2.0 / OIDC", why: "Industry-standard identity, MFA and SSO integration for enterprise customers." },
      { name: "Vault", why: "Centralized secrets with dynamic credentials and short-lived tokens — no more .env leaks." },
      { name: "OpenTelemetry", why: "Vendor-neutral traces, metrics and logs so we can debug production in minutes, not hours." },
    ],
  },
];

export function TechStackGrid() {
  return (
    <section className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Our stack</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            The technology behind our platforms.
          </h2>
          <p className="mx-auto mt-4 text-muted-foreground">
            We pick tools that survive at scale — proven, portable, and boring in the best way.
          </p>
        </div>

        <Tabs defaultValue="backend" className="mt-10">
          <TabsList className="mx-auto grid h-auto w-full max-w-3xl grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4">
            {categories.map((c) => (
              <TabsTrigger
                key={c.id}
                value={c.id}
                aria-label={`Show ${c.label} technologies`}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all data-[state=active]:border-brand data-[state=active]:bg-brand/10 data-[state=active]:text-brand data-[state=active]:shadow-lg data-[state=active]:shadow-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((c) => (
            <TabsContent key={c.id} value={c.id} className="mt-10">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {c.items.map((t) => (
                  <Card
                    key={t.name}
                    className="group border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 font-black text-brand">
                          {t.name.slice(0, 1)}
                        </div>
                        <h3 className="text-lg font-bold">{t.name}</h3>
                      </div>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.why}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
