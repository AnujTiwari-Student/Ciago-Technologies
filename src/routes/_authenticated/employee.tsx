import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Download,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  Receipt,
  Settings,
  Sparkles,
  Trash2,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { useAuth, displayName } from "@/lib/auth";
import {
  createReferral,
  deleteMyTask,
  deleteTimesheet,
  listMyReferrals,
  listMyTasks,
  listMyTimesheets,
  logTimesheet,
  updateMyTaskStatus,
  upsertMyTask,
  type EmployeeTask,
  type Referral,
  type Timesheet,
} from "@/lib/employee.functions";
import {
  cancelMyLeaveRequest,
  listMyLeaveRequests,
  submitLeaveRequest,
  type LeaveRequest,
} from "@/lib/leave.functions";
import {
  checkInToday,
  checkOutToday,
  listMyAttendance,
  requestRegularization,
  type AttendanceRecord,
} from "@/lib/attendance.functions";
import {
  getMySalaryStructure,
  listMySalarySlips,
  type SalarySlip,
  type SalaryStructure,
} from "@/lib/payroll.functions";
import { listActiveJobPostings } from "@/lib/jobPostings.functions";
import { listInternalJobs as _listInternalJobs } from "@/lib/mobility.functions";
import {
  listMyResignation as _listMyResignation,
  submitResignation as _submitResignation,
  withdrawResignation as _withdrawResignation,
} from "@/lib/resignation.functions";
import { getMyOnboarding } from "@/lib/onboarding.functions";
import { DojHoldingScreen, shouldShowDojHold } from "@/components/site/DojHoldingScreen";
import { FLAGS } from "@/lib/feature-flags";
import { getMyEmployeeAccess } from "@/lib/roles.functions";
import { requireRoles } from "./-guard";

