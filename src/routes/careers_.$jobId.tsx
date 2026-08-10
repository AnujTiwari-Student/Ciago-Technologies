import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  Globe,
  MapPin,
  IndianRupee,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { useAuth } from "@/lib/auth";
import { getJobPostingById } from "@/lib/core-info.functions";
import { listMyApplications } from "@/lib/applications.query";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/careers_/$jobId")({
  head: ({ params }) => ({
    meta: [
      { title: `Job Details — Ciago Technologies` },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchPosting = useServerFn(getJobPostingById);
  const { data: posting, isLoading } = useQuery({
    queryKey: ["job-posting", jobId],
    queryFn: () => fetchPosting({ data: { jobId } }),
  });

  const fetchMyApps = useServerFn(listMyApplications);
  const { data: myApps } = useQuery({
    queryKey: ["my-applications", user?.id ?? "anon"],
    queryFn: () => fetchMyApps(),
    enabled: !!user,
  });

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const existingApp = (myApps ?? []).find(
    (a) =>
      a.role_id === jobId &&
      Date.now() - new Date(a.created_at).getTime() < NINETY_DAYS_MS,
  );
  const isLocked = !!existingApp;

  function handleApply() {
    if (!user) {
      toast.info("Sign in to apply for this role.");
      navigate({ to: "/auth", search: { redirect: `/careers/${jobId}` } });
      return;
    }
    if (isLocked) {
      toast.info("You've already applied for this role.");
      return;
    }
    navigate({ to: "/careers/$jobId/apply", params: { jobId } });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-16">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-6 w-96 animate-pulse rounded bg-muted" />
            <div className="h-64 animate-pulse rounded bg-muted" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!posting) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Job not found</h1>
          <p className="mt-2 text-muted-foreground">
            This position may have been closed or removed.
          </p>
          <Link to="/careers" className="mt-6">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all positions
            </Button>
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        <Link
          to="/careers"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          All positions
        </Link>

        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{posting.department}</Badge>
              <Badge variant="outline">{posting.employmentType}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {posting.title}
            </h1>
            {posting.designation && (
              <p className="mt-1 text-lg text-muted-foreground">
                {posting.designation}
              </p>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {posting.location}
              {posting.isRemote && " · Remote"}
            </span>
            {posting.publishSalaryRange && posting.salaryMinInr && (
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="h-4 w-4" />
                {formatSalary(posting.salaryMinInr, posting.salaryMaxInr)} /{" "}
                {posting.salaryPaidPer}
              </span>
            )}
            {posting.closesOn && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Closes{" "}
                {new Date(posting.closesOn).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {posting.jobCode && (
              <span className="inline-flex items-center gap-1">
                <Tag className="h-4 w-4" />
                {posting.jobCode}
              </span>
            )}
          </div>

          {/* Apply button - top */}
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              onClick={handleApply}
              disabled={isLocked}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {isLocked ? "Already Applied" : "Apply for this position"}
            </Button>
            {isLocked && existingApp && (
              <span className="text-sm text-muted-foreground">
                Applied{" "}
                {new Date(existingApp.created_at).toLocaleDateString("en-IN")}
              </span>
            )}
          </div>

          {/* Description */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-xl font-semibold">About this role</h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: formatDescription(posting.description) }}
              />
            </CardContent>
          </Card>

          {/* Requirements */}
          {posting.requirements.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-4 text-xl font-semibold">Requirements</h2>
                <ul className="space-y-2">
                  {posting.requirements.map((req, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {posting.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {posting.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Apply button - bottom */}
          <div className="border-t pt-6">
            <Button
              size="lg"
              onClick={handleApply}
              disabled={isLocked}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {isLocked ? "Already Applied" : "Apply now"}
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

function formatSalary(min: number | null, max: number | null): string {
  const fmt = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return "";
}

function formatDescription(desc: string): string {
  return desc
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<br/>";
      return `<p>${line}</p>`;
    })
    .join("");
}
