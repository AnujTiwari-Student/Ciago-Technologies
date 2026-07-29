import { useAdminRedirect } from "@/hooks/use-admin-redirect";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  Globe,
  HeartPulse,
  Laptop,
  LogIn,
  PieChart,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { useAuth, displayName } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { submitApplication } from "@/lib/applications.functions";
import { listActiveJobPostings, type JobPosting } from "@/lib/jobPostings.functions";
import { listMyApplications } from "@/lib/applications.query";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, Hash, MapPin, Search, Sparkles } from "lucide-react";
import { IllusCareers } from "@/components/site/Illustration";
import { Turnstile } from "@/components/site/Turnstile";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — Join the Ciago Team" },
      {
        name: "description",
        content:
          "Open engineering roles at Ciago. Remote-first senior team, top-tier gear, learning stipend and equity — build digital infrastructure with us.",
      },
      { property: "og:title", content: "Careers — Ciago Technologies" },
      {
        property: "og:description",
        content:
          "Remote-first roles for engineers who care about craft, scale and cutting-edge tech.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/careers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Careers — Ciago Technologies" },
      {
        name: "twitter:description",
        content:
          "Remote-first roles for engineers who care about craft, scale and cutting-edge tech.",
      },
    ],
    links: [{ rel: "canonical", href: "/careers" }],
  }),
  component: Careers,
});

const perks = [
  {
    icon: Globe,
    title: "Remote-First",
    desc: "Work from anywhere. Async by default, with quarterly in-person offsites.",
  },
  {
    icon: HeartPulse,
    title: "Health Coverage",
    desc: "Comprehensive medical, dental and mental-health support for you and dependants.",
  },
  {
    icon: BookOpen,
    title: "Learning Stipend",
    desc: "Annual budget for books, courses and conference tickets — plus paid study time.",
  },
  {
    icon: Laptop,
    title: "Top-Tier Gear",
    desc: "Latest MacBook Pro, monitor and peripherals — refreshed on your schedule, not ours.",
  },
  {
    icon: Sun,
    title: "Flexible PTO",
    desc: "Take the time you need. Minimum 25 days, no maximum, actually used.",
  },
  {
    icon: PieChart,
    title: "Equity Options",
    desc: "Meaningful equity for every full-time engineer — you build it, you own part of it.",
  },
];

type Role = {
  id: string;
  jobCode: string | null;
  title: string;
  location: string;
  summary: string;
  tags: string[];
  department: string;
  responsibilities: string[];
};

function toRole(p: JobPosting): Role {
  return {
    id: p.id,
    jobCode: p.job_code ?? null,
    title: p.title,
    location: `${p.location}${p.is_remote ? " · Remote" : ""}`,
    summary: p.summary,
    tags: p.tags,
    department: p.department,
    responsibilities: p.requirements,
  };
}

