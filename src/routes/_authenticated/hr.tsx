import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toCsv } from "@/lib/csv";
import { z } from "zod";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeaveApprovalsPanel, RegularizationApprovalsPanel, ResignationsListPanel } from "@/routes/_authenticated/manager";
import { HrTasksPanel } from "@/components/hr/HrTasksPanel";

import {
  generateSalarySlip,
  listEmployeeDirectory,
  listSalarySlipsForUser,
  upsertSalaryStructure,
} from "@/lib/payroll.functions";
import { Receipt } from "lucide-react";
import {
  Select as UiSelect,
  SelectContent as UiSelectContent,
  SelectItem as UiSelectItem,
  SelectTrigger as UiSelectTrigger,
  SelectValue as UiSelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  listAuditLogs,
  type AuditLog,
} from "@/lib/audit.functions";
import {
  bulkReviewOnboardingDocuments,
  getOnboardingDetail,
  listDocumentVersions,
  listOnboardingQueue,
  previewDocReviewEmail,
  reviewOnboardingDocument,
  setOnboardingDoj,
  setOnboardingVerification,
  type OnboardingDetail,
  type OnboardingDocDetail,
  type OnboardingDocVersion,
  type OnboardingQueueRow,
} from "@/lib/hr.functions";
import {
  listAllApplications,
  updateApplicationStatus,
  type AdminApplication,
} from "@/lib/admin.functions";
import {
  listAllJobPostings,
  upsertJobPosting,
  deleteJobPosting,
  type JobPosting,
} from "@/lib/jobPostings.functions";
import { useLookups } from "@/hooks/use-lookups";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { docLabel } from "@/lib/onboarding.functions";


const searchSchema = z.object({
  tab: z.enum(["verification", "audit", "pipeline", "directory", "leave", "regularizations", "tasks", "postings", "resignations"]).optional(),
});


export const Route = createFileRoute("/_authenticated/hr")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: "/hr" } });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const set = new Set((roles ?? []).map((r: any) => r.role));
    if (!set.has("hr") && !set.has("admin")) {
      throw redirect({ to: "/forbidden" as any });
    }
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "HR Portal | Ciago Technologies" },
      { name: "description", content: "Ciago HR Portal — verify onboarding documents, assign Date of Joining, and audit decisions." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HrPage,
});

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    pending: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    not_submitted: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
    changes_requested: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  };
  const label =
    status === "changes_requested"
      ? "Changes requested"
      : status === "not_submitted"
        ? "Not submitted"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge variant="outline" className={`${map[status] ?? map.pending} font-medium`}>
      {label}
    </Badge>
  );
}

function HrPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const tab = search.tab ?? "verification";
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="portal-shell sm:p-10">
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="portal-eyebrow">HR Portal</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">People Operations</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Verify onboarding documents, assign Date of Joining, and track every HR decision.
              </p>
            </div>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => nav({ to: "/hr" as any, search: { tab: v } as any })}
          className="mt-8"
        >
          <TabsList className="portal-tablist w-full justify-start">
            <TabsTrigger value="verification" className="portal-tab">
              <FileCheck2 /> Verification
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="portal-tab">
              <ClipboardList /> ATS Pipeline
            </TabsTrigger>
            <TabsTrigger value="postings" className="portal-tab">
              <ClipboardList /> Postings
            </TabsTrigger>
            <TabsTrigger value="directory" className="portal-tab">
              <FileCheck2 /> Directory
            </TabsTrigger>
            <TabsTrigger value="leave" className="portal-tab">
              <CalendarDays /> Leave Approvals
            </TabsTrigger>
            <TabsTrigger value="regularizations" className="portal-tab">
              <CalendarDays /> Regularizations
            </TabsTrigger>
            <TabsTrigger value="tasks" className="portal-tab">
              <ClipboardList /> HR Tasks
            </TabsTrigger>
            <TabsTrigger value="resignations" className="portal-tab">
              <History /> Resignations
            </TabsTrigger>
            <TabsTrigger value="audit" className="portal-tab">
              <History /> Onboarding Audit
            </TabsTrigger>
          </TabsList>



          <TabsContent value="verification" className="mt-6">
            <VerificationPanel onOpen={setSelected} />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-6">
            <HrPipelinePanel />
          </TabsContent>

          <TabsContent value="postings" className="mt-6">
            <HrPostingsPanel />
          </TabsContent>

          <TabsContent value="directory" className="mt-6">
            <HrDirectoryPanel />
          </TabsContent>


          <TabsContent value="leave" className="mt-6">
            <LeaveApprovalsPanel />
          </TabsContent>

          <TabsContent value="regularizations" className="mt-6">
            <RegularizationApprovalsPanel />
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <HrTasksPanel />
          </TabsContent>


          <TabsContent value="resignations" className="mt-6">
            <ResignationsListPanel />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <OnboardingAuditPanel />
          </TabsContent>
        </Tabs>

      </main>
      <SiteFooter />

      <OnboardingDetailDrawer
        onboardingId={selected}
        onClose={() => setSelected(null)}
      />
      <Toaster />
    </div>
  );
}