// ============================================================
// Route + access gate (employee OR admin)
// ============================================================
export const Route = createFileRoute("/_authenticated/employee")({
  ssr: false,
  validateSearch: zodValidator(
    z.object({
      tab: fallback(
        z
          .enum([
            "overview",
            "tasks",
            "timesheets",
            "attendance",
            "leave",
            "payroll",
            "referrals",
            "mobility",
            "exit",
            "settings",
          ])
          .optional(),
        undefined,
      ),
    }),
  ),
  beforeLoad: async () => {
    if (FLAGS.USE_CLERK_AUTH) {
      const access = await getMyEmployeeAccess();
      if (access.isAdmin) throw redirect({ to: "/admin" });
      if (access.isHr) throw redirect({ to: "/hr" as any });
      if (access.isManager) throw redirect({ to: "/manager" as any });
      if (!access.isEmployee && !access.hasPreDojOnboarding) {
        throw redirect({ to: "/forbidden", search: { reason: "role" } });
      }
      return { currentUserId: access.userId };
    }

    const { userId, roles } = await requireRoles("/employee");
    if (roles.has("admin")) throw redirect({ to: "/admin" });
    if (roles.has("hr")) throw redirect({ to: "/hr" as any });
    if (roles.has("manager")) throw redirect({ to: "/manager" as any });
    if (!roles.has("employee")) {
      const { data: onb } = await supabase
        .from("onboarding_records")
        .select("id, status")
        .eq("user_id", userId)
        .in("status", ["accepted", "submitted"])
        .maybeSingle();
      if (!onb) throw redirect({ to: "/forbidden", search: { reason: "role" } });
    }
    return { currentUserId: userId };
  },
  head: () => ({
    meta: [
      { title: "Employee Portal | Ciago Technologies" },
      {
        name: "description",
        content: "Ciago Technologies internal staff portal — tasks, timesheets, referrals.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EmployeePage,
});

const TASK_STATUS: Record<EmployeeTask["status"], { label: string; className: string }> = {
  to_do: {
    label: "To Do",
    className: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  blocked: {
    label: "Blocked",
    className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  done: {
    label: "Done",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
};

const PRIORITY_STYLE: Record<EmployeeTask["priority"], string> = {
  low: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  medium: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  urgent: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

const REFERRAL_STYLE: Record<Referral["referral_status"], string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  interviewing: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  hired: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

const NAV = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    desc: "Today's schedule and pending work at a glance.",
  },
  {
    key: "tasks",
    label: "My Tasks",
    icon: ClipboardList,
    desc: "Active deliverables and Kanban workspace.",
  },
  {
    key: "timesheets",
    label: "Timesheets",
    icon: CalendarClock,
    desc: "Log hours against active projects.",
  },
  {
    key: "attendance",
    label: "Attendance",
    icon: Clock,
    desc: "Daily check-in / out and regularization.",
  },
  {
    key: "leave",
    label: "Leave & PTO",
    icon: CalendarDays,
    desc: "Request time off and track approvals.",
  },
  {
    key: "payroll",
    label: "Payroll",
    icon: Receipt,
    desc: "Monthly salary slips and compensation.",
  },
  {
    key: "referrals",
    label: "Referral Hub",
    icon: UserPlus,
    desc: "Refer candidates for open roles.",
  },
  {
    key: "mobility",
    label: "Internal Careers",
    icon: Briefcase,
    desc: "Explore open roles across Ciago.",
  },
  {
    key: "exit",
    label: "Resignation",
    icon: LogOut,
    desc: "Submit or track your last working day request.",
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    desc: "Professional profile and preferences.",
  },
] as const;

type TabKey = (typeof NAV)[number]["key"];

function EmployeePage() {
  const { tab } = Route.useSearch();
  const active: TabKey = (tab as TabKey) ?? "overview";
  const { user } = useAuth();

  // DOJ Gatekeeper: if HR has set a future Date of Joining, show a polished
  // holding screen instead of the full portal until the DOJ arrives.
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const { data: onboarding } = useQuery({
    queryKey: ["my-onboarding"],
    queryFn: () => fetchOnboarding(),
    staleTime: 60_000,
  });
  const doj = onboarding?.onboarding?.doj ?? null;
  const onbStatus = onboarding?.onboarding?.status ?? null;
  const verif = onboarding?.onboarding?.verification_status ?? undefined;
  // Show the holding screen when the candidate has an onboarding record but no
  // usable DOJ yet (paperwork submitted, HR still to verify / assign a date),
  // or when the DOJ is set but still in the future.
  const awaitingDoj =
    !!onbStatus && !doj && (onbStatus === "accepted" || onbStatus === "submitted");
  if (awaitingDoj || (doj && shouldShowDojHold(doj))) {
    return (
      <DojHoldingScreen
        doj={doj}
        firstName={user ? displayName(user).split(" ")[0] : undefined}
        verificationStatus={verif}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-brand/5 p-6 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_60%_at_100%_0%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent_70%)]"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-brand">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                  Employee Portal
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Welcome back{user ? `, ${displayName(user).split(" ")[0]}` : ""}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Your workspace for tasks, hours, and internal referrals.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav
              className="grid gap-1 rounded-2xl border border-border bg-card p-2"
              aria-label="Employee"
            >
              {NAV.map((item) => {
                const isActive = active === item.key;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to="/employee"
                    search={{ tab: item.key === "overview" ? undefined : (item.key as any) }}
                    className={`portal-nav-item ${isActive ? "portal-nav-item-active" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Panel */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight">
                {NAV.find((n) => n.key === active)?.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {NAV.find((n) => n.key === active)?.desc}
              </p>
            </div>

            {active === "overview" ? (
              <OverviewPanel />
            ) : active === "tasks" ? (
              <TasksPanel />
            ) : active === "timesheets" ? (
              <TimesheetsPanel />
            ) : active === "attendance" ? (
              <AttendancePanel />
            ) : active === "leave" ? (
              <LeavePanel />
            ) : active === "payroll" ? (
              <PayrollPanel />
            ) : active === "referrals" ? (
              <ReferralsPanel />
            ) : active === "mobility" ? (
              <MobilityPanel />
            ) : active === "exit" ? (
              <ResignationPanel />
            ) : (
              <SettingsPanel />
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================
function OverviewPanel() {
  const fetchTasks = useServerFn(listMyTasks);
  const fetchTs = useServerFn(listMyTimesheets);
  const tasks = useQuery({ queryKey: ["emp-tasks"], queryFn: () => fetchTasks() });
  const ts = useQuery({ queryKey: ["emp-timesheets"], queryFn: () => fetchTs() });

  const pending = (tasks.data ?? []).filter((t) => t.status !== "done").length;
  const urgent = (tasks.data ?? []).filter(
    (t) => t.priority === "urgent" && t.status !== "done",
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayHours = (ts.data ?? [])
    .filter((t) => t.date === today)
    .reduce((a, b) => a + Number(b.hours_logged), 0);
  const weekHours = (ts.data ?? [])
    .filter((t) => {
      const d = new Date(t.date);
      const now = new Date();
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    })
    .reduce((a, b) => a + Number(b.hours_logged), 0);

  const metrics = [
    { label: "Pending Tasks", value: pending, icon: ClipboardList, accent: "text-sky-500" },
    { label: "Urgent Tasks", value: urgent, icon: Sparkles, accent: "text-rose-500" },
    { label: "Hours Today", value: todayHours.toFixed(1), icon: Clock, accent: "text-brand" },
    {
      label: "Hours (7d)",
      value: weekHours.toFixed(1),
      icon: CalendarClock,
      accent: "text-emerald-500",
    },
  ];
  const isLoading = tasks.isLoading || ts.isLoading;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((m) =>
          isLoading ? (
            <div
              key={m.label}
              className="h-24 animate-pulse rounded-2xl border border-border bg-card"
            />
          ) : (
            <Card key={m.label} className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {m.label}
                  </p>
                  <m.icon className={`h-4 w-4 ${m.accent}`} />
                </div>
                <p className="mt-3 text-3xl font-black leading-none tracking-tight">{m.value}</p>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Today's Schedule
            </h3>
            <Badge variant="outline">{today}</Badge>
          </div>
          {isLoading ? (
            <div className="mt-4 h-16 animate-pulse rounded-lg bg-muted" />
          ) : (tasks.data ?? []).filter((t) => t.due_date === today).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing due today — a clean canvas. Great time for deep work.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {(tasks.data ?? [])
                .filter((t) => t.due_date === today)
                .map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <span className="text-sm font-medium">{t.title}</span>
                    <Badge
                      variant="outline"
                      className={`border ${TASK_STATUS[t.status].className}`}
                    >
                      {TASK_STATUS[t.status].label}
                    </Badge>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Company Announcements
          </h3>
          <ul className="mt-4 grid gap-3 text-sm">
            <li className="rounded-lg border border-border bg-muted/30 p-3">
              🎉 <strong>Welcome to the Ciago team.</strong> Check the referral hub — we're hiring
              across engineering.
            </li>
            <li className="rounded-lg border border-border bg-muted/30 p-3">
              📚 Learning stipend reminder — 2026 budget refreshes on Jan 1.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// TASKS
// ============================================================
const TASK_STATUSES: EmployeeTask["status"][] = ["to_do", "in_progress", "blocked", "done"];

function TasksPanel() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listMyTasks);
  const upsertFn = useServerFn(upsertMyTask);
  const statusFn = useServerFn(updateMyTaskStatus);
  const deleteFn = useServerFn(deleteMyTask);

  const { data, isLoading } = useQuery({ queryKey: ["emp-tasks"], queryFn: () => fetchTasks() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as EmployeeTask["priority"],
    due_date: "",
  });

  const upsert = useMutation({
    mutationFn: (p: any) => upsertFn({ data: p }),
    onSuccess: () => {
      toast.success("Task saved");
      qc.invalidateQueries({ queryKey: ["emp-tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: "" });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  // Optimistic status update
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: EmployeeTask["status"] }) => statusFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["emp-tasks"] });
      const prev = qc.getQueryData<EmployeeTask[]>(["emp-tasks"]);
      qc.setQueryData<EmployeeTask[]>(["emp-tasks"], (old) =>
        (old ?? []).map((t) => (t.id === v.id ? { ...t, status: v.status } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["emp-tasks"], ctx.prev);
      toast.error("Status update failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emp-tasks"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["emp-tasks"] });
    },
  });

  const grouped = useMemo(() => {
    const g: Record<EmployeeTask["status"], EmployeeTask[]> = {
      to_do: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const t of data ?? []) g[t.status].push(t);
    return g;
  }, [data]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.length ?? 0} task{(data?.length ?? 0) === 1 ? "" : "s"}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand text-brand-foreground hover:bg-brand-glow">
              <Plus className="mr-1.5 h-4 w-4" /> New task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create task</DialogTitle>
              <DialogDescription>Add a personal deliverable to your workspace.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                upsert.mutate({
                  title: form.title.trim(),
                  description: form.description.trim() || null,
                  priority: form.priority,
                  due_date: form.due_date || null,
                  status: "to_do",
                });
              }}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="t-title">Title</Label>
                <Input
                  id="t-title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="t-desc">Description</Label>
                <Textarea
                  id="t-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="t-due">Due date</Label>
                  <Input
                    id="t-due"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={upsert.isPending}
                  className="bg-brand text-brand-foreground hover:bg-brand-glow"
                >
                  {upsert.isPending ? "Saving…" : "Create task"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {TASK_STATUSES.map((s) => (
            <div key={s} className="rounded-2xl border border-border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-widest">
                  {TASK_STATUS[s].label}
                </h4>
                <Badge variant="outline" className="h-5 border-border text-[10px]">
                  {grouped[s].length}
                </Badge>
              </div>
              <div className="grid gap-2">
                {grouped[s].length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                ) : (
                  grouped[s].map((t) => (
                    <Card key={t.id} className="border-border bg-card">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">{t.title}</p>
                          <button
                            onClick={() => del.mutate(t.id)}
                            className="text-muted-foreground hover:text-rose-500"
                            aria-label="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {t.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`border text-[10px] ${PRIORITY_STYLE[t.priority]}`}
                          >
                            {t.priority}
                          </Badge>
                          {t.due_date && (
                            <span className="text-[10px] text-muted-foreground">
                              Due {new Date(t.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <Select
                          value={t.status}
                          onValueChange={(v) => statusMut.mutate({ id: t.id, status: v as any })}
                        >
                          <SelectTrigger className="mt-2 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s2) => (
                              <SelectItem key={s2} value={s2} className="text-xs">
                                {TASK_STATUS[s2].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TIMESHEETS
// ============================================================
function TimesheetsPanel() {
  const qc = useQueryClient();
  const fetchTs = useServerFn(listMyTimesheets);
  const logFn = useServerFn(logTimesheet);
  const delFn = useServerFn(deleteTimesheet);
  const { data, isLoading } = useQuery({ queryKey: ["emp-timesheets"], queryFn: () => fetchTs() });

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    hours_logged: "8",
    project_reference: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: (p: any) => logFn({ data: p }),
    onSuccess: () => {
      toast.success("Hours logged");
      qc.invalidateQueries({ queryKey: ["emp-timesheets"] });
      setForm({ ...form, hours_logged: "8", project_reference: "", notes: "" });
    },
    onError: (e: any) => toast.error(e?.message || "Log failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Entry removed");
      qc.invalidateQueries({ queryKey: ["emp-timesheets"] });
    },
  });

  const totalWeek = (data ?? [])
    .filter((t) => (Date.now() - new Date(t.date).getTime()) / 86_400_000 <= 7)
    .reduce((a, b) => a + Number(b.hours_logged), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Log hours
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const hours = Number(form.hours_logged);
              if (!Number.isFinite(hours) || hours <= 0) {
                toast.error("Enter valid hours");
                return;
              }
              create.mutate({
                date: form.date,
                hours_logged: hours,
                project_reference: form.project_reference.trim(),
                notes: form.notes.trim() || null,
              });
            }}
            className="mt-4 grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="ts-date">Date</Label>
              <Input
                id="ts-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ts-hours">Hours</Label>
              <Input
                id="ts-hours"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                required
                value={form.hours_logged}
                onChange={(e) => setForm({ ...form, hours_logged: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ts-proj">Project</Label>
              <Input
                id="ts-proj"
                required
                placeholder="e.g. CGT-INT-001 or Client X"
                value={form.project_reference}
                onChange={(e) => setForm({ ...form, project_reference: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ts-notes">Notes</Label>
              <Textarea
                id="ts-notes"
                placeholder="Optional summary"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              disabled={create.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {create.isPending ? "Saving…" : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recent entries
          </h3>
          <Badge variant="outline" className="border-brand/40 text-brand">
            <Clock className="mr-1 h-3 w-3" />
            {totalWeek.toFixed(1)}h this week
          </Badge>
        </div>
        {isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-card" />
            ))}
          </div>
        ) : (data ?? []).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No hours logged yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {(data ?? []).map((t: Timesheet) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.project_reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black">{Number(t.hours_logged).toFixed(1)}h</span>
                  <button
                    onClick={() => del.mutate(t.id)}
                    className="text-muted-foreground hover:text-rose-500"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// REFERRALS
// ============================================================
function ReferralsPanel() {
  const qc = useQueryClient();
  const fetchRefs = useServerFn(listMyReferrals);
  const fetchJobs = useServerFn(listActiveJobPostings);
  const createFn = useServerFn(createReferral);
  const refs = useQuery({ queryKey: ["emp-referrals"], queryFn: () => fetchRefs() });
  const jobs = useQuery({ queryKey: ["public-postings"], queryFn: () => fetchJobs() });

  const [form, setForm] = useState({
    candidate_name: "",
    candidate_email: "",
    job_posting_id: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: (p: any) => createFn({ data: p }),
    onSuccess: () => {
      toast.success("Referral submitted");
      qc.invalidateQueries({ queryKey: ["emp-referrals"] });
      setForm({ candidate_name: "", candidate_email: "", job_posting_id: "", notes: "" });
    },
    onError: (e: any) => toast.error(e?.message || "Submit failed"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Refer a candidate
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                candidate_name: form.candidate_name.trim(),
                candidate_email: form.candidate_email.trim(),
                job_posting_id: form.job_posting_id || null,
                notes: form.notes.trim() || null,
              });
            }}
            className="mt-4 grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="r-name">Candidate name</Label>
              <Input
                id="r-name"
                required
                value={form.candidate_name}
                onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-email">Candidate email</Label>
              <Input
                id="r-email"
                type="email"
                required
                value={form.candidate_email}
                onChange={(e) => setForm({ ...form, candidate_email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={form.job_posting_id}
                onValueChange={(v) => setForm({ ...form, job_posting_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an open role" />
                </SelectTrigger>
                <SelectContent>
                  {(jobs.data ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} {j.job_code ? `· ${j.job_code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-notes">Why they'd be great</Label>
              <Textarea
                id="r-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              disabled={create.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {create.isPending ? "Submitting…" : "Submit referral"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Your referrals
        </h3>
        {refs.isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card" />
            ))}
          </div>
        ) : (refs.data ?? []).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No referrals yet — share the love and refer someone great.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {(refs.data ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.candidate_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.candidate_email}
                    {r.job_title ? ` · ${r.job_title}` : ""}
                    {r.job_code ? ` · ${r.job_code}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={`border ${REFERRAL_STYLE[r.referral_status]}`}>
                  {r.referral_status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LEAVE & PTO
// ============================================================
const LEAVE_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  cancelled: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
};

function daysBetween(a: string, b: string) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1);
}

function LeavePanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyLeaveRequests);
  const submitFn = useServerFn(submitLeaveRequest);
  const cancelFn = useServerFn(cancelMyLeaveRequest);

  const { data, isLoading } = useQuery({
    queryKey: ["emp-leave"],
    queryFn: () => listFn(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    leave_type: "casual" as "casual" | "sick" | "earned" | "unpaid",
    start_date: today,
    end_date: today,
    reason: "",
  });

  const submit = useMutation({
    mutationFn: (p: any) => submitFn({ data: p }),
    onSuccess: () => {
      toast.success("Leave request submitted");
      qc.invalidateQueries({ queryKey: ["emp-leave"] });
      setForm({ leave_type: "casual", start_date: today, end_date: today, reason: "" });
    },
    onError: (e: any) => toast.error(e?.message || "Submit failed"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["emp-leave"] });
    },
    onError: (e: any) => toast.error(e?.message || "Cancel failed"),
  });

  const rows = data ?? [];
  const summary = useMemo(() => {
    const s = { pending: 0, approved: 0, rejected: 0, days: 0 };
    for (const r of rows) {
      if (r.status === "pending") s.pending += 1;
      if (r.status === "approved") {
        s.approved += 1;
        s.days += daysBetween(r.start_date, r.end_date);
      }
      if (r.status === "rejected") s.rejected += 1;
    }
    return s;
  }, [rows]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Request leave
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (form.end_date < form.start_date) {
                toast.error("End date cannot be before start date");
                return;
              }
              submit.mutate({
                leave_type: form.leave_type,
                start_date: form.start_date,
                end_date: form.end_date,
                reason: form.reason.trim() || null,
              });
            }}
            className="mt-4 grid gap-3"
          >
            <div className="grid gap-2">
              <Label>Leave type</Label>
              <Select
                value={form.leave_type}
                onValueChange={(v) => setForm({ ...form, leave_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="earned">Earned</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="lv-from">From</Label>
                <Input
                  id="lv-from"
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lv-to">To</Label>
                <Input
                  id="lv-to"
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lv-reason">Reason (optional)</Label>
              <Textarea
                id="lv-reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Add context for your manager"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <span>Duration</span>
              <span className="font-semibold text-foreground">
                {daysBetween(form.start_date, form.end_date)} day(s)
              </span>
            </div>
            <Button
              type="submit"
              disabled={submit.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {submit.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Pending
              </p>
              <p className="mt-2 text-2xl font-black">{summary.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Approved days
              </p>
              <p className="mt-2 text-2xl font-black text-emerald-500">{summary.days}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Rejected
              </p>
              <p className="mt-2 text-2xl font-black text-rose-500">{summary.rejected}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            My requests
          </h3>
          <Badge variant="outline">{rows.length} total</Badge>
        </div>
        {isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No leave requests yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {rows.map((r: LeaveRequest) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize">{r.leave_type}</span>
                      <Badge
                        variant="outline"
                        className={`border text-[10px] ${LEAVE_STATUS_STYLE[r.status] ?? ""}`}
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.start_date).toLocaleDateString()} →{" "}
                      {new Date(r.end_date).toLocaleDateString()} ·{" "}
                      {daysBetween(r.start_date, r.end_date)} day(s)
                    </p>
                    {r.reason && <p className="mt-1 text-xs text-foreground/80">"{r.reason}"</p>}
                    {r.decision_note && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <strong>Note:</strong> {r.decision_note}
                      </p>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => cancel.mutate(r.id)}>
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsPanel() {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Professional profile
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your account, avatar, and appearance preferences from the main profile settings.
        </p>
        <Button asChild className="mt-4 bg-brand text-brand-foreground hover:bg-brand-glow">
          <Link to="/profile">
            <Settings className="mr-1.5 h-4 w-4" /> Open profile settings
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// ATTENDANCE
// ============================================================
const ATT_STATUS: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  absent: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  leave: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  regularized: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  pending_regularization: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
};

function AttendancePanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyAttendance);
  const inFn = useServerFn(checkInToday);
  const outFn = useServerFn(checkOutToday);
  const regFn = useServerFn(requestRegularization);
  const list = useQuery({ queryKey: ["my-attendance"], queryFn: () => listFn({ data: {} }) });
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = (list.data ?? []).find((r) => r.work_date === today) ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-attendance"] });
  const inM = useMutation({
    mutationFn: () => inFn(),
    onSuccess: () => {
      toast.success("Checked in");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const outM = useMutation({
    mutationFn: () => outFn(),
    onSuccess: () => {
      toast.success("Checked out");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [regDate, setRegDate] = useState("");
  const [regReason, setRegReason] = useState("");
  const regM = useMutation({
    mutationFn: (v: { work_date: string; reason: string }) => regFn({ data: v }),
    onSuccess: () => {
      toast.success("Regularization requested");
      setRegDate("");
      setRegReason("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalPresent = (list.data ?? []).filter(
    (r) => r.status === "present" || r.status === "regularized",
  ).length;
  const totalHours = (list.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Today</div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className={ATT_STATUS[todayRow?.status ?? "absent"]}>
                {todayRow?.status ?? "not marked"}
              </Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => inM.mutate()}
                disabled={inM.isPending || !!todayRow?.check_in}
                className="bg-brand text-brand-foreground hover:bg-brand-glow"
              >
                <LogIn className="mr-1.5 h-4 w-4" /> Check in
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => outM.mutate()}
                disabled={outM.isPending || !todayRow?.check_in || !!todayRow?.check_out}
              >
                <LogOut className="mr-1.5 h-4 w-4" /> Check out
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Days present
            </div>
            <div className="mt-2 text-3xl font-bold">{totalPresent}</div>
            <div className="text-xs text-muted-foreground">across the last 400 entries</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Hours logged
            </div>
            <div className="mt-2 text-3xl font-bold">{totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <div className="text-sm font-semibold">Attendance calendar</div>
          <p className="text-xs text-muted-foreground">
            Colour-coded month view. Click a date to see punches, or use the regularization form
            below for missed days.
          </p>
          <AttendanceCalendar rows={list.data ?? []} />
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Regularized
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pending
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Leave
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <div className="text-sm font-semibold">Request regularization</div>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
            <Input
              type="date"
              value={regDate}
              onChange={(e) => setRegDate(e.target.value)}
              max={today}
            />
            <Input
              placeholder="Reason (client meeting, WFH, VPN issue…)"
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
            />
            <Button
              onClick={() => regM.mutate({ work_date: regDate, reason: regReason })}
              disabled={!regDate || regReason.length < 4 || regM.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              Submit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="mb-3 text-sm font-semibold">Recent attendance</div>
          {list.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (list.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No attendance records yet — check in to start tracking.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(list.data ?? []).slice(0, 30).map((r: AttendanceRecord) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-24 font-mono text-xs">{r.work_date}</div>
                    <Badge variant="outline" className={ATT_STATUS[r.status] ?? ""}>
                      {r.status.replace("_", " ")}
                    </Badge>
                    {r.regularization_reason ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                        — {r.regularization_reason}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.check_in
                      ? new Date(r.check_in).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    {" → "}
                    {r.check_out
                      ? new Date(r.check_out).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    {r.hours ? ` · ${Number(r.hours).toFixed(1)}h` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceCalendar({ rows }: { rows: Array<{ work_date: string; status: string }> }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const map = new Map(rows.map((r) => [r.work_date, r.status]));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay();
  const cells: Array<{ date?: string; day?: number; status?: string }> = [];
  for (let i = 0; i < startPad; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: iso, day: d, status: map.get(iso) });
  }
  const dot = (s?: string) =>
    s === "present"
      ? "bg-emerald-500"
      : s === "regularized"
        ? "bg-sky-500"
        : s === "pending_regularization"
          ? "bg-amber-500"
          : s === "leave"
            ? "bg-slate-400"
            : s === "absent"
              ? "bg-rose-500"
              : "";
  const label = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          ‹
        </Button>
        <div className="text-sm font-semibold">{label}</div>
        <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          ›
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md border ${c.date ? "border-border/70 bg-card" : "border-transparent"} p-1 text-left`}
          >
            {c.day && (
              <div className="flex h-full flex-col justify-between">
                <span className="text-[11px] font-medium">{c.day}</span>
                {c.status && (
                  <span
                    className={`ml-auto h-2 w-2 rounded-full ${dot(c.status)}`}
                    title={c.status}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PAYROLL
// ============================================================
const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function PayrollPanel() {
  const strucFn = useServerFn(getMySalaryStructure);
  const slipsFn = useServerFn(listMySalarySlips);
  const struc = useQuery({ queryKey: ["my-salary-structure"], queryFn: () => strucFn() });
  const slips = useQuery({ queryKey: ["my-salary-slips"], queryFn: () => slipsFn() });
  const [selected, setSelected] = useState<SalarySlip | null>(null);

  const s = struc.data as SalaryStructure | null | undefined;

  const download = (slip: SalarySlip) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Salary Slip · ${MONTHS[slip.period_month - 1]} ${slip.period_year}</title>
      <style>body{font-family:Inter,system-ui,sans-serif;padding:32px;max-width:720px;margin:auto;color:#0f172a}
      h1{margin:0 0 4px;font-size:20px}h2{font-size:14px;color:#64748b;margin:0 0 24px;font-weight:500}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td,th{padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}
      th{background:#f8fafc;text-transform:uppercase;font-size:11px;letter-spacing:0.06em}
      .net{background:#0d9488;color:#fff;padding:12px;margin-top:16px;border-radius:8px;display:flex;justify-content:space-between;font-weight:600}
      </style></head><body>
      <h1>Ciago Technologies</h1>
      <h2>Salary Slip · ${MONTHS[slip.period_month - 1]} ${slip.period_year}</h2>
      <table><tr><th>Working days</th><td>${slip.working_days}</td><th>LWP days</th><td>${slip.lwp_days}</td></tr></table>
      <table><thead><tr><th>Earnings</th><th>Amount (₹)</th></tr></thead><tbody>
        <tr><td>Basic</td><td>${inrFmt.format(slip.basic)}</td></tr>
        <tr><td>HRA</td><td>${inrFmt.format(slip.hra)}</td></tr>
        <tr><td>Special Allowance</td><td>${inrFmt.format(slip.special)}</td></tr>
        <tr><th>Gross</th><th>${inrFmt.format(slip.gross)}</th></tr>
      </tbody></table>
      <table><thead><tr><th>Deductions</th><th>Amount (₹)</th></tr></thead><tbody>
        <tr><td>PF (Employee)</td><td>${inrFmt.format(slip.pf_employee)}</td></tr>
        <tr><td>Professional Tax</td><td>${inrFmt.format(slip.pt)}</td></tr>
        <tr><td>TDS</td><td>${inrFmt.format(slip.tds)}</td></tr>
        <tr><th>Total Deductions</th><th>${inrFmt.format(slip.total_deductions)}</th></tr>
      </tbody></table>
      <div class="net"><span>Net Pay</span><span>₹ ${inrFmt.format(slip.net_pay)}</span></div>
      <p style="margin-top:24px;font-size:11px;color:#94a3b8">System-generated document — no signature required.</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="text-sm font-semibold">Compensation summary</div>
          {struc.isLoading ? (
            <div className="mt-2 text-sm text-muted-foreground">Loading…</div>
          ) : !s ? (
            <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Your salary structure has not been set yet. Please contact HR.
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Annual CTC
                </div>
                <div className="text-xl font-bold">₹ {inrFmt.format(s.ctc_annual_inr)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Basic / mo
                </div>
                <div className="text-xl font-bold">₹ {inrFmt.format(s.basic_monthly)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  HRA / mo
                </div>
                <div className="text-xl font-bold">₹ {inrFmt.format(s.hra_monthly)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Special / mo
                </div>
                <div className="text-xl font-bold">₹ {inrFmt.format(s.special_monthly)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="mb-3 text-sm font-semibold">Salary slips</div>
          {slips.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (slips.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No salary slips generated yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(slips.data ?? []).map((slip) => (
                <li key={slip.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {MONTHS[slip.period_month - 1]} {slip.period_year}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Gross ₹{inrFmt.format(slip.gross)} · Deductions ₹
                      {inrFmt.format(slip.total_deductions)} · LWP {slip.lwp_days}d
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        Net
                      </div>
                      <div className="text-base font-bold text-brand">
                        ₹ {inrFmt.format(slip.net_pay)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(slip);
                        download(slip);
                      }}
                    >
                      <Download className="mr-1.5 h-4 w-4" /> PDF
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// INTERNAL CAREERS (Mobility)
// ============================================================
function MobilityPanel() {
  const listFn = useServerFn(_listInternalJobs);
  const [q, setQ] = useState("");
  const jobs = useQuery({ queryKey: ["internal-jobs", q], queryFn: () => listFn({ data: { q } }) });
  const rows = jobs.data ?? [];
  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by title, department or job code"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {jobs.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No open roles right now.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((j: any) => (
            <li key={j.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{j.title}</p>
                    {j.job_code && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {j.job_code}
                      </Badge>
                    )}
                    {j.internal_only && (
                      <Badge className="bg-brand/15 text-brand border-brand/30 text-[10px]">
                        Internal only
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {j.department ?? "—"} · {j.employment_type ?? "Full time"} ·{" "}
                    {j.is_remote ? "Remote" : (j.location ?? "On-site")}
                  </p>
                  {j.summary && <p className="mt-2 text-xs">{j.summary}</p>}
                </div>
                <Link to="/careers" className="text-xs font-semibold text-brand hover:underline">
                  Apply →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// RESIGNATION
// ============================================================
function ResignationPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(_listMyResignation);
  const submitFn = useServerFn(_submitResignation);
  const withdrawFn = useServerFn(_withdrawResignation);
  const current = useQuery({ queryKey: ["my-resignation"], queryFn: () => listFn() });
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const submit = useMutation({
    mutationFn: () => submitFn({ data: { last_working_day: lwd, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Resignation submitted");
      setLwd("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["my-resignation"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Withdrawn");
      qc.invalidateQueries({ queryKey: ["my-resignation"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const r = current.data;
  const active = r && r.status !== "withdrawn" && r.status !== "rejected";
  return (
    <div className="space-y-4">
      {r && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Current request</div>
              <Badge variant="outline" className="capitalize">
                {r.status}
              </Badge>
            </div>
            <div>Submitted: {new Date(r.submitted_on).toLocaleDateString()}</div>
            <div>
              Last working day: <strong>{new Date(r.last_working_day).toLocaleDateString()}</strong>
            </div>
            {r.reason && <p className="text-muted-foreground">"{r.reason}"</p>}
            {r.decision_note && (
              <p className="text-muted-foreground">
                <strong>HR note:</strong> {r.decision_note}
              </p>
            )}
            {r.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => withdraw.mutate(r.id)}
                disabled={withdraw.isPending}
              >
                Withdraw
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {!active && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-semibold">Submit resignation</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="rz-lwd">Last working day</Label>
                <Input
                  id="rz-lwd"
                  type="date"
                  value={lwd}
                  onChange={(e) => setLwd(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rz-reason">Reason (optional)</Label>
              <Textarea
                id="rz-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Anything you'd like HR to know"
              />
            </div>
            <Button
              onClick={() => submit.mutate()}
              disabled={!lwd || submit.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {submit.isPending ? "Submitting…" : "Submit resignation"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
