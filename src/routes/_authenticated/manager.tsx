import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  ClipboardList,
  CalendarClock,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  decideLeaveRequest,
  listPendingLeaveRequests,
  type PendingLeaveRow,
} from "@/lib/leave.functions";
import { decideRegularization, listPendingRegularizations } from "@/lib/attendance.functions";
import { listMyReports, listInternalJobs, type InternalJob } from "@/lib/mobility.functions";
import { listAllResignations, decideResignation } from "@/lib/resignation.functions";
import { requireRoles, requireDashboardEnabled } from "./-guard";

const searchSchema = z.object({
  tab: z.enum(["team", "tasks", "approvals", "internal-careers", "resignations"]).optional(),
});

export const Route = createFileRoute("/_authenticated/manager")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { roles } = await requireRoles("/manager");
    if (!roles.has("manager") && !roles.has("admin")) {
      throw redirect({ to: "/forbidden", search: { reason: "role" } });
    }
  },
  head: () => ({
    meta: [
      { title: "Manager Portal | Ciago Technologies" },
      {
        name: "description",
        content:
          "Ciago Technologies manager portal — team leadership, leave approvals, and delegation.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ManagerPortal,
});

const LEAVE_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  cancelled: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
};

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
}

function ManagerPortal() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const tab = search.tab ?? "team";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="portal-shell sm:p-10">
          <p className="portal-eyebrow">Manager Portal</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Lead your team</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Review pending time-off requests, keep your team unblocked, and monitor exits.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => nav({ to: "/manager" as any, search: { tab: v } as any })}
          className="mt-8"
        >
          <TabsList className="portal-tablist w-full justify-start">
            <TabsTrigger value="team" className="portal-tab">
              <Users /> Team
            </TabsTrigger>
            <TabsTrigger value="approvals" className="portal-tab">
              <CalendarClock /> Approvals
            </TabsTrigger>
            <TabsTrigger value="tasks" className="portal-tab">
              <ClipboardList /> Tasks
            </TabsTrigger>
            <TabsTrigger value="internal-careers" className="portal-tab">
              <Briefcase /> Internal Careers
            </TabsTrigger>
            <TabsTrigger value="resignations" className="portal-tab">
              <LogOut /> Resignations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Team</h2>
                <p className="text-sm text-muted-foreground">
                  Direct reports and peers in your department.
                </p>
              </div>
              <Badge variant="outline" className="border-brand/40 text-brand">
                <Users className="mr-1 h-3 w-3" /> Directory
              </Badge>
            </div>
            <TeamPanel />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6 space-y-10">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Leave Approvals</h2>
                  <p className="text-sm text-muted-foreground">
                    Pending PTO requests from your department.
                  </p>
                </div>
                <Badge variant="outline" className="border-brand/40 text-brand">
                  <CalendarClock className="mr-1 h-3 w-3" /> Live queue
                </Badge>
              </div>
              <LeaveApprovalsPanel />
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Attendance Regularizations</h2>
                  <p className="text-sm text-muted-foreground">
                    Approve or reject missed-punch requests from your team.
                  </p>
                </div>
                <Badge variant="outline" className="border-brand/40 text-brand">
                  <Clock className="mr-1 h-3 w-3" /> Pending
                </Badge>
              </div>
              <RegularizationApprovalsPanel />
            </section>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <ManagerPortalStub
              title="Task Delegation"
              description="Assign work to your direct reports and track status through the Admin task workspace."
              ctaLabel="Open Tasks workspace"
              ctaTo="/admin"
              ctaSearch={{ tab: "tasks" }}
            />
          </TabsContent>

          <TabsContent value="internal-careers" className="mt-6">
            <ManagerInternalCareersPanel />
          </TabsContent>

          <TabsContent value="resignations" className="mt-6">
            <div className="mb-3">
              <h2 className="text-xl font-bold tracking-tight">Resignations</h2>
              <p className="text-sm text-muted-foreground">
                Read-only view — HR takes the final decision.
              </p>
            </div>
            <ResignationsListPanel readOnly />
          </TabsContent>
        </Tabs>

        <p className="mt-10 text-xs text-muted-foreground">
          Need a different area? Go to your{" "}
          <Link to="/profile" className="underline hover:text-brand">
            Profile
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