function Careers() {
  useAdminRedirect();
  const navigate = useNavigate();
  const { user } = useAuth();
  const submit = useServerFn(submitApplication);
  const fetchPostings = useServerFn(listActiveJobPostings);
  const { data: postings, isLoading: postingsLoading } = useQuery({
    queryKey: ["public-postings"],
    queryFn: () => fetchPostings(),
  });
  const fetchMyApps = useServerFn(listMyApplications);
  const { data: myApps } = useQuery({
    queryKey: ["my-applications", user?.id ?? "anon"],
    queryFn: () => fetchMyApps(),
    enabled: !!user,
  });
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  // Map role_id -> most recent application within the 90-day cooldown window.
  const appliedByRole = new Map<
    string,
    { status: string; is_soft_deleted: boolean; created_at: string }
  >();
  for (const a of myApps ?? []) {
    if (Date.now() - new Date(a.created_at).getTime() >= NINETY_DAYS_MS) continue;
    const existing = appliedByRole.get(a.role_id);
    if (!existing || new Date(a.created_at) > new Date(existing.created_at)) {
      appliedByRole.set(a.role_id, {
        status: a.status,
        is_soft_deleted: a.is_soft_deleted,
        created_at: a.created_at,
      });
    }
  }
  function getRoleAppState(
    roleId: string,
  ): { locked: boolean; label: string; daysLeft: number } | null {
    const app = appliedByRole.get(roleId);
    if (!app) return null;
    const daysLeft = Math.max(
      1,
      Math.ceil(
        (new Date(app.created_at).getTime() + NINETY_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000),
      ),
    );
    const isRejected = app.is_soft_deleted || app.status === "rejected";
    if (isRejected) {
      return { locked: true, label: `Not selected — re-apply in ${daysLeft}d`, daysLeft };
    }
    return { locked: true, label: "Already applied", daysLeft };
  }
  const roles: Role[] = (postings ?? []).map(toRole);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("all");
  const departments = Array.from(new Set(roles.map((r) => r.department))).sort();
  const filteredRoles = roles.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q));
    const matchesD = dept === "all" || r.department === dept;
    return matchesQ && matchesD;
  });
  const [applying, setApplying] = useState<Role | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Role | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [hp, setHp] = useState("");

  useEffect(() => {
    if (user) {
      setName((prev) => prev || displayName(user));
      setEmail((prev) => prev || user.email || "");
    }
  }, [user]);

  function trackEvent(name: string, payload: Record<string, unknown>) {
    try {
      const w = window as unknown as {
        dataLayer?: Array<Record<string, unknown>>;
        gtag?: (...args: unknown[]) => void;
      };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: name, ...payload });
      w.gtag?.("event", name, payload);

      console.info("[analytics]", name, payload);
    } catch {
      // no-op
    }
  }

  function openApply(role: Role) {
    if (!user) {
      toast.info("Sign in to apply for this role.");
      navigate({ to: "/auth", search: { redirect: "/careers" } });
      return;
    }
    const state = getRoleAppState(role.id);
    if (state?.locked) {
      toast.info(state.label);
      return;
    }
    setResumeFile(null);
    setResumeUrl("");
    setPortfolio("");
    setApplying(role);
    trackEvent("apply_start", { role_id: role.id, role_title: role.title });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    if (!resumeFile && !resumeUrl.trim()) {
      toast.error("Please upload a resume or provide a resume link.");
      return;
    }
    setSubmitting(true);
    const submittedFor = applying;
    trackEvent("apply_submit", {
      role_id: submittedFor?.id,
      role_title: submittedFor?.title,
      resume_type: resumeFile ? "upload" : "link",
    });

    try {
      let storagePath = "";
      if (resumeFile) {
        const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        storagePath = `${user.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("resumes")
          .upload(storagePath, resumeFile, {
            upsert: false,
            contentType: resumeFile.type || undefined,
          });
        if (upErr) throw new Error(`Resume upload failed: ${upErr.message}`);
      }

      await submit({
        data: {
          roleId: submittedFor!.id,
          roleTitle: submittedFor!.title,
          fullName: name.trim(),
          email: email.trim(),
          portfolioUrl: portfolio.trim() || "",
          resumeStoragePath: storagePath || "",
          resumeLink: resumeUrl.trim() || "",
          turnstileToken,
          hp,
        },
      });

      setSubmitting(false);
      setApplying(null);
      setSuccess(submittedFor);
      trackEvent("apply_success", { role_id: submittedFor?.id, role_title: submittedFor?.title });
      toast.success(`Application received for ${submittedFor?.title}.`);
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
      trackEvent("apply_error", { role_id: submittedFor?.id, error: msg });
    }
  }

  const jobPostingJsonLd = roles.map((r) => ({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: r.title,
    description: r.summary,
    identifier: {
      "@type": "PropertyValue",
      name: "Ciago Technologies",
      value: r.jobCode ?? r.id,
    },
    employmentType: "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: "Ciago Technologies",
      sameAs: "https://ciago-vision-hub.lovable.app",
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: r.location },
    },
    datePosted: new Date().toISOString().slice(0, 10),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {jobPostingJsonLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
        />
      )}
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--brand)_20%,transparent),transparent_70%)]"
          />
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">Careers</p>
              <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Join Ciago:{" "}
                <span className="brand-gradient-text">Architecting High-Performance Systems.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
                We're a senior, remote-first team building platforms that outlast trends. If you
                care about craft, scale and shipping — we'd love to meet you.
              </p>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground">
                Every engineer owns their work end-to-end — from architecture and code to on-call
                and postmortems. No proxy management, no ticket shuffling, no busywork. Just senior
                peers, real ownership and platforms that ship to production every week.
              </p>
              <div className="mt-8 flex flex-wrap gap-6 text-sm">
                {[
                  { k: "Remote-first", v: "Global team, async by default" },
                  { k: "Senior-only", v: "8+ yrs average experience" },
                  { k: "Own the roadmap", v: "Ship weekly, on-call together" },
                ].map((s) => (
                  <div key={s.k}>
                    <p className="font-semibold text-brand">{s.k}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand/25 via-transparent to-brand-glow/10 blur-3xl" />
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-brand/10">
                <IllusCareers className="mx-auto w-full max-w-md" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Go", "Kubernetes", "SRE", "Remote"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-brand/40 bg-brand/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                  Life at Ciago
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  A senior team, on a mission to keep learning.
                </h2>
              </div>
              <div className="space-y-5 text-base leading-relaxed text-muted-foreground">
                <p>
                  Ciago is deliberately small at every seniority level. Every engineer runs their
                  own work with real ownership — no ticket-shuffling, no proxy management, no
                  busywork.
                </p>
                <p>
                  We ship async across time zones, protect deep-work time fiercely, and meet in
                  person every quarter to design what's next. Fridays are for review, learning and
                  open-source contributions.
                </p>
                <p>
                  You'll pair with people who've shipped the thing before, on stacks (Go,
                  Kubernetes, AWS, Three.js) that you'd choose anyway. And when you disagree with a
                  decision, you're expected to say so — early and loudly.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/30 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">Benefits</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Perks that respect your time.
              </h2>
            </div>
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {perks.map(({ icon: I, title, desc }) => (
                <Card
                  key={title}
                  className="group border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-xl hover:shadow-brand/10"
                >
                  <CardContent className="p-6">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                      <I className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                Open roles
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Come build with us.
              </h2>
              {!user && (
                <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
                  You'll need an account to apply.{" "}
                  <Link
                    to="/auth"
                    search={{ redirect: "/careers" }}
                    className="font-semibold text-brand hover:underline"
                  >
                    Sign in or create one
                  </Link>{" "}
                  — it takes a minute.
                </p>
              )}
            </div>
            {postingsLoading ? (
              <div className="mt-10 grid gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl border border-border bg-card"
                  />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <Card className="mt-10 border-dashed">
                <CardContent className="p-10 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">No open roles right now</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                    We're not actively hiring today, but always keen to meet great engineers. Say
                    hello and we'll be in touch when a role opens.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="mt-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search roles, stacks, keywords…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDept("all")}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        dept === "all"
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground"
                      }`}
                    >
                      All ({roles.length})
                    </button>
                    {departments.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDept(d)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          dept === d
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredRoles.length === 0 ? (
                  <p className="mt-10 text-center text-sm text-muted-foreground">
                    No roles match those filters. Try clearing your search.
                  </p>
                ) : (
                  <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                    {filteredRoles.map((role) => {
                      const appState = getRoleAppState(role.id);
                      const locked = !!appState?.locked;
                      const isRejectedLock = locked && appState!.label.startsWith("Not selected");
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => openApply(role)}
                          aria-disabled={locked}
                          className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            locked
                              ? "cursor-not-allowed border-border/70 bg-muted/30 opacity-80"
                              : "border-border bg-card hover:-translate-y-1 hover:border-brand hover:shadow-2xl hover:shadow-brand/10"
                          }`}
                        >
                          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-brand/40 bg-brand/5 text-[10px] uppercase tracking-widest text-brand"
                                >
                                  {role.department}
                                </Badge>
                                {locked && (
                                  <Badge
                                    variant="outline"
                                    className={`border text-[10px] uppercase tracking-widest ${
                                      isRejectedLock
                                        ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {isRejectedLock ? "Not selected" : "Applied"}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="mt-3 text-lg font-black tracking-tight">
                                {role.title}
                              </h3>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {role.location}
                              </p>
                              {role.jobCode && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(role.jobCode!);
                                      toast.success(`Job ID ${role.jobCode} copied`);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(role.jobCode!);
                                        toast.success(`Job ID ${role.jobCode} copied`);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand"
                                  >
                                    <Hash className="h-3 w-3" />
                                    {role.jobCode}
                                    <Copy className="h-3 w-3" />
                                  </span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = `${window.location.origin}/careers?job=${role.jobCode}`;
                                      navigator.clipboard.writeText(url);
                                      toast.success("Shareable link copied");
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const url = `${window.location.origin}/careers?job=${role.jobCode}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success("Shareable link copied");
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-brand hover:text-brand"
                                    aria-label="Copy shareable link"
                                  >
                                    <Copy className="h-3 w-3" />
                                    Share
                                  </span>
                                </div>
                              )}
                            </div>
                            {!locked && (
                              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-brand" />
                            )}
                          </div>
                          <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
                            {role.summary}
                          </p>
                          {role.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {role.tags.slice(0, 5).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:border-brand/40 group-hover:text-brand"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          <p
                            className={`mt-5 flex items-center gap-1 text-xs font-semibold ${
                              locked
                                ? isRejectedLock
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                                : "text-brand"
                            }`}
                          >
                            {locked ? (
                              <>{appState!.label}</>
                            ) : user ? (
                              <>
                                Apply now <Sparkles className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                Sign in to apply <LogIn className="h-3 w-3" />
                              </>
                            )}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <Dialog open={!!applying} onOpenChange={(v) => !v && setApplying(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply — {applying?.title}</DialogTitle>
            <DialogDescription>
              Send us your details and we'll respond within one business day.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-name">Name</Label>
              <Input
                id="a-name"
                name="name"
                required
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-email">Email</Label>
              <Input
                id="a-email"
                name="email"
                type="email"
                required
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Resume{" "}
                  <span className="text-muted-foreground">
                    (upload or link — at least one required)
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-resume-file" className="text-xs text-muted-foreground">
                  Upload resume (PDF, DOC, DOCX)
                </Label>
                <Input
                  id="a-resume-file"
                  name="resume_file"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  disabled={!!resumeUrl.trim()}
                />
              </div>
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or{" "}
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-resume-url" className="text-xs text-muted-foreground">
                  Resume link (Google Drive, Dropbox, personal site…)
                </Label>
                <Input
                  id="a-resume-url"
                  name="resume_url"
                  type="url"
                  placeholder="https://…"
                  value={resumeUrl}
                  onChange={(e) => setResumeUrl(e.target.value)}
                  disabled={!!resumeFile}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-portfolio">Portfolio / GitHub</Label>
              <Input
                id="a-portfolio"
                name="portfolio"
                type="url"
                placeholder="https://github.com/…"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
              />
            </div>

            {/* Honeypot — hidden from users, visible to naive bots */}
            <div aria-hidden className="hidden" style={{ position: "absolute", left: "-10000px" }}>
              <label>
                Company website (leave blank)
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
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
              >
                {submitting ? "Sending…" : "Submit application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!success} onOpenChange={(v) => !v && setSuccess(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand ring-4 ring-brand/5">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </div>
            <DialogTitle className="text-center text-xl">Application received</DialogTitle>
            <DialogDescription className="text-center">
              Thanks for applying to{" "}
              <span className="font-semibold text-foreground">{success?.title}</span>. A senior
              engineer will review your details and get back to you within one business day.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What happens next</p>
            <ul className="mt-2 space-y-1.5">
              <li>• We review your resume and links within 1 business day.</li>
              <li>• If it's a fit, we book a 30-min intro call.</li>
              <li>• Then a paid technical deep-dive with the team.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setSuccess(null)}
              className="w-full bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              Back to careers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />

      <Toaster />
    </div>
  );
}
