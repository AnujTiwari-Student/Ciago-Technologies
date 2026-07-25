import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowUpRight, Briefcase, Clock, Copy, ExternalLink, Hash, XCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { listMyApplications } from "@/lib/applications.query";
import { withdrawMyApplication } from "@/lib/profile.functions";
import { getMyOnboarding } from "@/lib/onboarding.functions";
import { useMyRoles } from "@/hooks/use-my-roles";

export const Route = createFileRoute("/_authenticated/my-applications")({
  head: () => ({
    meta: [
      { title: "My Applications | Ciago Technologies" },
      { name: "description", content: "Track the status of your Ciago Technologies job applications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyApplicationsPage,
});

const STATUS_META: Record<string, { label: string; className: string }> = {
  applied: { label: "Applied", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  screening: { label: "Screening", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  interviewing: { label: "Interviewing", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  offered: { label: "Offer Extended", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  hired: { label: "Hired", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  rejected: { label: "Not Progressing", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
};

function MyApplicationsPage() {
  const qc = useQueryClient();
  const fetchApps = useServerFn(listMyApplications);
  const withdrawFn = useServerFn(withdrawMyApplication);
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const { isStaff } = useMyRoles();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => fetchApps(),
    retry: 1,
  });
  const { data: onboarding } = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOnboarding(),
    enabled: !isStaff,
  });
  // Banner hidden for any elevated role — staff never see candidate onboarding CTAs.
  const onboardingComplete =
    isStaff ||
    (!!onboarding?.onboarding &&
      (onboarding.onboarding.verification_status === "approved" ||
        !!onboarding.onboarding.doj));

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => withdrawFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Application withdrawn");
      qc.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (e: any) => toast.error(e?.message || "Withdraw failed"),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">Dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">My applications</h1>
            <p className="mt-2 text-muted-foreground">
              Track every role you've applied for at Ciago Technologies.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/careers">
              Browse open roles <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {!onboardingComplete && data?.some((a) => a.status === "offered" && !a.is_soft_deleted) && (
          <Card className="mt-8 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-brand/10 to-brand/5">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  🎉 Offer extended
                </p>
                <h2 className="mt-1 text-lg font-bold">Complete your onboarding & accept your offer</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review your offer letter, submit onboarding details and unlock the Employee Portal.
                </p>
              </div>
              <Button asChild className="shrink-0 bg-brand text-brand-foreground hover:bg-brand-glow">
                <Link to="/onboarding">Complete onboarding <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!isStaff && onboarding?.onboarding?.status === "submitted" && (
          <Card className="mt-8 border-brand/40 bg-gradient-to-br from-brand/10 via-brand/5 to-transparent">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                  Paperwork submitted
                </p>
                <h2 className="mt-1 text-lg font-bold">
                  {onboarding.onboarding.doj
                    ? "Your Date of Joining is set"
                    : "Awaiting your Date of Joining"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  HR is verifying your documents. Open the Employee Portal for a live countdown and onboarding status.
                </p>
              </div>
              <Button asChild variant="outline" className="shrink-0 border-brand/40 text-brand hover:bg-brand/10">
                <Link to="/employee">Open Employee Portal <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          ) : error ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-6 text-sm text-destructive">
                Couldn't load your applications. Please refresh.
              </CardContent>
            </Card>
          ) : !data || data.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-bold">No applications yet</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  When you apply for a role, you'll be able to track its status here.
                </p>
                <Button asChild className="mt-6 bg-brand text-brand-foreground hover:bg-brand-glow">
                  <Link to="/careers">View open roles</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {data.map((a) => {
                const isSoftDeleted = a.is_soft_deleted;
                const meta = isSoftDeleted
                  ? STATUS_META.rejected
                  : STATUS_META[a.status] ?? STATUS_META.applied;
                const canWithdraw = a.status === "applied" && !isSoftDeleted;
                const isPendingWithdraw =
                  withdrawMutation.isPending && withdrawMutation.variables === a.id;
                const daysLeft = a.deleted_at
                  ? Math.max(
                      0,
                      90 -
                        Math.floor(
                          (Date.now() - new Date(a.deleted_at).getTime()) /
                            (24 * 60 * 60 * 1000),
                        ),
                    )
                  : null;
                return (
                  <Card
                    key={a.id}
                    className={`border-border transition-colors ${
                      isSoftDeleted ? "opacity-90" : "hover:border-brand/60"
                    }`}
                  >
                    <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{a.role_title}</h3>
                          <Badge variant="outline" className={`border ${meta.className}`}>
                            {meta.label}
                          </Badge>
                        </div>
                        {a.job_code && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(a.job_code!);
                              toast.success(`Job ID ${a.job_code} copied`);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand"
                          >
                            <Hash className="h-3 w-3" />
                            {a.job_code}
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          Submitted {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        {(() => {
                          const cooldownMs = new Date(a.next_eligible_at).getTime() - Date.now();
                          if (cooldownMs <= 0) return null;
                          const cdDays = Math.max(1, Math.ceil(cooldownMs / (24 * 60 * 60 * 1000)));
                          return (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Re-apply eligible in <span className="font-semibold text-foreground">{cdDays} day{cdDays === 1 ? "" : "s"}</span>
                              {" · "}
                              {new Date(a.next_eligible_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          );
                        })()}
                        {isSoftDeleted && daysLeft !== null && (
                          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                            This record will be permanently removed in {daysLeft} day{daysLeft === 1 ? "" : "s"}.
                          </p>
                        )}
                        {a.portfolio_url && !isSoftDeleted && (
                          <a
                            href={a.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                          >
                            Portfolio <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {canWithdraw && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              disabled={isPendingWithdraw}
                            >
                              <XCircle className="mr-1.5 h-4 w-4" />
                              {isPendingWithdraw ? "Withdrawing…" : "Withdraw"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Withdraw your application?</AlertDialogTitle>
                              <AlertDialogDescription>
                                We'll immediately remove your application for{" "}
                                <span className="font-semibold text-foreground">{a.role_title}</span>{" "}
                                and delete your uploaded resume from our storage. You can re-apply anytime while the role is open.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep application</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-rose-600 hover:bg-rose-500 focus:ring-rose-500"
                                onClick={() => withdrawMutation.mutate(a.id)}
                              >
                                Yes, withdraw
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
