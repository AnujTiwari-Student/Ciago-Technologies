import { useAdminRedirect } from "@/hooks/use-admin-redirect";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, Cpu, Layers, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { submitEstimate } from "@/lib/estimates.functions";
import { Turnstile } from "@/components/site/Turnstile";

export const Route = createFileRoute("/estimate")({
  head: () => ({
    meta: [
      { title: "Project Estimator — Get a Custom Budget & Timeline | Ciago Technologies" },
      {
        name: "description",
        content:
          "Estimate the cost and timeline of your next software, cloud or mobile project in under a minute. Real budget ranges from Ciago Technologies' senior engineering team.",
      },
      { property: "og:title", content: "Project Estimator — Ciago Technologies" },
      {
        property: "og:description",
        content: "Get a tailored budget and timeline range for your project in under a minute.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/estimate" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Project Estimator — Ciago Technologies" },
      { name: "twitter:description", content: "Get a tailored budget and timeline range for your project in under a minute." },
    ],
    links: [{ rel: "canonical", href: "/estimate" }],
  }),
  component: EstimatePage,
});

const projectTypes = [
  { id: "custom", label: "Custom Software / ERP", icon: Layers, base: [3_300_000, 6_600_000] as [number, number] },
  { id: "cloud", label: "Cloud Infrastructure & DevOps", icon: Cloud, base: [2_500_000, 5_800_000] as [number, number] },
  { id: "mobile", label: "Mobile App", icon: Smartphone, base: [2_900_000, 7_500_000] as [number, number] },
  { id: "industry", label: "Core Industry Solution", icon: Cpu, base: [4_100_000, 10_000_000] as [number, number] },
];

const scales = [
  { id: "mvp", label: "Startup / MVP", mult: 1, months: [1, 3] as [number, number] },
  { id: "mid", label: "Mid-Growth Scale", mult: 1.8, months: [3, 6] as [number, number] },
  { id: "enterprise", label: "Enterprise Infrastructure", mult: 3.2, months: [6, 12] as [number, number] },
];

const timelines = [
  { id: "fast", label: "1-3 months", mult: 1.25 },
  { id: "std", label: "3-6 months", mult: 1 },
  { id: "long", label: "6+ months", mult: 0.9 },
];

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(n: number) {
  // Round to nearest 10,000 for cleaner ranges
  const rounded = Math.round(n / 10_000) * 10_000;
  return inrFormatter.format(rounded);
}

function EstimatePage() {
  useAdminRedirect();
  const submit = useServerFn(submitEstimate);
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [scale, setScale] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [hp, setHp] = useState("");

  const estimate = useMemo(() => {
    const p = projectTypes.find((x) => x.id === projectType);
    const s = scales.find((x) => x.id === scale);
    const t = timelines.find((x) => x.id === timeline);
    if (!p || !s) return null;
    const low = Math.round(p.base[0] * s.mult * (t?.mult ?? 1));
    const high = Math.round(p.base[1] * s.mult * (t?.mult ?? 1));
    return { low, high, months: s.months };
  }, [projectType, scale, timeline]);

  const progress = ((step + 1) / 4) * 100;

  function next() {
    if (step === 0 && !projectType) return toast.error("Pick a project type.");
    if (step === 1 && !scale) return toast.error("Pick a scale.");
    if (step === 2 && !timeline) return toast.error("Pick a timeline.");
    setStep((s) => Math.min(3, s + 1));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !company.trim() || !estimate) return;
    setSubmitting(true);
    try {
      await submit({
        data: {
          fullName: name.trim(),
          email: email.trim(),
          company: company.trim(),
          projectType: projectTypes.find((p) => p.id === projectType)!.label,
          scale: scales.find((s) => s.id === scale)!.label,
          timeline: timelines.find((t) => t.id === timeline)!.label,
          budgetLow: estimate.low,
          budgetHigh: estimate.high,
          turnstileToken,
          hp,
        },
      });
      setDone(true);
      toast.success("Estimate received — we'll be in touch within one business day.");
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
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Estimate</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Estimate your <span className="brand-gradient-text">project.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Four quick questions. Real budget and timeline ranges from our senior team — no sales calls required to see the number.
          </p>

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xl shadow-brand/5 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Step {step + 1} of 4
              </p>
              <Progress value={progress} className="h-1.5 w-40" />
            </div>

            {done ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/15 text-brand">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-2xl font-bold">Request received.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  We've logged your estimate. A senior engineer will reach out within one business day to walk through scope, dependencies, and next steps.
                </p>
                {estimate && (
                  <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border bg-muted/40 p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Your estimate
                    </p>
                    <p className="mt-2 text-2xl font-black text-brand">
                      {money(estimate.low)} – {money(estimate.high)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {estimate.months[0]}–{estimate.months[1]} months
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {step === 0 && (
                  <StepGrid
                    heading="What are you building?"
                    subheading="Pick the closest fit — we'll refine on the call."
                    value={projectType}
                    onChange={setProjectType}
                    options={projectTypes.map((p) => ({ id: p.id, label: p.label, Icon: p.icon }))}
                  />
                )}
                {step === 1 && (
                  <StepGrid
                    heading="What scale?"
                    subheading="This drives team size and infrastructure decisions."
                    value={scale}
                    onChange={setScale}
                    options={scales.map((s) => ({ id: s.id, label: s.label }))}
                  />
                )}
                {step === 2 && (
                  <StepGrid
                    heading="What's your timeline?"
                    subheading="We'll flag anything tight before we quote."
                    value={timeline}
                    onChange={setTimeline}
                    options={timelines.map((t) => ({ id: t.id, label: t.label }))}
                  />
                )}
                {step === 3 && (
                  <form onSubmit={onSubmit} className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold">Get your detailed breakdown.</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Enter your details to unlock your estimate and receive a written scope proposal.
                      </p>
                    </div>
                    {estimate && (
                      <div className="rounded-xl border border-brand/40 bg-brand/5 p-5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                          Preliminary range
                        </p>
                        <p className="mt-2 text-3xl font-black text-foreground">
                          {money(estimate.low)} – {money(estimate.high)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Delivered in {estimate.months[0]}–{estimate.months[1]} months.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="est-name">Full name</Label>
                        <Input id="est-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="est-email">Work email</Label>
                        <Input id="est-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="est-company">Company</Label>
                        <Input id="est-company" value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={200} />
                      </div>
                    </div>
                    {/* Honeypot */}
                    <div aria-hidden className="hidden" style={{ position: "absolute", left: "-10000px" }}>
                      <label>Website (leave blank)
                        <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
                      </label>
                    </div>
                    <Turnstile onToken={setTurnstileToken} />
                    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-between">
                      <Button type="button" variant="outline" onClick={() => setStep(2)}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                      </Button>
                      <Button type="submit" disabled={submitting} className="bg-brand text-brand-foreground hover:bg-brand-glow">
                        {submitting ? "Sending…" : "Unlock my estimate"}
                      </Button>
                    </div>
                  </form>
                )}

                {step < 3 && (
                  <div className="mt-8 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      disabled={step === 0}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                    <div className="flex items-center gap-4">
                      {estimate && (
                        <p className="hidden text-sm text-muted-foreground sm:block">
                          Estimated:{" "}
                          <span className="font-bold text-foreground">
                            {money(estimate.low)}–{money(estimate.high)}
                          </span>
                        </p>
                      )}
                      <Button type="button" onClick={next} className="bg-brand text-brand-foreground hover:bg-brand-glow">
                        Continue <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

type Opt = { id: string; label: string; Icon?: React.ComponentType<{ className?: string }> };

function StepGrid({
  heading,
  subheading,
  value,
  onChange,
  options,
}: {
  heading: string;
  subheading: string;
  value: string | null;
  onChange: (id: string) => void;
  options: Opt[];
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">{heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = value === o.id;
          const Icon = o.Icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                active
                  ? "border-brand bg-brand/10 shadow-lg shadow-brand/10"
                  : "border-border bg-card hover:border-brand/60 hover:-translate-y-0.5"
              }`}
            >
              {Icon && (
                <span className={`grid h-10 w-10 place-items-center rounded-lg ${active ? "bg-brand text-brand-foreground" : "bg-brand/10 text-brand"}`}>
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <span className="font-semibold">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