function ManagerPortalStub({
  title,
  description,
  ctaLabel,
  ctaTo,
  ctaSearch,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  ctaSearch?: Record<string, string>;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        <Button asChild className="mt-4 bg-brand text-brand-foreground hover:bg-brand-glow">
          <Link to={ctaTo as any} search={ctaSearch as any}>
            {ctaLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function TeamPanel() {
  const listFn = useServerFn(listMyReports);
  const q = useQuery({ queryKey: ["my-reports"], queryFn: () => listFn() });
  const rows = q.data ?? [];
  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No department teammates found. Ask an admin to assign you a department.
        </CardContent>
      </Card>
    );
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((r: any) => (
        <li
          key={r.user_id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
        >
          <div>
            <p className="text-sm font-semibold">{r.full_name ?? r.user_id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground capitalize">{r.role}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Dept
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function ResignationsListPanel({ readOnly = false }: { readOnly?: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllResignations);
  const { data, isLoading } = useQuery({ queryKey: ["all-resignations"], queryFn: () => listFn() });
  const [pick, setPick] = useState<{
    id: string;
    decision: "accepted" | "rejected";
    name: string;
  } | null>(null);
  const [note, setNote] = useState("");
  const decideFn = useServerFn(decideResignation);
  const decide = useMutation({
    mutationFn: (p: any) => decideFn({ data: p }),
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["all-resignations"] });
      setPick(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const rows = (data ?? []) as any[];
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No resignations on file.
        </CardContent>
      </Card>
    );
  return (
    <div>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">
                    {r.applicant_name ?? r.user_id.slice(0, 8)}
                  </p>
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {r.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted {new Date(r.submitted_on).toLocaleDateString()} · LWD{" "}
                  <strong>{new Date(r.last_working_day).toLocaleDateString()}</strong>
                </p>
                {r.reason && <p className="mt-1 text-xs">"{r.reason}"</p>}
                {r.decision_note && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong>HR note:</strong> {r.decision_note}
                  </p>
                )}
              </div>
              {!readOnly && r.status === "pending" && (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPick({ id: r.id, decision: "rejected", name: r.applicant_name ?? "" });
                      setNote("");
                    }}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-brand text-brand-foreground hover:bg-brand-glow"
                    onClick={() => {
                      setPick({ id: r.id, decision: "accepted", name: r.applicant_name ?? "" });
                      setNote("");
                    }}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accept
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pick?.decision === "accepted" ? "Accept resignation" : "Reject resignation"}
            </DialogTitle>
            <DialogDescription>{pick?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for the employee"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPick(null)}>
              Cancel
            </Button>
            <Button
              disabled={decide.isPending}
              variant={pick?.decision === "rejected" ? "destructive" : "default"}
              className={
                pick?.decision === "accepted"
                  ? "bg-brand text-brand-foreground hover:bg-brand-glow"
                  : ""
              }
              onClick={() =>
                pick &&
                decide.mutate({
                  id: pick.id,
                  decision: pick.decision,
                  decision_note: note.trim() || null,
                })
              }
            >
              {decide.isPending ? "Saving…" : pick?.decision === "accepted" ? "Accept" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LeaveApprovalsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingLeaveRequests);
  const decideFn = useServerFn(decideLeaveRequest);
  const { data, isLoading } = useQuery({
    queryKey: ["leave-queue"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });

  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [decisionOpen, setDecisionOpen] = useState<{
    row: PendingLeaveRow;
    decision: "approved" | "rejected";
  } | null>(null);
  const [note, setNote] = useState("");

  const decide = useMutation({
    mutationFn: (p: any) => decideFn({ data: p }),
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["leave-queue"] });
      setDecisionOpen(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const rows = (data ?? []).filter((r) =>
    statusFilter === "pending" ? r.status === "pending" : true,
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={statusFilter === "pending" ? "default" : "outline"}
          onClick={() => setStatusFilter("pending")}
          className={
            statusFilter === "pending" ? "bg-brand text-brand-foreground hover:bg-brand-glow" : ""
          }
        >
          <Clock className="mr-1 h-3.5 w-3.5" /> Pending only
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
          className={
            statusFilter === "all" ? "bg-brand text-brand-foreground hover:bg-brand-glow" : ""
          }
        >
          All history
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No {statusFilter === "pending" ? "pending" : ""} leave requests in your scope.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                      {r.applicant_name ?? r.applicant_email ?? "Unknown"}
                    </p>
                    <Badge
                      variant="outline"
                      className={`border text-[10px] ${LEAVE_STATUS_STYLE[r.status] ?? ""}`}
                    >
                      {r.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {r.leave_type}
                    </Badge>
                  </div>
                  {r.applicant_email && (
                    <p className="text-xs text-muted-foreground">{r.applicant_email}</p>
                  )}
                  <p className="mt-1 text-xs">
                    {new Date(r.start_date).toLocaleDateString()} →{" "}
                    {new Date(r.end_date).toLocaleDateString()} ·{" "}
                    <strong>{daysBetween(r.start_date, r.end_date)} day(s)</strong>
                  </p>
                  {r.reason && <p className="mt-1 text-xs text-muted-foreground">"{r.reason}"</p>}
                  {r.decision_note && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Decision note:</strong> {r.decision_note}
                    </p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDecisionOpen({ row: r, decision: "rejected" });
                        setNote("");
                      }}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-brand text-brand-foreground hover:bg-brand-glow"
                      onClick={() => {
                        setDecisionOpen({ row: r, decision: "approved" });
                        setNote("");
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!decisionOpen} onOpenChange={(o) => !o && setDecisionOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionOpen?.decision === "approved" ? "Approve leave" : "Reject leave"}
            </DialogTitle>
            <DialogDescription>
              {decisionOpen && (
                <>
                  {decisionOpen.row.applicant_name ?? decisionOpen.row.applicant_email} ·{" "}
                  {new Date(decisionOpen.row.start_date).toLocaleDateString()} →{" "}
                  {new Date(decisionOpen.row.end_date).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Communicate context to the requester"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(null)}>
              Cancel
            </Button>
            <Button
              disabled={decide.isPending}
              className={
                decisionOpen?.decision === "approved"
                  ? "bg-brand text-brand-foreground hover:bg-brand-glow"
                  : ""
              }
              variant={decisionOpen?.decision === "rejected" ? "destructive" : "default"}
              onClick={() =>
                decisionOpen &&
                decide.mutate({
                  id: decisionOpen.row.id,
                  decision: decisionOpen.decision,
                  decision_note: note.trim() || null,
                })
              }
            >
              {decide.isPending
                ? "Saving…"
                : decisionOpen?.decision === "approved"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Keep this as an unused helper export marker; imports use named export above.
export type { PendingLeaveRow };

export function RegularizationApprovalsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingRegularizations);
  const decideFn = useServerFn(decideRegularization);
  const { data, isLoading } = useQuery({
    queryKey: ["pending-regularizations"],
    queryFn: () => listFn(),
  });
  const decide = useMutation({
    mutationFn: (p: { id: string; approve: boolean }) => decideFn({ data: p }),
    onSuccess: () => {
      toast.success("Recorded");
      qc.invalidateQueries({ queryKey: ["pending-regularizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = (data ?? []) as Array<{
    id: string;
    work_date: string;
    regularization_reason: string | null;
    applicant_name: string | null;
    user_id: string;
  }>;
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No regularization requests pending.
        </CardContent>
      </Card>
    );
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {r.applicant_name ?? r.user_id.slice(0, 8)} ·{" "}
                <span className="font-mono text-xs">{r.work_date}</span>
              </p>
              {r.regularization_reason && (
                <p className="mt-1 text-xs text-muted-foreground">"{r.regularization_reason}"</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide.mutate({ id: r.id, approve: false })}
                disabled={decide.isPending}
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={() => decide.mutate({ id: r.id, approve: true })}
                disabled={decide.isPending}
                className="bg-brand text-brand-foreground hover:bg-brand-glow"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ManagerInternalCareersPanel() {
  const listFn = useServerFn(listInternalJobs);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["manager-internal-jobs", q],
    queryFn: () => listFn({ data: { q } }),
  });
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Internal openings</h3>
            <p className="text-sm text-muted-foreground">
              Nominate a report or share these with your team.
            </p>
          </div>
          <Input
            placeholder="Search by title, department, code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (data ?? []).length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No active openings.</div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {(data ?? []).map((job: InternalJob) => (
              <li key={job.id} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{job.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.department ?? "—"} · {job.is_remote ? "Remote" : (job.location ?? "—")}
                    </div>
                  </div>
                  {job.job_code && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {job.job_code}
                    </Badge>
                  )}
                </div>
                {job.summary && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{job.summary}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {(job.tags ?? []).slice(0, 5).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