// ------------------------- Verification Queue -------------------------

function VerificationPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(listOnboardingQueue);
  const bulkFn = useServerFn(bulkReviewOnboardingDocuments);
  const { data, isLoading } = useQuery({
    queryKey: ["hr-onboarding-queue"],
    queryFn: () => fetchQueue(),
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"approved" | "changes_requested" | "rejected">("approved");
  const [bulkFeedback, setBulkFeedback] = useState("");

  const rows = useMemo(() => {
    let arr = (data ?? []) as OnboardingQueueRow[];
    if (statusFilter !== "all") arr = arr.filter((r) => r.verification_status === statusFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (r) =>
          (r.candidate_name ?? "").toLowerCase().includes(q) ||
          (r.candidate_email ?? "").toLowerCase().includes(q) ||
          (r.role_title ?? "").toLowerCase().includes(q) ||
          (r.job_code ?? "").toLowerCase().includes(q),
      );
    }
    return arr;
  }, [data, query, statusFilter]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, issues: 0, awaiting_doj: 0 };
    for (const r of (data ?? []) as OnboardingQueueRow[]) {
      if (r.verification_status === "pending") c.pending++;
      else if (r.verification_status === "approved") {
        c.approved++;
        if (!r.doj) c.awaiting_doj++;
      } else c.issues++;
    }
    return c;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<ClipboardList className="h-4 w-4" />} label="Pending review" value={counts.pending} tone="sky" />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Approved" value={counts.approved} tone="emerald" />
        <Kpi icon={<CalendarDays className="h-4 w-4" />} label="Awaiting DOJ" value={counts.awaiting_doj} tone="amber" />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Changes / Rejected" value={counts.issues} tone="rose" />
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by name, email, role, job code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="changes_requested">Changes requested</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="not_submitted">Not submitted</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-muted-foreground">
              {rows.length} of {(data ?? []).length}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-xs">
              <span className="font-medium">{selectedIds.size} selected</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Bulk-review all pending docs for selected candidates.</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                <Button size="sm" onClick={() => { setBulkStatus("approved"); setBulkFeedback(""); setBulkOpen(true); }}>
                  Bulk approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setBulkStatus("changes_requested"); setBulkFeedback(""); setBulkOpen(true); }}>
                  Request changes
                </Button>
                <Button size="sm" variant="outline" className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10" onClick={() => { setBulkStatus("rejected"); setBulkFeedback(""); setBulkOpen(true); }}>
                  Reject
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="w-8 py-2 pr-3">
                    <Checkbox
                      checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.onboarding_id))}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(rows.map((r) => r.onboarding_id)));
                        else setSelectedIds(new Set());
                      }}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Docs</th>
                  <th className="py-2 pr-3">Verification</th>
                  <th className="py-2 pr-3">DOJ</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      Nothing to review right now.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.onboarding_id} className="border-b border-border/60 last:border-none">
                      <td className="py-3 pr-3">
                        <Checkbox
                          checked={selectedIds.has(r.onboarding_id)}
                          onCheckedChange={(v) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(r.onboarding_id);
                              else next.delete(r.onboarding_id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${r.candidate_name ?? r.candidate_email ?? "row"}`}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{r.candidate_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.candidate_email ?? "—"}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{r.role_title}</span>
                          {r.track_type === "hr_track" && (
                            <Badge variant="outline" className="border-fuchsia-500/40 bg-fuchsia-500/10 text-[10px] text-fuchsia-600 dark:text-fuchsia-300">HR Track</Badge>
                          )}
                          {r.track_type === "manager_track" && (
                            <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-[10px] text-indigo-600 dark:text-indigo-300">Manager Track</Badge>
                          )}
                        </div>
                        {r.job_code && (
                          <div className="mt-1 font-mono text-[11px] text-muted-foreground">{r.job_code}</div>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{r.docs_approved}</span>
                        {" / "}
                        <span>{r.docs_total}</span>
                        {r.docs_issues > 0 && (
                          <span className="ml-2 text-rose-600 dark:text-rose-400">{r.docs_issues} ⚠</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{statusBadge(r.verification_status)}</td>
                      <td className="py-3 pr-3 text-xs">
                        {r.doj ? new Date(r.doj).toLocaleDateString("en-IN") : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {new Date(r.updated_at).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => onOpen(r.onboarding_id)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <BulkReviewDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={selectedIds.size}
        status={bulkStatus}
        feedback={bulkFeedback}
        onFeedbackChange={setBulkFeedback}
        onConfirm={async () => {
          if (selectedIds.size === 0) return;
          if ((bulkStatus === "changes_requested" || bulkStatus === "rejected") && !bulkFeedback.trim()) {
            toast.error("Feedback is required for this action.");
            return;
          }
          try {
            const res = await bulkFn({
              data: {
                onboarding_ids: Array.from(selectedIds),
                status: bulkStatus,
                feedback: bulkStatus === "approved" ? undefined : bulkFeedback.trim(),
              },
            });
            toast.success(
              `Bulk ${bulkStatus === "approved" ? "approved" : bulkStatus === "rejected" ? "rejected" : "requested changes on"} ${res.reviewed} document${res.reviewed === 1 ? "" : "s"}.`,
            );
            setBulkOpen(false);
            setSelectedIds(new Set());
            qc.invalidateQueries({ queryKey: ["hr-onboarding-queue"] });
          } catch (e: any) {
            toast.error(e?.message || "Bulk review failed");
          }
        }}
      />
    </div>
  );
}

function BulkReviewDialog({
  open,
  onOpenChange,
  count,
  status,
  feedback,
  onFeedbackChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  status: "approved" | "changes_requested" | "rejected";
  feedback: string;
  onFeedbackChange: (v: string) => void;
  onConfirm: () => void | Promise<void>;
}) {
  const label =
    status === "approved" ? "Approve" : status === "changes_requested" ? "Request changes on" : "Reject";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} pending documents</DialogTitle>
          <DialogDescription>
            This will {label.toLowerCase()} every pending document across {count} selected candidate{count === 1 ? "" : "s"}.
            Each candidate is notified by email and in-app.
          </DialogDescription>
        </DialogHeader>
        {status !== "approved" && (
          <div className="space-y-2">
            <Label htmlFor="bulk-feedback">Feedback for candidates</Label>
            <Textarea
              id="bulk-feedback"
              rows={4}
              value={feedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder="Tell candidates what needs to change…"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm}>{label} documents</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "sky" | "emerald" | "amber" | "rose";
}) {
  const toneCls: Record<typeof tone, string> = {
    sky: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
  } as const;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span className={`grid h-6 w-6 place-items-center rounded-md border ${toneCls[tone]}`}>{icon}</span>
          {label}
        </div>
        <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

// ------------------------- Detail Drawer -------------------------

function OnboardingDetailDrawer({
  onboardingId,
  onClose,
}: {
  onboardingId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getOnboardingDetail);
  const reviewFn = useServerFn(reviewOnboardingDocument);
  const dojFn = useServerFn(setOnboardingDoj);
  const verifFn = useServerFn(setOnboardingVerification);

  const enabled = !!onboardingId;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["hr-onboarding-detail", onboardingId],
    enabled,
    queryFn: () => fetchDetail({ data: { onboarding_id: onboardingId! } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr-onboarding-queue"] });
    refetch();
  };

  const reviewM = useMutation({
    mutationFn: (input: {
      document_id: string;
      status: "approved" | "changes_requested" | "rejected";
      feedback?: string;
      email_subject?: string;
      email_html?: string;
    }) => reviewFn({ data: input }),
    onSuccess: () => {
      toast.success("Document review saved and candidate notified.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Could not save review"),
  });

  const [doj, setDoj] = useState<string>("");
  useEffect(() => {
    setDoj(data?.onboarding.doj ?? "");
  }, [data?.onboarding.id, data?.onboarding.doj]);

  const dojM = useMutation({
    mutationFn: () => dojFn({ data: { onboarding_id: onboardingId!, doj } }),
    onSuccess: () => {
      toast.success("Date of Joining assigned and candidate notified.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Could not set DOJ"),
  });

  const [verifStatus, setVerifStatus] = useState<"approved" | "changes_requested" | "rejected">("approved");
  const [verifFeedback, setVerifFeedback] = useState("");
  const verifM = useMutation({
    mutationFn: () =>
      verifFn({
        data: {
          onboarding_id: onboardingId!,
          status: verifStatus,
          feedback: verifStatus === "approved" ? undefined : verifFeedback,
        },
      }),
    onSuccess: () => {
      toast.success("Overall paperwork status updated.");
      setVerifFeedback("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Could not update status"),
  });

  return (
    <Sheet open={enabled} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Onboarding review</SheetTitle>
          <SheetDescription>
            Approve, request changes, or reject each document. Assign a DOJ once paperwork is approved.
          </SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="mt-8 h-40 animate-pulse rounded-xl border border-border bg-card" />
        ) : (
          <div className="mt-6 space-y-8">
            <CandidateHeader detail={data} />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Documents</h3>
              <div className="space-y-3">
                {data.documents.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                    Candidate has not uploaded any documents yet.
                  </p>
                )}
                {data.documents.map((d) => (
                  <DocReviewCard
                    key={d.id}
                    doc={d}
                    onboardingId={data.onboarding.id}
                    required={data.required_docs.includes(d.doc_key)}
                    disabled={reviewM.isPending}
                    onSubmit={(status, feedback, overrides) =>
                      reviewM.mutate({
                        document_id: d.id,
                        status,
                        feedback,
                        email_subject: overrides?.subject,
                        email_html: overrides?.html,
                      })
                    }
                  />
                ))}
                {data.required_docs
                  .filter((k) => !data.documents.some((d) => d.doc_key === k))
                  .map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 text-xs"
                    >
                      <div>
                        <span className="font-medium">{docLabel(k)}</span>
                        <span className="ml-2 text-muted-foreground">Not uploaded yet</span>
                      </div>
                      <Badge variant="outline" className="border-slate-500/30 text-slate-500">Missing</Badge>
                    </div>
                  ))}
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Overall paperwork status</h3>
              <div className="text-xs text-muted-foreground">
                Current: {statusBadge(data.onboarding.verification_status)}
                {data.onboarding.rejection_feedback && (
                  <p className="mt-2 italic">"{data.onboarding.rejection_feedback}"</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
                <Select value={verifStatus} onValueChange={(v) => setVerifStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve paperwork</SelectItem>
                    <SelectItem value="changes_requested">Request changes</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
                {verifStatus !== "approved" && (
                  <Textarea
                    placeholder="Feedback for the candidate…"
                    value={verifFeedback}
                    onChange={(e) => setVerifFeedback(e.target.value)}
                    rows={3}
                  />
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => verifM.mutate()}
                  disabled={
                    verifM.isPending ||
                    (verifStatus !== "approved" && verifFeedback.trim().length < 4)
                  }
                  className="bg-brand text-brand-foreground hover:bg-brand-glow"
                >
                  Save decision
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Date of Joining</h3>
              <p className="text-xs text-muted-foreground">
                Assign only after paperwork is approved. Candidate is notified by email + in-app.
                Employee Portal unlocks on this date. Setting a DOJ grants the appropriate staff role.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="doj-input" className="text-xs">Effective date</Label>
                  <Input
                    id="doj-input"
                    type="date"
                    value={doj}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDoj(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
                <DojConfirmButton
                  doj={doj}
                  disabled={
                    dojM.isPending ||
                    !doj ||
                    data.onboarding.verification_status !== "approved"
                  }
                  saving={dojM.isPending}
                  hasExistingDoj={!!data.onboarding.doj}
                  candidateName={data.candidate.full_name ?? ""}
                  roleTitle={data.onboarding.role_title ?? ""}
                  onConfirm={() => dojM.mutate()}
                />
              </div>
              {data.onboarding.verification_status !== "approved" && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                  Approve overall paperwork before assigning a DOJ.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Decision trail</h3>
              <div className="rounded-lg border border-border">
                {data.audit.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">No decisions recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-xs">
                    {data.audit.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 p-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold">{a.action}</span>
                            <span className="text-muted-foreground">
                              {new Date(a.timestamp).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="mt-0.5 text-muted-foreground">
                            by {a.actor_email ?? "system"}
                          </div>
                          {a.details && (
                            <pre className="mt-1 max-w-full overflow-x-auto rounded bg-muted/40 p-2 text-[10.5px] leading-snug">
                              {JSON.stringify(a.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CandidateHeader({ detail }: { detail: OnboardingDetail }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{detail.candidate.full_name ?? "—"}</h2>
          <p className="text-xs text-muted-foreground">{detail.candidate.email ?? "—"}</p>
          <p className="mt-1 text-xs">
            <span className="font-medium">{detail.onboarding.role_title}</span>
            {detail.candidate.job_code && (
              <span className="ml-2 font-mono text-muted-foreground">{detail.candidate.job_code}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Wizard step:</span>
            <span className="font-semibold">{detail.onboarding.current_step}/4</span>
          </div>
          {detail.onboarding.submitted_at && (
            <div className="text-muted-foreground">
              Submitted {new Date(detail.onboarding.submitted_at).toLocaleDateString("en-IN")}
            </div>
          )}
        </div>
      </div>
      {detail.onboarding.emergency_contact && (
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Emergency contact:</span>{" "}
          {(detail.onboarding.emergency_contact as any).name} ·{" "}
          {(detail.onboarding.emergency_contact as any).relation} ·{" "}
          {(detail.onboarding.emergency_contact as any).phone}
        </div>
      )}
    </div>
  );
}

function DojConfirmButton({
  doj,
  disabled,
  saving,
  hasExistingDoj,
  candidateName,
  roleTitle,
  onConfirm,
}: {
  doj: string;
  disabled: boolean;
  saving: boolean;
  hasExistingDoj: boolean;
  candidateName: string;
  roleTitle: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pretty = doj ? new Date(doj).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          if (!doj) return toast.error("Pick a date first");
          setOpen(true);
        }}
        disabled={disabled}
        className="bg-brand text-brand-foreground hover:bg-brand-glow"
      >
        {saving ? "Saving…" : hasExistingDoj ? "Update DOJ" : "Assign DOJ"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Date of Joining</DialogTitle>
            <DialogDescription>
              You're about to finalize onboarding for{" "}
              <span className="font-medium text-foreground">{candidateName || "this candidate"}</span>
              {roleTitle ? <> ({roleTitle})</> : null}.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Effective date</p>
            <p className="mt-1 text-lg font-semibold">{pretty}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              On this date the candidate gains access to their portal and the correct staff role
              (Employee / Manager / HR based on the job track).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={() => { setOpen(false); onConfirm(); }}
              disabled={saving}
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              {saving ? "Saving…" : "Confirm & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HrPortalStub({
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
      <div className="p-8 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        <Button asChild className="mt-4 bg-brand text-brand-foreground hover:bg-brand-glow">
          <Link to={ctaTo as any} search={ctaSearch as any}>{ctaLabel}</Link>
        </Button>
      </div>
    </Card>
  );
}

function DocReviewCard({
  doc,
  onboardingId,
  required,
  disabled,
  onSubmit,
}: {
  doc: OnboardingDocDetail;
  onboardingId: string;
  required: boolean;
  disabled: boolean;
  onSubmit: (
    status: "approved" | "changes_requested" | "rejected",
    feedback?: string,
    overrides?: { subject?: string; html?: string },
  ) => void;
}) {
  const [feedback, setFeedback] = useState(doc.feedback ?? "");
  const [pendingStatus, setPendingStatus] = useState<"approved" | "changes_requested" | "rejected" | null>(null);
  const [customize, setCustomize] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"approved" | "changes_requested" | "rejected">("approved");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const previewFn = useServerFn(previewDocReviewEmail);
  const versionsFn = useServerFn(listDocumentVersions);

  const previewM = useMutation({
    mutationFn: (status: "approved" | "changes_requested" | "rejected") =>
      previewFn({ data: { document_id: doc.id, status, feedback: feedback.trim() || undefined } }),
    onSuccess: (res: any) => {
      setEmailSubject(res.subject);
      setEmailHtml(res.html);
    },
    onError: (e: any) => toast.error(e?.message || "Could not load template"),
  });

  const versionsQ = useQuery({
    queryKey: ["hr-doc-versions", onboardingId, doc.doc_key, showHistory],
    enabled: showHistory,
    queryFn: () => versionsFn({ data: { onboarding_id: onboardingId, doc_key: doc.doc_key } }),
  });

  const openPreview = (status: "approved" | "changes_requested" | "rejected") => {
    if ((status === "changes_requested" || status === "rejected") && feedback.trim().length < 4) {
      toast.error("Please add feedback (min 4 characters) before previewing.");
      return;
    }
    setEmailStatus(status);
    setCustomize(true);
    previewM.mutate(status);
  };

  const submit = (
    status: "approved" | "changes_requested" | "rejected",
    overrides?: { subject?: string; html?: string },
  ) => {
    if ((status === "changes_requested" || status === "rejected") && feedback.trim().length < 4) {
      toast.error("Please add feedback (min 4 characters).");
      return;
    }
    setPendingStatus(status);
    onSubmit(status, feedback.trim() || undefined, overrides);
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand" />
            <span className="font-medium">{docLabel(doc.doc_key)}</span>
            {required && (
              <Badge variant="outline" className="border-brand/40 text-brand">Required</Badge>
            )}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {doc.original_filename ?? doc.storage_path}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(doc.status)}
          {doc.signed_url && (
            <a
              href={doc.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </div>
      </div>

      <Textarea
        placeholder="Feedback shown to candidate (required for Changes / Rejected)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        className="mt-3 text-xs"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => submit("approved")}
          disabled={disabled}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          {pendingStatus === "approved" ? "Saving…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit("changes_requested")}
          disabled={disabled}
        >
          Request changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit("rejected")}
          disabled={disabled}
          className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openPreview(customize ? emailStatus : "approved")}
          disabled={disabled}
          className="ml-auto text-xs"
        >
          {customize ? "Refresh preview" : "Preview & customize email"}
        </Button>
      </div>

      {customize && (
        <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Sending as</Label>
            <Select value={emailStatus} onValueChange={(v) => { setEmailStatus(v as any); previewM.mutate(v as any); }}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approve</SelectItem>
                <SelectItem value="changes_requested">Request changes</SelectItem>
                <SelectItem value="rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setCustomize(false)}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Subject</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="h-8 text-xs"
              placeholder={previewM.isPending ? "Loading…" : "Subject"}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">HTML body</Label>
            <Textarea
              value={emailHtml}
              onChange={(e) => setEmailHtml(e.target.value)}
              rows={6}
              className="font-mono text-[11px]"
              placeholder={previewM.isPending ? "Loading…" : "Email HTML"}
            />
          </div>
          <div className="rounded border border-border bg-muted/30 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs" dangerouslySetInnerHTML={{ __html: emailHtml || "<em>No content</em>" }} />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={disabled || !emailSubject.trim() || !emailHtml.trim()}
              onClick={() =>
                submit(emailStatus, { subject: emailSubject.trim(), html: emailHtml.trim() })
              }
              className="bg-brand text-brand-foreground hover:bg-brand-glow"
            >
              Send custom email & save
            </Button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="mt-3 rounded-md border border-border p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Version history</p>
          {versionsQ.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (versionsQ.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No versions.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {(versionsQ.data ?? []).map((v: OnboardingDocVersion) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-border/60 p-2"
                >
                  <Badge variant="outline" className="border-brand/40 text-brand">v{v.version}</Badge>
                  {statusBadge(v.status)}
                  <span className="truncate text-muted-foreground">
                    {v.original_filename ?? v.storage_path}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("en-IN")}
                    {v.superseded_at && " · superseded"}
                  </span>
                  {v.signed_url && (
                    <a
                      href={v.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {doc.reviewed_at && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last reviewed {new Date(doc.reviewed_at).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}

// ------------------------- Audit Panel -------------------------

const ONBOARDING_ACTIONS = new Set([
  "ONBOARDING_DOC_REVIEWED",
  "ONBOARDING_DOJ_SET",
  "ONBOARDING_VERIFICATION_UPDATED",
]);

function OnboardingAuditPanel() {
  const fetchLogs = useServerFn(listAuditLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["hr-onboarding-audit"],
    queryFn: () => fetchLogs({ data: { limit: 500 } }),
  });

  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actorQ, setActorQ] = useState("");
  const [targetQ, setTargetQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const rows = useMemo(() => {
    let arr = ((data ?? []) as AuditLog[]).filter((r) => ONBOARDING_ACTIONS.has(r.action));
    if (actionFilter !== "all") arr = arr.filter((r) => r.action === actionFilter);
    if (actorQ.trim()) {
      const q = actorQ.trim().toLowerCase();
      arr = arr.filter((r) => (r.actor_email ?? "").toLowerCase().includes(q));
    }
    if (targetQ.trim()) {
      const q = targetQ.trim().toLowerCase();
      arr = arr.filter(
        (r) =>
          (r.target_resource ?? "").toLowerCase().includes(q) ||
          JSON.stringify(r.details ?? "").toLowerCase().includes(q),
      );
    }
    if (fromDate) {
      const t = new Date(fromDate).getTime();
      arr = arr.filter((r) => new Date(r.timestamp).getTime() >= t);
    }
    if (toDate) {
      const t = new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1;
      arr = arr.filter((r) => new Date(r.timestamp).getTime() <= t);
    }
    return arr;
  }, [data, actionFilter, actorQ, targetQ, fromDate, toDate]);

  const clearFilters = () => {
    setActionFilter("all");
    setActorQ("");
    setTargetQ("");
    setFromDate("");
    setToDate("");
  };

  const exportCsv = () => {
    const csv = toCsv(
      ["timestamp", "actor_email", "action", "target_resource", "details"],
      rows.map((r) => [r.timestamp, r.actor_email ?? "", r.action, r.target_resource ?? "", r.details]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onboarding-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="ONBOARDING_DOC_REVIEWED">Doc reviewed</SelectItem>
              <SelectItem value="ONBOARDING_VERIFICATION_UPDATED">Verification updated</SelectItem>
              <SelectItem value="ONBOARDING_DOJ_SET">DOJ assigned</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Actor email" value={actorQ} onChange={(e) => setActorQ(e.target.value)} />
          <Input placeholder="Target / candidate / details" value={targetQ} onChange={(e) => setTargetQ(e.target.value)} />
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{rows.length} entries</span>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">No decisions yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top last:border-none">
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 pr-3 text-xs">{r.actor_email ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs font-medium">{r.action}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{r.target_resource}</td>
                    <td className="py-2 text-xs">
                      <pre className="max-w-md overflow-x-auto rounded bg-muted/40 p-2 text-[10.5px] leading-snug">
                        {JSON.stringify(r.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// PAYROLL ADMIN
// ============================================================
const inrHR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function PayrollAdminPanel() {
  const qc = useQueryClient();
  const dirFn = useServerFn(listEmployeeDirectory);
  const slipsFn = useServerFn(listSalarySlipsForUser);
  const upsertFn = useServerFn(upsertSalaryStructure);
  const genFn = useServerFn(generateSalarySlip);
  const dir = useQuery({ queryKey: ["hr-directory"], queryFn: () => dirFn() });
  const [userId, setUserId] = useState<string>("");
  const slips = useQuery({
    queryKey: ["hr-slips", userId],
    queryFn: () => slipsFn({ data: { user_id: userId } }),
    enabled: !!userId,
  });

  const [struct, setStruct] = useState({
    ctc_annual_inr: 1200000, basic_monthly: 40000, hra_monthly: 20000, special_monthly: 30000,
    pf_employee_monthly: 1800, pt_monthly: 200,
    effective_from: new Date().toISOString().slice(0, 10),
  });
  const [gen, setGen] = useState({
    period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear(),
    working_days: 22, lwp_days: 0, tds: 0,
  });

  const saveStruc = useMutation({
    mutationFn: () => upsertFn({ data: { user_id: userId, ...struct } }),
    onSuccess: () => { toast.success("Salary structure saved"); qc.invalidateQueries({ queryKey: ["hr-slips", userId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const genSlip = useMutation({
    mutationFn: () => genFn({ data: { user_id: userId, ...gen } }),
    onSuccess: () => { toast.success("Salary slip generated"); qc.invalidateQueries({ queryKey: ["hr-slips", userId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="border-border"><CardContent className="p-5 space-y-3">
        <Label>Select employee</Label>
        <UiSelect value={userId} onValueChange={setUserId}>
          <UiSelectTrigger><UiSelectValue placeholder="Choose an employee" /></UiSelectTrigger>
          <UiSelectContent>
            {(dir.data ?? []).map((u: any) => (
              <UiSelectItem key={u.id} value={u.id}>{u.full_name ?? u.id.slice(0, 8)}</UiSelectItem>
            ))}
          </UiSelectContent>
        </UiSelect>
      </CardContent></Card>

      {userId ? (
        <>
          <Card className="border-border"><CardContent className="p-5 space-y-4">
            <div className="text-sm font-semibold">Salary structure (creates a new effective revision)</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Annual CTC (₹)</Label><Input type="number" value={struct.ctc_annual_inr} onChange={(e) => setStruct({ ...struct, ctc_annual_inr: +e.target.value })} /></div>
              <div><Label>Basic / mo</Label><Input type="number" value={struct.basic_monthly} onChange={(e) => setStruct({ ...struct, basic_monthly: +e.target.value })} /></div>
              <div><Label>HRA / mo</Label><Input type="number" value={struct.hra_monthly} onChange={(e) => setStruct({ ...struct, hra_monthly: +e.target.value })} /></div>
              <div><Label>Special / mo</Label><Input type="number" value={struct.special_monthly} onChange={(e) => setStruct({ ...struct, special_monthly: +e.target.value })} /></div>
              <div><Label>PF Employee / mo</Label><Input type="number" value={struct.pf_employee_monthly} onChange={(e) => setStruct({ ...struct, pf_employee_monthly: +e.target.value })} /></div>
              <div><Label>PT / mo</Label><Input type="number" value={struct.pt_monthly} onChange={(e) => setStruct({ ...struct, pt_monthly: +e.target.value })} /></div>
              <div><Label>Effective from</Label><Input type="date" value={struct.effective_from} onChange={(e) => setStruct({ ...struct, effective_from: e.target.value })} /></div>
            </div>
            <Button onClick={() => saveStruc.mutate()} disabled={saveStruc.isPending} className="bg-brand text-brand-foreground hover:bg-brand-glow">Save structure</Button>
          </CardContent></Card>

          <Card className="border-border"><CardContent className="p-5 space-y-4">
            <div className="text-sm font-semibold">Generate salary slip</div>
            <div className="grid gap-3 sm:grid-cols-5">
              <div><Label>Month</Label><Input type="number" min={1} max={12} value={gen.period_month} onChange={(e) => setGen({ ...gen, period_month: +e.target.value })} /></div>
              <div><Label>Year</Label><Input type="number" min={2020} max={2100} value={gen.period_year} onChange={(e) => setGen({ ...gen, period_year: +e.target.value })} /></div>
              <div><Label>Working days</Label><Input type="number" min={1} max={31} value={gen.working_days} onChange={(e) => setGen({ ...gen, working_days: +e.target.value })} /></div>
              <div><Label>LWP days</Label><Input type="number" min={0} max={31} step="0.5" value={gen.lwp_days} onChange={(e) => setGen({ ...gen, lwp_days: +e.target.value })} /></div>
              <div><Label>TDS (₹)</Label><Input type="number" min={0} value={gen.tds} onChange={(e) => setGen({ ...gen, tds: +e.target.value })} /></div>
            </div>
            <Button onClick={() => genSlip.mutate()} disabled={genSlip.isPending} className="bg-brand text-brand-foreground hover:bg-brand-glow">Generate slip</Button>
          </CardContent></Card>

          <Card className="border-border"><CardContent className="p-5">
            <div className="mb-3 text-sm font-semibold">Existing slips</div>
            {slips.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (slips.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No slips generated yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {(slips.data ?? []).map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{String(s.period_month).padStart(2, "0")}/{s.period_year} · LWP {s.lwp_days}d</span>
                    <span className="font-mono">₹ {inrHR.format(s.net_pay)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </>
      ) : null}
    </div>
  );
}


// ============================================================
// HR PIPELINE — ATS view over all applications (HR + Admin)
// ============================================================
const APP_STATUS_STYLE: Record<string, string> = {
  applied: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  screening: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  interviewing: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  offered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  hired: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

function HrPipelinePanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllApplications);
  const updateFn = useServerFn(updateApplicationStatus);
  const appStatuses = useLookups().statuses.application;
  const { data, isLoading } = useQuery({
    queryKey: ["hr-pipeline-apps"],
    queryFn: () => listFn(),
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((a: AdminApplication) => {
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

  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      updateFn({ data: { id: v.id, status: v.status as any } }),
    onSuccess: () => {
      toast.success("Status updated — candidate notified");
      qc.invalidateQueries({ queryKey: ["hr-pipeline-apps"] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by name, email, role, job code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {appStatuses.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">{rows.length} results</Badge>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Candidate</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Applied</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No applications match.</td></tr>
              ) : rows.map((a: AdminApplication) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{a.full_name}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <div>{a.role_title}</div>
                    {a.role_id && <div className="font-mono text-[10px] text-muted-foreground">{a.role_id}</div>}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className={APP_STATUS_STYLE[a.status] ?? ""}>
                      {a.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={a.status} onValueChange={(v) => update.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {appStatuses.map((s) => (
                            <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {a.resume_link && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={a.resume_link} target="_blank" rel="noreferrer">Resume</a>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// HR POSTINGS — create/edit/archive job requisitions
// ============================================================
type PostingDraft = {
  id?: string;
  title: string;
  department: string;
  location: string;
  is_remote: boolean;
  employment_type: string;
  summary: string;
  description: string;
  requirements: string;
  tags: string;
  salary_min_inr: string;
  salary_max_inr: string;
  status: "draft" | "published" | "internal_only" | "closed" | "archived";
};

const EMPTY_POSTING: PostingDraft = {
  title: "",
  department: "",
  location: "",
  is_remote: false,
  employment_type: "full_time",
  summary: "",
  description: "",
  requirements: "",
  tags: "",
  salary_min_inr: "",
  salary_max_inr: "",
  status: "draft",
};

function HrPostingsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllJobPostings);
  const upsertFn = useServerFn(upsertJobPosting);
  const deleteFn = useServerFn(deleteJobPosting);
  const lookups = useLookups();
  const { data, isLoading } = useQuery({
    queryKey: ["hr-postings"],
    queryFn: () => listFn(),
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PostingDraft>(EMPTY_POSTING);

  const openNew = () => { setDraft(EMPTY_POSTING); setOpen(true); };
  const openEdit = (p: JobPosting) => {
    setDraft({
      id: p.id,
      title: p.title,
      department: p.department,
      location: p.location,
      is_remote: p.is_remote,
      employment_type: p.employment_type,
      summary: p.summary,
      description: p.description,
      requirements: (p.requirements ?? []).join("\n"),
      tags: (p.tags ?? []).join(", "),
      salary_min_inr: p.salary_min_inr?.toString() ?? "",
      salary_max_inr: p.salary_max_inr?.toString() ?? "",
      status: p.status,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: draft.id,
        title: draft.title,
        department: draft.department,
        location: draft.location,
        is_remote: draft.is_remote,
        employment_type: draft.employment_type,
        summary: draft.summary,
        description: draft.description,
        requirements: draft.requirements.split("\n").map((s) => s.trim()).filter(Boolean),
        tags: draft.tags.split(",").map((s) => s.trim()).filter(Boolean),
        salary_min_inr: draft.salary_min_inr ? Number(draft.salary_min_inr) : null,
        salary_max_inr: draft.salary_max_inr ? Number(draft.salary_max_inr) : null,
        status: draft.status,
      } as any,
    }),
    onSuccess: () => {
      toast.success(draft.id ? "Posting updated" : "Posting created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["hr-postings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Posting deleted");
      qc.invalidateQueries({ queryKey: ["hr-postings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Job postings</h3>
            <p className="text-sm text-muted-foreground">Create and manage all requisitions.</p>
          </div>
          <Button onClick={openNew} className="bg-brand text-brand-foreground hover:bg-brand-glow">
            New posting
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : (data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No postings yet.</td></tr>
              ) : (data ?? []).map((p: JobPosting) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3 font-medium">{p.title}</td>
                  <td className="py-2 pr-3">{p.department}</td>
                  <td className="py-2 pr-3">{p.is_remote ? "Remote" : p.location}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{p.job_code ?? "—"}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className="capitalize">{p.status}</Badge></td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={() => { if (confirm(`Delete "${p.title}"?`)) remove.mutate(p.id); }}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit posting" : "New posting"}</DialogTitle>
              <DialogDescription>Fields marked required will be validated on save.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label>Department</Label>
                <Select value={draft.department} onValueChange={(v) => setDraft({ ...draft, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {lookups.departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Location</Label><Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></div>
              <div><Label>Employment type</Label>
                <Select value={draft.employment_type} onValueChange={(v) => setDraft({ ...draft, employment_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {lookups.employment_types.map((t) => (
                      <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={draft.status} onValueChange={(v: any) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lookups.statuses.job_posting.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="hr-remote" checked={draft.is_remote} onCheckedChange={(v) => setDraft({ ...draft, is_remote: !!v })} />
                <Label htmlFor="hr-remote">Remote</Label>
              </div>
              <div><Label>Salary min (INR)</Label><Input type="number" value={draft.salary_min_inr} onChange={(e) => setDraft({ ...draft, salary_min_inr: e.target.value })} /></div>
              <div><Label>Salary max (INR)</Label><Input type="number" value={draft.salary_max_inr} onChange={(e) => setDraft({ ...draft, salary_max_inr: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Summary</Label><Textarea rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Requirements (one per line)</Label><Textarea rows={4} value={draft.requirements} onChange={(e) => setDraft({ ...draft, requirements: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Tags (comma-separated)</Label><Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-brand text-brand-foreground hover:bg-brand-glow">
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// HR DIRECTORY — staff roster (name lookup)
// ============================================================
function HrDirectoryPanel() {
  const dirFn = useServerFn(listEmployeeDirectory);
  const { data, isLoading } = useQuery({ queryKey: ["hr-directory-panel"], queryFn: () => dirFn() });
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data ?? []).filter((u: any) =>
      !query || (u.full_name ?? "").toLowerCase().includes(query),
    );
  }, [data, q]);
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Employee directory</h3>
            <p className="text-sm text-muted-foreground">All active staff visible to HR.</p>
          </div>
          <Input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </div>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No staff found.</div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3 text-sm">
                <span className="font-medium">{u.full_name ?? "Unnamed"}</span>
                <span className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


