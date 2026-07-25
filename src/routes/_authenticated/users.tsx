import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search, Upload, ShieldCheck, ShieldAlert, ShieldX, Lock, FileText, Loader2, User as UserIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import {
  listDirectory, getUserDetail, upsertEmployee, setUserRole,
  upsertIdentityDoc, verifyIdentityDoc, listAssignables,
  DEPT_TYPES, EMPLOYMENT_TYPES, WORK_MODELS, PROBATION_STATUSES,
  BG_CHECK_STATUSES, DOC_VERIFY_STATUSES, ID_DOC_TYPES,
  type DirectoryRow, type AppRole,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User Management · Ciago Technologies" },
      { name: "description", content: "Enterprise directory & onboarding management for HR and Admin." },
      { property: "og:title", content: "User Management · Ciago Technologies" },
      { property: "og:description", content: "Enterprise directory & onboarding management for HR and Admin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: UsersPage,
});

const DEPT_LABEL: Record<string, string> = {
  engineering: "Engineering", operations: "Operations", human_resource: "Human Resource",
  management: "Management", product: "Product", design: "Design", finance: "Finance",
  sales: "Sales", marketing: "Marketing", customer_support: "Customer Support",
  legal: "Legal", it_infrastructure: "IT Infrastructure",
};
const humanize = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");

function DocStatusBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Verified</Badge>;
  if (status === "rejected") return <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30"><ShieldX className="h-3 w-3 mr-1" />Rejected</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30"><ShieldAlert className="h-3 w-3 mr-1" />Pending</Badge>;
}
function WorkModelBadge({ v }: { v: string | null }) {
  if (!v) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    onsite: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    remote: "bg-violet-500/15 text-violet-500 border-violet-500/30",
    hybrid: "bg-teal-500/15 text-teal-500 border-teal-500/30",
  };
  return <Badge className={map[v] || ""}>{humanize(v)}</Badge>;
}
function RoleBadge({ role, isAdmin }: { role: AppRole; isAdmin: boolean }) {
  const displayed: AppRole = isAdmin ? "admin" : role;
  const map: Record<AppRole, string> = {
    admin: "bg-primary/15 text-primary border-primary/30",
    hr: "bg-fuchsia-500/15 text-fuchsia-500 border-fuchsia-500/30",
    manager: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    employee: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    user: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  };
  return <Badge className={map[displayed]}>{humanize(displayed)}</Badge>;
}

