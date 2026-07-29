import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  Briefcase,
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Hash,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  checkIsAdmin,
  deleteRejectedApplication,
  listAllApplications,
  listAllUsers,
  listApplicantsByRole,
  updateApplicationStatus,
} from "@/lib/admin.functions";
import {
  listDepartments,
  listStaffUsers,
  setStaffUserRole,
  type Department,
  type StaffUser,
} from "@/lib/orgHierarchy.functions";
import { listAuditLogs, type AuditLog } from "@/lib/audit.functions";
import {
  deleteJobPosting,
  listAllJobPostings,
  upsertJobPosting,
  type JobPosting,
} from "@/lib/jobPostings.functions";
import { useLookups } from "@/hooks/use-lookups";
import { requireRoles, requireDashboardEnabled } from "./-guard";
import {
  assignTaskToEmployee,
  listAllAssignedTasks,
  listEmployeesForAssignment,
  type AdminTask,
  type EmployeeOption,
} from "@/lib/adminTasks.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  validateSearch: zodValidator(
    z.object({
      tab: fallback(
        z.enum(["applications", "postings", "users", "audit", "by-role", "tasks"]).optional(),
        undefined,
      ),
    }),
  ),
  beforeLoad: async () => {
    const { userId, roles } = await requireRoles("/admin");
    if (!roles.has("admin")) throw redirect({ to: "/forbidden" });
    return { currentUserId: userId };
  },
  head: () => ({
    meta: [
      { title: "Admin Command Center | Ciago Technologies" },
      { name: "description", content: "Ciago Technologies internal admin dashboard." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offered", label: "Offered" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLE: Record<string, string> = {
  applied: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  screening: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  interviewing: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  offered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  hired: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

const POSTING_STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  draft: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  internal_only: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  closed: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  archived: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20",
};

const AUDIT_STYLE: Record<string, string> = {
  APPLICATION_STATUS_UPDATED: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  ROLE_GRANTED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  ROLE_REVOKED: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  JOB_POSTING_CREATED: "bg-brand/15 text-brand border-brand/30",
  JOB_POSTING_UPDATED: "bg-brand/15 text-brand border-brand/30",
  JOB_POSTING_DELETED: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

const inr = new Intl.NumberFormat("en-IN");

const TAB_META: Record<
  "applications" | "postings" | "users" | "audit" | "by-role" | "tasks",
  { title: string; desc: string; icon: any }
> = {
  applications: {
    title: "Applications",
    desc: "Review, triage and progress every candidate.",
    icon: Users,
  },
  postings: {
    title: "Job Postings",
    desc: "Publish, pause and edit roles on the public Careers page.",
    icon: Briefcase,
  },
  users: { title: "Users & Roles", desc: "Manage accounts and grant admin access.", icon: UserCog },
  audit: {
    title: "Audit Logs",
    desc: "Every privileged action, with full metadata.",
    icon: ScrollText,
  },
  "by-role": {
    title: "Applicants by Job",
    desc: "Every job posting with its applicants, statuses and re-apply windows.",
    icon: Briefcase,
  },
  tasks: {
    title: "Employee Tasks",
    desc: "Delegate work to employees with deadlines, priorities and project references.",
    icon: ClipboardList,
  },
};

function AdminPage() {
  const { currentUserId } = Route.useRouteContext();
  const { tab } = Route.useSearch();
  const fetchAll = useServerFn(listAllApplications);
  const fetchUsers = useServerFn(listAllUsers);
  const fetchPostings = useServerFn(listAllJobPostings);
  const fetchLogs = useServerFn(listAuditLogs);

  const apps = useQuery({ queryKey: ["admin-applications"], queryFn: () => fetchAll() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const postings = useQuery({ queryKey: ["admin-postings"], queryFn: () => fetchPostings() });
  const recentLogs = useQuery({
    queryKey: ["admin-audit", "all", "", "", "recent"],
    queryFn: () => fetchLogs({ data: { limit: 6 } }),
    enabled: !tab,
  });

  const metrics = [
    {
      label: "Total Applicants",
      value: apps.data?.length ?? "—",
      icon: Users,
      hint: `${apps.data?.filter((a) => a.status === "applied").length ?? 0} applied`,
      accent: "from-sky-500/20 to-sky-500/0 text-sky-500",
    },
    {
      label: "Active Postings",
      value: postings.data?.filter((p) => p.status === "published").length ?? "—",
      icon: Briefcase,
      hint: `${postings.data?.length ?? 0} total`,
      accent: "from-brand/25 to-brand/0 text-brand",
    },
    {
      label: "Total Users",
      value: users.data?.length ?? "—",
      icon: UserCog,
      hint: `${users.data?.filter((u) => u.is_admin).length ?? 0} admins`,
      accent: "from-violet-500/20 to-violet-500/0 text-violet-500",
    },
    {
      label: "System Health",
      value: "Operational",
      icon: Activity,
      hint: "All services green",
      accent: "from-emerald-500/25 to-emerald-500/0 text-emerald-500",
    },
  ];

  const isLoadingMetrics = apps.isLoading || users.isLoading || postings.isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-brand/5 p-6 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_60%_at_100%_0%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent_70%)]"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-brand">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                  Command Center
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Enterprise control panel
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Applicants, roles, access, and every action — one workspace.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              All systems operational
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {metrics.map((m) =>
            isLoadingMetrics ? (
              <div
                key={m.label}
                className="h-[112px] animate-pulse rounded-2xl border border-border bg-card"
              />
            ) : (
              <Card
                key={m.label}
                className="group relative overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-xl hover:shadow-brand/10"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <CardContent className="relative p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {m.label}
                    </p>
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${m.accent}`}
                    >
                      <m.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-3xl font-black leading-none tracking-tight sm:text-4xl">
                    {m.value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{m.hint}</p>
                </CardContent>
              </Card>
            ),
          )}
        </div>

        <div className="mt-10">
          {tab === "applications" ? (
            <PanelFrame meta={TAB_META.applications}>
              <ApplicationsPanel />
            </PanelFrame>
          ) : tab === "postings" ? (
            <PanelFrame meta={TAB_META.postings}>
              <JobPostingsPanel />
            </PanelFrame>
          ) : tab === "users" ? (
            <PanelFrame meta={TAB_META.users}>
              <UsersPanel currentUserId={currentUserId} />
            </PanelFrame>
          ) : tab === "audit" ? (
            <PanelFrame meta={TAB_META.audit}>
              <AuditLogsPanel />
            </PanelFrame>
          ) : tab === "by-role" ? (
            <PanelFrame meta={TAB_META["by-role"]}>
              <ApplicantsByRolePanel />
            </PanelFrame>
          ) : tab === "tasks" ? (
            <PanelFrame meta={TAB_META.tasks}>
              <EmployeeTasksPanel />
            </PanelFrame>
          ) : (
            <DashboardLanding
              apps={apps.data ?? []}
              postings={postings.data ?? []}
              users={users.data ?? []}
              recent={recentLogs.data ?? []}
              recentLoading={recentLogs.isLoading}
            />
          )}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Access controlled by row-level security. See{" "}
          <Link to="/my-applications" className="underline hover:text-brand">
            candidate view
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

function ApplicationsPanel() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAllApplications);
  const updateFn = useServerFn(updateApplicationStatus);
  const deleteFn = useServerFn(deleteRejectedApplication);
  const checkAdmin = useServerFn(checkIsAdmin);

  useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => fetchAll(),
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.role_title.toLowerCase().includes(q) ||
        (a.role_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, statusFilter]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      updateFn({ data: { id: vars.id, status: vars.status as any } }),
    onSuccess: () => {
      toast.success("Status updated — candidate notified");
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Application deleted");
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Search by name, email, role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {data?.length ?? 0}
        </p>
      </div>
      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      ) : !filtered || filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            {(data ?? []).length === 0
              ? "No applications yet."
              : "No applications match your filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[1.4fr_1.3fr_1fr_1.2fr_1fr_auto] gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid">
            <div>Candidate</div>
            <div>Role</div>
            <div>Submitted</div>
            <div>Status</div>
            <div>Resume</div>
            <div className="text-right">Actions</div>
          </div>
          <ul>
            {filtered.map((a) => (
              <li
                key={a.id}
                className="grid grid-cols-1 gap-3 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1.3fr_1fr_1.2fr_1fr_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.full_name}</p>
                  <a
                    href={`mailto:${a.email}`}
                    className="truncate text-xs text-muted-foreground hover:text-brand"
                  >
                    {a.email}
                  </a>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{a.role_title}</p>
                    {a.track_type === "hr_track" && (
                      <Badge
                        variant="outline"
                        className="border-fuchsia-500/40 bg-fuchsia-500/10 text-[10px] font-semibold uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-300"
                      >
                        HR Track
                      </Badge>
                    )}
                    {a.track_type === "manager_track" && (
                      <Badge
                        variant="outline"
                        className="border-indigo-500/40 bg-indigo-500/10 text-[10px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300"
                      >
                        Manager Track
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{a.role_id}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`border ${STATUS_STYLE[a.status] ?? ""}`}>
                    {STATUS_OPTIONS.find((s) => s.value === a.status)?.label ?? a.status}
                  </Badge>
                  <Select
                    value={a.status}
                    onValueChange={(v) => mutation.mutate({ id: a.id, status: v })}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {a.resume_link ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={a.resume_link} target="_blank" rel="noopener noreferrer">
                        Resume <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="md:text-right">
                  {a.status === "rejected" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete rejected application?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes {a.full_name}'s application and any uploaded
                            resume file from storage.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-rose-600 hover:bg-rose-500"
                            onClick={() => deleteMutation.mutate(a.id)}
                          >
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============ JOB POSTINGS ============

type PostingFormState = {
  id?: string;
  title: string;
  department: string;
  location: string;
  is_remote: boolean;
  employment_type: string;
  summary: string;
  description: string;
  requirements: string; // newline-separated in form
  tags: string; // comma-separated in form
  salary_min_inr: string;
  salary_max_inr: string;
  status: "draft" | "published" | "internal_only" | "closed" | "archived";
};

const emptyPosting: PostingFormState = {
  title: "",
  department: "Engineering",
  location: "Remote · Global",
  is_remote: true,
  employment_type: "full_time",
  summary: "",
  description: "",
  requirements: "",
  tags: "",
  salary_min_inr: "",
  salary_max_inr: "",
  status: "draft",
};

function JobPostingsPanel() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAllJobPostings);
  const upsertFn = useServerFn(upsertJobPosting);
  const deleteFn = useServerFn(deleteJobPosting);
  const lookups = useLookups();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-postings"],
    queryFn: () => fetchAll(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PostingFormState>(emptyPosting);

  const upsert = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => {
      toast.success(form.id ? "Posting updated" : "Posting created");
      qc.invalidateQueries({ queryKey: ["admin-postings"] });
      qc.invalidateQueries({ queryKey: ["public-postings"] });
      setOpen(false);
      setForm(emptyPosting);
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Posting deleted");
      qc.invalidateQueries({ queryKey: ["admin-postings"] });
      qc.invalidateQueries({ queryKey: ["public-postings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  function edit(p: JobPosting) {
    setForm({
      id: p.id,
      title: p.title,
      department: p.department,
      location: p.location,
      is_remote: p.is_remote,
      employment_type: p.employment_type,
      summary: p.summary,
      description: p.description,
      requirements: p.requirements.join("\n"),
      tags: p.tags.join(", "),
      salary_min_inr: p.salary_min_inr?.toString() ?? "",
      salary_max_inr: p.salary_max_inr?.toString() ?? "",
      status: p.status,
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      id: form.id,
      title: form.title.trim(),
      department: form.department.trim(),
      location: form.location.trim(),
      is_remote: form.is_remote,
      employment_type: form.employment_type.trim(),
      summary: form.summary.trim(),
      description: form.description.trim(),
      requirements: form.requirements
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      salary_min_inr: form.salary_min_inr ? Number(form.salary_min_inr) : null,
      salary_max_inr: form.salary_max_inr ? Number(form.salary_max_inr) : null,
      status: form.status,
    };
    upsert.mutate(payload);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data?.length ?? 0} posting{(data?.length ?? 0) === 1 ? "" : "s"} —{" "}
          {data?.filter((p) => p.status === "published").length ?? 0} published
        </p>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setForm(emptyPosting);
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
              onClick={() => setForm(emptyPosting)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New posting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit posting" : "Create posting"}</DialogTitle>
              <DialogDescription>
                Active postings appear immediately on the public Careers page.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="p-title">Title</Label>
                <Input
                  id="p-title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="p-dept">Department</Label>
                  <Select
                    value={form.department}
                    onValueChange={(v) => setForm({ ...form, department: v })}
                  >
                    <SelectTrigger id="p-dept">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {lookups.departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="p-type">Employment type</Label>
                  <Select
                    value={form.employment_type}
                    onValueChange={(v) => setForm({ ...form, employment_type: v })}
                  >
                    <SelectTrigger id="p-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {lookups.employment_types.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-[2fr_auto] items-end gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="p-loc">Location</Label>
                  <Input
                    id="p-loc"
                    required
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <Switch
                    checked={form.is_remote}
                    onCheckedChange={(v) => setForm({ ...form, is_remote: v })}
                  />
                  Remote
                </label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-sum">Summary</Label>
                <Textarea
                  id="p-sum"
                  required
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea
                  id="p-desc"
                  required
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-req">Requirements (one per line)</Label>
                <Textarea
                  id="p-req"
                  rows={4}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-tags">Tags (comma-separated: Go, Kubernetes, Remote…)</Label>
                <Input
                  id="p-tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="p-smin">Salary min (₹)</Label>
                  <Input
                    id="p-smin"
                    type="number"
                    min="0"
                    value={form.salary_min_inr}
                    onChange={(e) => setForm({ ...form, salary_min_inr: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="p-smax">Salary max (₹)</Label>
                  <Input
                    id="p-smax"
                    type="number"
                    min="0"
                    value={form.salary_max_inr}
                    onChange={(e) => setForm({ ...form, salary_max_inr: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v: any) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lookups.statuses.job_posting.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={upsert.isPending}
                  className="bg-brand text-brand-foreground hover:bg-brand-glow"
                >
                  {upsert.isPending ? "Saving…" : form.id ? "Save changes" : "Create posting"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            No job postings yet. Click{" "}
            <span className="font-semibold text-foreground">New posting</span> to create the first
            one.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {data.map((p) => (
            <li key={p.id}>
              <Card className="border-border">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{p.title}</p>
                      <Badge
                        variant="outline"
                        className={`border ${POSTING_STATUS_STYLE[p.status]}`}
                      >
                        {p.status}
                      </Badge>
                      {p.is_remote && <Badge variant="outline">Remote</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.department} · {p.location} · {p.employment_type}
                      {p.salary_min_inr && p.salary_max_inr
                        ? ` · ₹${inr.format(p.salary_min_inr)}–₹${inr.format(p.salary_max_inr)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => edit(p)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    {p.status === "published" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          upsert.mutate({
                            id: p.id,
                            title: p.title,
                            department: p.department,
                            location: p.location,
                            is_remote: p.is_remote,
                            employment_type: p.employment_type,
                            summary: p.summary,
                            description: p.description,
                            requirements: p.requirements,
                            tags: p.tags,
                            salary_min_inr: p.salary_min_inr,
                            salary_max_inr: p.salary_max_inr,
                            status: "draft",
                          })
                        }
                      >
                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Unpublish
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          upsert.mutate({
                            id: p.id,
                            title: p.title,
                            department: p.department,
                            location: p.location,
                            is_remote: p.is_remote,
                            employment_type: p.employment_type,
                            summary: p.summary,
                            description: p.description,
                            requirements: p.requirements,
                            tags: p.tags,
                            salary_min_inr: p.salary_min_inr,
                            salary_max_inr: p.salary_max_inr,
                            status: "published",
                          })
                        }
                      >
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Publish
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete posting?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the "{p.title}" posting. Existing applications
                            are unaffected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-rose-600 hover:bg-rose-500"
                            onClick={() => del.mutate(p.id)}
                          >
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============ AUDIT LOGS ============

function AuditLogsPanel() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [inspect, setInspect] = useState<AuditLog | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit", actionFilter, from, to],
    queryFn: () =>
      fetchLogs({
        data: {
          action: actionFilter === "all" ? undefined : actionFilter,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        },
      }),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (r) =>
        r.actor_email?.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.target_resource?.toLowerCase().includes(q),
    );
  }, [data, query]);

  const actions = useMemo(() => {
    const s = new Set<string>();
    data?.forEach((r) => s.add(r.action));
    return Array.from(s).sort();
  }, [data]);

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Input
          placeholder="Search actor, action, resource…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="To date"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            No audit events for this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[1.2fr_1.4fr_1.4fr_1.6fr_auto] gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid">
            <div>Timestamp</div>
            <div>Actor</div>
            <div>Action</div>
            <div>Target</div>
            <div className="text-right">Details</div>
          </div>
          <ul>
            {filtered.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-1 gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1.2fr_1.4fr_1.4fr_1.6fr_auto] md:items-center md:gap-4"
              >
                <div className="text-xs text-muted-foreground">
                  {new Date(r.timestamp).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="min-w-0 truncate text-sm">
                  {r.actor_email ?? r.actor_id?.slice(0, 8) ?? "system"}
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className={`border ${AUDIT_STYLE[r.action] ?? "border-border"}`}
                  >
                    {r.action}
                  </Badge>
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {r.target_resource ?? "—"}
                </div>
                <div className="md:text-right">
                  <Button size="sm" variant="ghost" onClick={() => setInspect(r)}>
                    <FileText className="mr-1 h-3.5 w-3.5" /> View
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!inspect} onOpenChange={(v) => !v && setInspect(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit event</DialogTitle>
            <DialogDescription>
              {inspect ? new Date(inspect.timestamp).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          {inspect && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <p className="text-muted-foreground">Actor</p>
                <p className="col-span-2 font-medium">
                  {inspect.actor_email ?? inspect.actor_id ?? "system"}
                </p>
                <p className="text-muted-foreground">Action</p>
                <p className="col-span-2 font-mono text-xs">{inspect.action}</p>
                <p className="text-muted-foreground">Target</p>
                <p className="col-span-2 font-mono text-xs break-all">
                  {inspect.target_resource ?? "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Details
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(inspect.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ USERS ============

const ROLE_LABEL: Record<StaffUser["role"], string> = {
  user: "User",
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  admin: "Admin",
};

const ROLE_STYLE: Record<StaffUser["role"], string> = {
  user: "border-border text-muted-foreground",
  employee: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  manager: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  hr: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  admin: "border-brand/40 bg-brand/10 text-brand",
};

function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listStaffUsers);
  const fetchDepts = useServerFn(listDepartments);
  const setRole = useServerFn(setStaffUserRole);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [pendingRole, setPendingRole] = useState<StaffUser["role"]>("employee");
  const [pendingDept, setPendingDept] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-staff-users"],
    queryFn: () => fetchUsers(),
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => fetchDepts(),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: StaffUser["role"]; departmentId: string | null }) =>
      setRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-staff-users"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message || "Role update failed"),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.department_name?.toLowerCase().includes(q) ||
        u.id.includes(q),
    );
  }, [data, query]);

  function openEditor(u: StaffUser) {
    setEditing(u);
    setPendingRole(u.role === "user" ? "employee" : u.role);
    setPendingDept(u.department_id ?? null);
  }

  const needsDept = pendingRole === "manager" || pendingRole === "hr" || pendingRole === "employee";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search by email, name or department…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-xs text-muted-foreground">
          {data ? `${data.length} account${data.length === 1 ? "" : "s"}` : ""}
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">
              {(error as Error).message}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden grid-cols-[2fr_1.4fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid">
              <div>User</div>
              <div>Registered</div>
              <div>Role</div>
              <div>Department</div>
              <div className="text-right">Actions</div>
            </div>
            <ul>
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <li
                    key={u.id}
                    className="grid grid-cols-1 gap-3 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[2fr_1.4fr_1fr_1fr_auto] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {u.full_name || u.email || u.id}
                      </p>
                      {u.email && (
                        <a
                          href={`mailto:${u.email}`}
                          className="truncate text-xs text-muted-foreground hover:text-brand"
                        >
                          {u.email}
                        </a>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div>
                      <Badge variant="outline" className={ROLE_STYLE[u.role]}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {u.department_name ?? <span className="text-xs italic">—</span>}
                    </div>
                    <div className="flex items-center justify-start gap-2 md:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditor(u)}
                        disabled={isSelf && u.role === "admin"}
                      >
                        Manage role
                      </Button>
                      {isSelf && (
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          You
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">No users found.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage role</DialogTitle>
            <DialogDescription>
              {editing?.full_name || editing?.email || editing?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={pendingRole}
                onValueChange={(v) => setPendingRole(v as StaffUser["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (candidate)</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choosing <span className="font-semibold">User</span> strips every staff role and
                drops the account back to a standard candidate.
              </p>
            </div>
            {needsDept && (
              <div className="space-y-2">
                <Label>Department {pendingRole === "employee" ? "(optional)" : ""}</Label>
                <Select
                  value={pendingDept ?? "__none"}
                  onValueChange={(v) => setPendingDept(v === "__none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Unassigned —</SelectItem>
                    {(departments ?? []).map((d: Department) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
              disabled={roleMutation.isPending || !editing}
              onClick={() =>
                editing &&
                roleMutation.mutate({
                  userId: editing.id,
                  role: pendingRole,
                  departmentId: needsDept ? pendingDept : null,
                })
              }
            >
              {roleMutation.isPending ? "Saving…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// (XCircle imported for potential future use in cancel actions)
void XCircle;

// ============ SHARED PANEL FRAME + DASHBOARD LANDING ============

function PanelFrame({
  meta,
  children,
}: {
  meta: { title: string; desc: string; icon: any };
  children: React.ReactNode;
}) {
  const Icon = meta.icon;
  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{meta.title}</h2>
            <p className="text-sm text-muted-foreground">{meta.desc}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin">← Dashboard</Link>
        </Button>
      </div>
      {children}
    </section>
  );
}

function DashboardLanding({
  apps,
  postings,
  users,
  recent,
  recentLoading,
}: {
  apps: any[];
  postings: any[];
  users: any[];
  recent: AuditLog[];
  recentLoading: boolean;
}) {
  const inQueue = apps.filter((a) => a.status === "applied").length;
  const underReview = apps.filter(
    (a) => a.status === "screening" || a.status === "interviewing",
  ).length;
  const activePostings = postings.filter((p) => p.status === "published").length;
  const adminsCount = users.filter((u) => u.is_admin).length;

  const quickActions = [
    {
      label: "Review applications",
      desc: `${inQueue} in queue · ${underReview} under review`,
      icon: Users,
      to: "/admin" as const,
      search: { tab: "applications" as const },
      accent: "from-sky-500/20 to-transparent text-sky-500",
    },
    {
      label: "Manage job postings",
      desc: `${activePostings} active · ${postings.length} total`,
      icon: Briefcase,
      to: "/admin" as const,
      search: { tab: "postings" as const },
      accent: "from-brand/25 to-transparent text-brand",
    },
    {
      label: "Users & roles",
      desc: `${users.length} accounts · ${adminsCount} admins`,
      icon: UserCog,
      to: "/admin" as const,
      search: { tab: "users" as const },
      accent: "from-violet-500/20 to-transparent text-violet-500",
    },
    {
      label: "Audit logs",
      desc: "Search every privileged action",
      icon: ScrollText,
      to: "/admin" as const,
      search: { tab: "audit" as const },
      accent: "from-emerald-500/20 to-transparent text-emerald-500",
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Quick actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump straight into the workspace you need.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              search={a.search}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-xl hover:shadow-brand/10"
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />
              <div className="relative flex items-start justify-between">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${a.accent}`}
                >
                  <a.icon className="h-5 w-5" />
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand" />
              </div>
              <p className="relative mt-4 text-base font-semibold">{a.label}</p>
              <p className="relative mt-1 text-xs text-muted-foreground">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Recent activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest privileged actions across the platform.
            </p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin" search={{ tab: "audit" }}>
              View all
            </Link>
          </Button>
        </div>
        <Card className="mt-4 border-border">
          <CardContent className="p-2">
            {recentLoading ? (
              <div className="grid gap-2 p-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                      <ScrollText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.action}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.actor_email ?? "system"} ·{" "}
                        {new Date(r.timestamp).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ APPLICANTS BY ROLE ============

function ApplicantsByRolePanel() {
  const fetchByRole = useServerFn(listApplicantsByRole);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-applicants-by-role"],
    queryFn: () => fetchByRole(),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          No applications yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((g) => {
        const isOpen = openId === g.role_id;
        return (
          <div key={g.role_id} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : g.role_id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{g.role_title}</h3>
                  <Badge
                    variant="outline"
                    className={`border ${POSTING_STATUS_STYLE[g.status] ?? ""}`}
                  >
                    {g.status}
                  </Badge>
                  {g.job_code && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(g.job_code!);
                        toast.success(`${g.job_code} copied`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand"
                    >
                      <Hash className="h-3 w-3" />
                      {g.job_code}
                      <Copy className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {g.total} applicant{g.total === 1 ? "" : "s"} · {g.active} active · {g.rejected}{" "}
                  rejected
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border">
                <div className="grid grid-cols-[1.4fr_1fr_120px_180px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <div>Applicant</div>
                  <div>Status</div>
                  <div>Applied</div>
                  <div>Re-apply eligible</div>
                </div>
                <ul className="divide-y divide-border">
                  {g.applicants.map((a) => (
                    <li
                      key={a.application_id}
                      className="grid grid-cols-[1.4fr_1fr_120px_180px] items-center gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{a.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className={`border ${STATUS_STYLE[a.status] ?? STATUS_STYLE.applied}`}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === a.status)?.label ?? a.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs">
                        {a.cooldown_days_left > 0 ? (
                          <>
                            <span className="font-semibold text-foreground">
                              in {a.cooldown_days_left}d
                            </span>
                            <span className="text-muted-foreground">
                              {" · "}
                              {new Date(a.next_eligible_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Eligible now
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Employee Tasks Panel — admin delegation of work to employees
// ============================================================
const TASK_STATUS_STYLE: Record<string, string> = {
  to_do: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  in_progress: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  blocked: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

function EmployeeTasksPanel() {
  const qc = useQueryClient();
  const fetchEmployees = useServerFn(listEmployeesForAssignment);
  const fetchTasks = useServerFn(listAllAssignedTasks);
  const assignFn = useServerFn(assignTaskToEmployee);

  const employees = useQuery({ queryKey: ["admin-employees"], queryFn: () => fetchEmployees() });
  const tasks = useQuery({ queryKey: ["admin-all-tasks"], queryFn: () => fetchTasks() });

  const [assigneeId, setAssigneeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectRef, setProjectRef] = useState("");

  const assignM = useMutation({
    mutationFn: () =>
      assignFn({
        data: {
          assignee_id: assigneeId,
          title,
          description: description || null,
          priority,
          due_date: dueDate || null,
          project_reference: projectRef || null,
        },
      }),
    onSuccess: () => {
      toast.success("Task assigned");
      setTitle("");
      setDescription("");
      setDueDate("");
      setProjectRef("");
      qc.invalidateQueries({ queryKey: ["admin-all-tasks"] });
    },
    onError: (e: any) => toast.error(e?.message || "Assign failed"),
  });

  const canSubmit = assigneeId && title.trim().length >= 2 && !assignM.isPending;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      {/* Assign form */}
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold">Assign a task</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Delegate work to any employee. They'll see it instantly in their portal.
          </p>
          <div className="mt-5 grid gap-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder={employees.isLoading ? "Loading…" : "Select employee"} />
                </SelectTrigger>
                <SelectContent>
                  {(employees.data ?? []).map((e: EmployeeOption) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name || e.email} {e.email ? `· ${e.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ship the Q1 analytics dashboard"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What needs to be delivered, and how will we know it's done?"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
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
              <div className="space-y-2">
                <Label htmlFor="task-due">Deadline</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-proj">Project reference (optional)</Label>
              <Input
                id="task-proj"
                value={projectRef}
                onChange={(e) => setProjectRef(e.target.value)}
                placeholder="CGT-PLAT-042"
              />
            </div>
            <Button
              onClick={() => assignM.mutate()}
              disabled={!canSubmit}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {assignM.isPending ? "Assigning…" : "Assign task"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task list */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Recent assignments</h3>
          <p className="text-xs text-muted-foreground">{tasks.data?.length ?? 0} total</p>
        </div>
        <div className="mt-4 grid gap-3">
          {tasks.isLoading ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
            ))
          ) : (tasks.data ?? []).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No tasks assigned yet.
              </CardContent>
            </Card>
          ) : (
            (tasks.data ?? []).map((t: AdminTask) => (
              <Card key={t.id} className="border-border">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold">{t.title}</h4>
                      <Badge
                        variant="outline"
                        className={`border ${TASK_STATUS_STYLE[t.status] ?? ""}`}
                      >
                        {t.status.replace("_", " ")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-brand/30 text-brand text-[10px] uppercase tracking-widest"
                      >
                        {t.priority}
                      </Badge>
                    </div>
                    {t.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Assigned to{" "}
                      <span className="font-semibold text-foreground">
                        {t.assignee_name || t.assignee_email}
                      </span>
                      {t.due_date ? <> · Due {new Date(t.due_date).toLocaleDateString()}</> : null}
                      {t.project_reference ? <> · {t.project_reference}</> : null}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