function UsersPage() {
  const listFn = useServerFn(listDirectory);
  const { data: dir, isLoading, error } = useQuery({
    queryKey: ["directory"],
    queryFn: () => listFn(),
  });

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [openUser, setOpenUser] = useState<DirectoryRow | null>(null);

  // Actor role: determine if user is admin or HR to shape UI
  const [actorIsAdmin, setActorIsAdmin] = useState(false);
  const [actorIsHr, setActorIsHr] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = new Set((r ?? []).map((x: any) => x.role));
      setActorIsAdmin(roles.has("admin"));
      setActorIsHr(roles.has("hr"));
    })();
  }, []);

  const canAccess = actorIsAdmin || actorIsHr;

  const rows = useMemo(() => {
    if (!dir) return [];
    return dir.filter((r) => {
      if (roleFilter !== "all") {
        const displayed = r.is_admin ? "admin" : r.role;
        if (displayed !== roleFilter) return false;
      }
      if (deptFilter !== "all" && r.department !== deptFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${r.full_name ?? ""} ${r.email ?? ""} ${r.designation ?? ""} ${r.team_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dir, roleFilter, deptFilter, query]);

  const kpis = useMemo(() => {
    if (!dir) return { total: 0, verified: 0, pending: 0, bgFlagged: 0 };
    return {
      total: dir.length,
      verified: dir.filter((r) => r.doc_verification_status === "verified").length,
      pending: dir.filter((r) => r.doc_verification_status === "pending").length,
      bgFlagged: dir.filter((r) => r.background_check_status === "flagged").length,
    };
  }, [dir]);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 lg:px-8 py-8 max-w-7xl">
        <div className="portal-shell space-y-6">
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
              <p className="text-sm text-muted-foreground">
                Unified directory for Admin & HR — {actorIsAdmin ? "full access" : "HR access (Admin accounts are read-only)"}.
              </p>
            </div>
          </header>

          {!canAccess && !isLoading && (
            <Card className="border-destructive/40">
              <CardContent className="p-6 text-sm text-muted-foreground">
                You need HR or Admin privileges to view this page.
              </CardContent>
            </Card>
          )}

          {canAccess && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total users" value={kpis.total} />
                <KpiCard label="Docs verified" value={kpis.verified} tone="emerald" />
                <KpiCard label="Docs pending" value={kpis.pending} tone="amber" />
                <KpiCard label="BG flagged" value={kpis.bgFlagged} tone="rose" />
              </div>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Directory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, email, designation…"
                        className="pl-9"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="md:w-40"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="hr">HR</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="user">Candidate/User</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                      <SelectTrigger className="md:w-52"><SelectValue placeholder="Department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {DEPT_TYPES.map((d) => (
                          <SelectItem key={d} value={d}>{DEPT_LABEL[d]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
                  {isLoading ? (
                    <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr className="text-left">
                            <Th>Name</Th><Th>Role</Th><Th>Department</Th><Th>Designation</Th>
                            <Th>DOJ</Th><Th>Docs</Th><Th>Work</Th><Th className="text-right pr-4">Action</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No users match.</td></tr>
                          )}
                          {rows.map((r) => {
                            const hrLocked = actorIsHr && !actorIsAdmin && r.is_admin;
                            return (
                              <tr key={r.user_id} className="border-t border-border/50 hover:bg-muted/30">
                                <Td>
                                  <div className="font-medium">{r.full_name || "—"}</div>
                                  <div className="text-xs text-muted-foreground">{r.email}</div>
                                </Td>
                                <Td><RoleBadge role={r.role} isAdmin={r.is_admin} /></Td>
                                <Td>{r.department ? DEPT_LABEL[r.department] : <span className="text-muted-foreground">—</span>}</Td>
                                <Td>{r.designation || <span className="text-muted-foreground">—</span>}</Td>
                                <Td>{r.doj || <span className="text-muted-foreground">—</span>}</Td>
                                <Td><DocStatusBadge status={r.doc_verification_status} /></Td>
                                <Td><WorkModelBadge v={r.work_model} /></Td>
                                <Td className="text-right pr-4">
                                  {hrLocked ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex">
                                            <Button size="sm" variant="ghost" disabled className="gap-1">
                                              <Lock className="h-3.5 w-3.5" /> Admin
                                            </Button>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>HR users cannot modify System Admin accounts.</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => setOpenUser(r)}>Edit</Button>
                                  )}
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
      <SiteFooter />

      {openUser && (
        <EditUserDrawer
          userId={openUser.user_id}
          actorIsAdmin={actorIsAdmin}
          actorIsHr={actorIsHr}
          onClose={() => setOpenUser(null)}
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>;
}
function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" | "rose" }) {
  const toneCls = tone === "emerald" ? "text-emerald-500" : tone === "amber" ? "text-amber-500" : tone === "rose" ? "text-rose-500" : "text-primary";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EditUserDrawer({
  userId, actorIsAdmin, actorIsHr, onClose,
}: { userId: string; actorIsAdmin: boolean; actorIsHr: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getUserDetail);
  const assignableFn = useServerFn(listAssignables);
  const upsertFn = useServerFn(upsertEmployee);
  const setRoleFn = useServerFn(setUserRole);
  const upsertDocFn = useServerFn(upsertIdentityDoc);
  const verifyDocFn = useServerFn(verifyIdentityDoc);

  const detail = useQuery({ queryKey: ["user-detail", userId], queryFn: () => detailFn({ data: { user_id: userId } }) });
  const assignables = useQuery({ queryKey: ["assignables"], queryFn: () => assignableFn() });

  const targetIsAdmin = !!detail.data?.is_admin_target;
  const hrLocked = actorIsHr && !actorIsAdmin && targetIsAdmin;

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (detail.data) {
      const e: any = detail.data.employee || {};
      setForm({
        full_name: detail.data.profile?.full_name ?? "",
        work_email: e.work_email ?? "",
        personal_email: e.personal_email ?? "",
        contact_number: e.contact_number ?? "",
        address: e.address ?? "",
        department: e.department ?? "",
        team_name: e.team_name ?? "",
        designation: e.designation ?? "",
        reporting_manager_id: e.reporting_manager_id ?? "",
        reporting_hr_id: e.reporting_hr_id ?? "",
        doj: e.doj ?? "",
        employment_type: e.employment_type ?? "",
        base_salary: e.base_salary ?? "",
        salary_currency: e.salary_currency ?? "INR",
        work_model: e.work_model ?? "",
        work_location: e.work_location ?? "",
        probation_months: e.probation_months ?? "",
        probation_status: e.probation_status ?? "under_review",
        background_check_status: e.background_check_status ?? "not_started",
        doc_verification_status: e.doc_verification_status ?? "pending",
        notes: e.notes ?? "",
      });
    }
  }, [detail.data]);

  const primaryRole: AppRole = (detail.data?.roles?.[0] as AppRole) ?? "user";
  const [newRole, setNewRole] = useState<string>("");
  useEffect(() => { setNewRole(targetIsAdmin ? "admin" : primaryRole); }, [primaryRole, targetIsAdmin]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = { user_id: userId, ...form };
      // coerce
      payload.base_salary = payload.base_salary === "" ? null : Number(payload.base_salary);
      payload.probation_months = payload.probation_months === "" ? null : Number(payload.probation_months);
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      return upsertFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["user-detail", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: async () => setRoleFn({ data: { user_id: userId, role: newRole as any } }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["user-detail", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            {detail.data?.profile?.full_name || "User"}
            {targetIsAdmin && <Badge className="bg-primary/15 text-primary">Admin</Badge>}
          </SheetTitle>
          <SheetDescription>{detail.isLoading ? "Loading…" : userId}</SheetDescription>
        </SheetHeader>

        {hrLocked && (
          <div className="mt-4 p-3 rounded-md border border-amber-500/40 bg-amber-500/5 text-sm text-amber-500 flex items-center gap-2">
            <Lock className="h-4 w-4" /> HR users cannot modify System Admin accounts.
          </div>
        )}

        {detail.isLoading ? (
          <div className="space-y-2 mt-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Tabs defaultValue="identity" className="mt-6">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="org">Organisation</TabsTrigger>
              <TabsTrigger value="employ">Employment</TabsTrigger>
              <TabsTrigger value="docs">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-4 pt-4">
              <Field label="Full name"><Input value={form.full_name || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Work email"><Input type="email" value={form.work_email || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, work_email: e.target.value })} /></Field>
              <Field label="Personal email"><Input type="email" value={form.personal_email || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} /></Field>
              <Field label="Contact number"><Input value={form.contact_number || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} /></Field>
              <Field label="Address"><Textarea value={form.address || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Background check">
                  <SelectBox v={form.background_check_status} disabled={hrLocked} onV={(v) => setForm({ ...form, background_check_status: v })} options={BG_CHECK_STATUSES} />
                </Field>
                <Field label="Docs verification (rollup)">
                  <SelectBox v={form.doc_verification_status} disabled={hrLocked} onV={(v) => setForm({ ...form, doc_verification_status: v })} options={DOC_VERIFY_STATUSES} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="org" className="space-y-4 pt-4">
              <Field label="Department">
                <Select value={form.department || ""} disabled={hrLocked} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{DEPT_TYPES.map((d) => <SelectItem key={d} value={d}>{DEPT_LABEL[d]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Team"><Input value={form.team_name || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, team_name: e.target.value })} /></Field>
                <Field label="Designation"><Input value={form.designation || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
              </div>
              <Field label="Reporting Manager">
                <Select value={form.reporting_manager_id || ""} disabled={hrLocked} onValueChange={(v) => setForm({ ...form, reporting_manager_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign manager" /></SelectTrigger>
                  <SelectContent>
                    {(assignables.data?.managers ?? []).map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reporting HR">
                <Select value={form.reporting_hr_id || ""} disabled={hrLocked} onValueChange={(v) => setForm({ ...form, reporting_hr_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign HR" /></SelectTrigger>
                  <SelectContent>
                    {(assignables.data?.hrs ?? []).map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Separator />
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex gap-2">
                  <Select value={newRole} onValueChange={setNewRole} disabled={hrLocked}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {actorIsAdmin && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => roleMut.mutate()}
                    disabled={hrLocked || roleMut.isPending || !newRole || newRole === "admin" && !actorIsAdmin}
                  >
                    {roleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply role"}
                  </Button>
                </div>
                {actorIsHr && !actorIsAdmin && (
                  <p className="text-xs text-muted-foreground">Only Admins can grant the Admin role.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="employ" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Joining"><Input type="date" value={form.doj || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, doj: e.target.value })} /></Field>
                <Field label="Employment type">
                  <SelectBox v={form.employment_type} disabled={hrLocked} onV={(v) => setForm({ ...form, employment_type: v })} options={EMPLOYMENT_TYPES} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base salary"><Input type="number" value={form.base_salary ?? ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></Field>
                <Field label="Currency"><Input value={form.salary_currency || "INR"} disabled={hrLocked} onChange={(e) => setForm({ ...form, salary_currency: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Work model">
                  <SelectBox v={form.work_model} disabled={hrLocked} onV={(v) => setForm({ ...form, work_model: v })} options={WORK_MODELS} />
                </Field>
                <Field label="Work location"><Input value={form.work_location || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, work_location: e.target.value })} /></Field>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Probation months"><Input type="number" min={0} max={24} value={form.probation_months ?? ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, probation_months: e.target.value })} /></Field>
                <Field label="Probation status">
                  <SelectBox v={form.probation_status} disabled={hrLocked} onV={(v) => setForm({ ...form, probation_status: v })} options={PROBATION_STATUSES} />
                </Field>
              </div>
              <Field label="Notes"><Textarea value={form.notes || ""} disabled={hrLocked} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4 pt-4">
              <IdentityDocs
                userId={userId}
                docs={detail.data?.documents ?? []}
                hrLocked={hrLocked}
                actorCanVerify={(actorIsAdmin || actorIsHr) && !hrLocked}
                onUpload={async (docType, file) => {
                  const path = `${userId}/${docType}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
                  const { error: upErr } = await supabase.storage.from("identity-docs").upload(path, file, { upsert: true });
                  if (upErr) throw new Error(upErr.message);
                  await upsertDocFn({ data: { user_id: userId, doc_type: docType, storage_path: path } });
                  qc.invalidateQueries({ queryKey: ["user-detail", userId] });
                }}
                onVerify={async (docId, status, feedback) => {
                  await verifyDocFn({ data: { doc_id: docId, status, feedback: feedback ?? null } });
                  qc.invalidateQueries({ queryKey: ["user-detail", userId] });
                  qc.invalidateQueries({ queryKey: ["directory"] });
                }}
              />
            </TabsContent>
          </Tabs>
        )}

        {!hrLocked && !detail.isLoading && (
          <div className="mt-6 flex gap-2 sticky bottom-0 bg-background py-3 border-t">
            <Button className="flex-1" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save changes
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SelectBox({
  v, onV, options, disabled,
}: { v: string | null | undefined; onV: (v: string) => void; options: readonly string[]; disabled?: boolean }) {
  return (
    <Select value={v || ""} onValueChange={onV} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{humanize(o)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function IdentityDocs({
  userId, docs, hrLocked, actorCanVerify, onUpload, onVerify,
}: {
  userId: string;
  docs: any[];
  hrLocked: boolean;
  actorCanVerify: boolean;
  onUpload: (docType: (typeof ID_DOC_TYPES)[number], file: File) => Promise<void>;
  onVerify: (docId: string, status: "verified" | "rejected" | "pending", feedback?: string) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {ID_DOC_TYPES.map((docType) => {
        const existing = docs.find((d) => d.doc_type === docType);
        return (
          <DocRow
            key={docType}
            docType={docType}
            existing={existing}
            hrLocked={hrLocked}
            actorCanVerify={actorCanVerify}
            onUpload={onUpload}
            onVerify={onVerify}
          />
        );
      })}
      <p className="text-xs text-muted-foreground">
        Identity documents are stored privately. Access is limited to the owner, HR (non-admin targets), and Admin.
      </p>
    </div>
  );
}

function DocRow({
  docType, existing, hrLocked, actorCanVerify, onUpload, onVerify,
}: {
  docType: (typeof ID_DOC_TYPES)[number];
  existing: any;
  hrLocked: boolean;
  actorCanVerify: boolean;
  onUpload: (docType: (typeof ID_DOC_TYPES)[number], file: File) => Promise<void>;
  onVerify: (docId: string, status: "verified" | "rejected" | "pending", feedback?: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(existing?.feedback ?? "");
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{docType.toUpperCase()}</div>
            <div className="text-xs text-muted-foreground">
              {existing ? existing.storage_path?.split("/").pop() : "Not uploaded"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existing && <DocStatusBadge status={existing.status} />}
            {existing?.signed_url && (
              <Button size="sm" variant="ghost" asChild>
                <a href={existing.signed_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 mr-1" />View</a>
              </Button>
            )}
            <input
              ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf"
              onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setBusy(true);
                try { await onUpload(docType, f); toast.success("Uploaded"); }
                catch (err: any) { toast.error(err.message); }
                finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
              }}
            />
            <Button size="sm" variant="outline" disabled={hrLocked || busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1" />Upload</>}
            </Button>
          </div>
        </div>

        {existing && actorCanVerify && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Textarea
              value={feedback}
              placeholder="Reviewer feedback (optional)"
              onChange={(e) => setFeedback(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => onVerify(existing.id, "pending", feedback)}>Reset</Button>
              <Button size="sm" variant="destructive" onClick={() => onVerify(existing.id, "rejected", feedback)}>Reject</Button>
              <Button size="sm" onClick={() => onVerify(existing.id, "verified", feedback)}>Verify</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
