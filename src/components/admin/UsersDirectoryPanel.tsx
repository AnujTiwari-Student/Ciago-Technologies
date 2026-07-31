// Full enterprise directory panel - moved from routes/_authenticated/users.tsx
// This is the comprehensive user management view with employee details, documents, etc.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  Upload,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  FileText,
  Loader2,
  User as UserIcon,
} from "lucide-react";

import { uploadFile } from "@/lib/upload.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import {
  listDirectory,
  getUserDetail,
  upsertEmployee,
  setUserRole,
  upsertIdentityDoc,
  verifyIdentityDoc,
  listAssignables,
  DEPT_TYPES,
  EMPLOYMENT_TYPES,
  WORK_MODELS,
  PROBATION_STATUSES,
  BG_CHECK_STATUSES,
  DOC_VERIFY_STATUSES,
  ID_DOC_TYPES,
  type DirectoryRow,
  type AppRole,
} from "@/lib/users.functions";
import { useMyRoles } from "@/hooks/use-my-roles";

const DEPT_LABEL: Record<string, string> = {
  engineering: "Engineering",
  operations: "Operations",
  human_resource: "Human Resource",
  management: "Management",
  product: "Product",
  design: "Design",
  finance: "Finance",
  sales: "Sales",
  marketing: "Marketing",
  customer_support: "Customer Support",
  legal: "Legal",
  it_infrastructure: "IT Infrastructure",
};
const humanize = (s: string | null | undefined) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

function DocStatusBadge({
  approvedCount,
  totalCount,
}: {
  approvedCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const allVerified = approvedCount === totalCount;
  const noneVerified = approvedCount === 0;

  return (
    <Badge
      className={
        allVerified
          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
          : noneVerified
            ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
            : "bg-blue-500/15 text-blue-500 border-blue-500/30"
      }
    >
      {approvedCount}/{totalCount}
    </Badge>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "rose";
}) {
  const colorClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "rose"
          ? "text-rose-600 dark:text-rose-400"
          : "";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function UsersDirectoryPanel() {
  const listFn = useServerFn(listDirectory);
  const {
    data: dir,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["directory"],
    queryFn: () => listFn(),
  });

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [openUser, setOpenUser] = useState<DirectoryRow | null>(null);

  // Actor role: determine if user is admin or HR to shape UI
  const { isAdmin: actorIsAdmin, isHr: actorIsHr, checked: rolesChecked } = useMyRoles();

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
        const hay =
          `${r.full_name ?? ""} ${r.email ?? ""} ${r.designation ?? ""} ${r.team_name ?? ""}`.toLowerCase();
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
    <div className="space-y-6">
      {!canAccess && rolesChecked && (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-muted-foreground">
            You need HR or Admin privileges to view this page.
          </CardContent>
        </Card>
      )}

      {(canAccess || !rolesChecked) && (
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
                    placeholder="Search by name, email, designation…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full md:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {DEPT_TYPES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DEPT_LABEL[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {query || roleFilter !== "all" || deptFilter !== "all"
                    ? "No users match your filters"
                    : "No users found"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Dept</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Designation</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Docs</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">BG Check</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.user_id} className="border-b hover:bg-muted/30">
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium">{r.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{r.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="text-xs">
                              {r.is_admin ? "Admin" : "User"}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {r.department ? DEPT_LABEL[r.department] ?? r.department : "—"}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">{r.designation || "—"}</td>
                          <td className="py-3 px-2">
                            <DocStatusBadge
                              approvedCount={r.docs_approved_count}
                              totalCount={r.docs_total_count}
                            />
                          </td>
                          <td className="py-3 px-2">
                            <Badge
                              variant="outline"
                              className={
                                r.background_check_status === "cleared"
                                  ? "text-emerald-600 border-emerald-600/30"
                                  : r.background_check_status === "flagged"
                                    ? "text-rose-600 border-rose-600/30"
                                    : "text-amber-600 border-amber-600/30"
                              }
                            >
                              {humanize(r.background_check_status)}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <Button size="sm" variant="ghost" onClick={() => setOpenUser(r)}>
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {openUser && (
        <UserDetailSheet
          user={openUser}
          onClose={() => setOpenUser(null)}
          actorIsAdmin={actorIsAdmin}
        />
      )}
    </div>
  );
}

function UserDetailSheet({
  user,
  onClose,
  actorIsAdmin,
}: {
  user: DirectoryRow;
  onClose: () => void;
  actorIsAdmin: boolean;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getUserDetail);
  const upsertEmp = useServerFn(upsertEmployee);
  const setRole = useServerFn(setUserRole);
  const upsertDoc = useServerFn(upsertIdentityDoc);
  const verifyDoc = useServerFn(verifyIdentityDoc);
  const fetchAssignables = useServerFn(listAssignables);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["user-detail", user.user_id],
    queryFn: () => fetchDetail({ data: { user_id: user.user_id } }),
  });

  const { data: assignables } = useQuery({
    queryKey: ["assignables"],
    queryFn: () => fetchAssignables(),
  });

  const [activeTab, setActiveTab] = useState<"identity" | "organization">("identity");

  // Identity tab state
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [bgCheckStatus, setBgCheckStatus] = useState("");
  const [docVerifyStatus, setDocVerifyStatus] = useState("");
  const [notes, setNotes] = useState("");

  // Organization tab state
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [teamName, setTeamName] = useState("");
  const [doj, setDoj] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workModel, setWorkModel] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [reportingHrId, setReportingHrId] = useState("");
  const [probationStatus, setProbationStatus] = useState("");
  const [probationMonths, setProbationMonths] = useState("");

  const [role, setRoleState] = useState<AppRole>("user");

  // Initialize from detail
  useState(() => {
    if (!detail) return;
    setFullName(detail.profile?.full_name ?? "");
    setWorkEmail(detail.employee?.workEmail ?? "");
    setPersonalEmail(detail.employee?.personalEmail ?? "");
    setContactNumber(detail.employee?.contactNumber ?? "");
    setAddress(detail.employee?.address ?? "");
    setBgCheckStatus(detail.employee?.backgroundCheckStatus ?? "");
    setDocVerifyStatus(detail.employee?.docVerificationStatus ?? "");
    setNotes(detail.employee?.notes ?? "");
    setDepartment(detail.employee?.department ?? "");
    setDesignation(detail.employee?.designation ?? "");
    setTeamName(detail.employee?.teamName ?? "");
    setDoj(detail.employee?.doj ?? "");
    setEmploymentType(detail.employee?.employmentType ?? "");
    setWorkModel(detail.employee?.workModel ?? "");
    setWorkLocation(detail.employee?.workLocation ?? "");
    setBaseSalary(detail.employee?.baseSalary?.toString() ?? "");
    setReportingManagerId(detail.employee?.reportingManagerId ?? "");
    setReportingHrId(detail.employee?.reportingHrId ?? "");
    setProbationStatus(detail.employee?.probationStatus ?? "");
    setProbationMonths(detail.employee?.probationMonths?.toString() ?? "");
    setRoleState(detail.roles[0] ?? "user");
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await upsertEmp({
        data: {
          user_id: user.user_id,
          full_name: fullName.trim() || null,
          work_email: workEmail.trim() || null,
          personal_email: personalEmail.trim() || null,
          contact_number: contactNumber.trim() || null,
          address: address.trim() || null,
          department: department || null,
          designation: designation.trim() || null,
          team_name: teamName.trim() || null,
          doj: doj || null,
          employment_type: employmentType || null,
          work_model: workModel || null,
          work_location: workLocation.trim() || null,
          base_salary: baseSalary ? parseFloat(baseSalary) : null,
          reporting_manager_id: reportingManagerId || null,
          reporting_hr_id: reportingHrId || null,
          probation_months: probationMonths ? parseInt(probationMonths) : null,
          probation_status: probationStatus || undefined,
          background_check_status: bgCheckStatus || undefined,
          doc_verification_status: docVerifyStatus || undefined,
          notes: notes.trim() || null,
        },
      });

      if (role !== (detail?.roles[0] ?? "user")) {
        await setRole({ data: { user_id: user.user_id, role, department_id: null } });
      }
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["user-detail", user.user_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className="mt-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="organization">Organization</TabsTrigger>
              </TabsList>

              <TabsContent value="identity" className="space-y-4 mt-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Work Email</Label>
                  <Input value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Personal Email</Label>
                  <Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Contact Number</Label>
                  <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" rows={3} />
                </div>
                <div>
                  <Label>Background Check Status</Label>
                  <Select value={bgCheckStatus} onValueChange={setBgCheckStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BG_CHECK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanize(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Document Verification Status</Label>
                  <Select value={docVerifyStatus} onValueChange={setDocVerifyStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_VERIFY_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanize(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRoleState(v as AppRole)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={4} />
                </div>
              </TabsContent>

              <TabsContent value="organization" className="space-y-4 mt-4">
                <div>
                  <Label>Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {DEPT_TYPES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {DEPT_LABEL[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Team Name</Label>
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Date of Joining</Label>
                  <Input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {humanize(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Work Model</Label>
                  <Select value={workModel} onValueChange={setWorkModel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {WORK_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {humanize(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Work Location</Label>
                  <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Base Salary</Label>
                  <Input value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Reporting Manager</Label>
                  <Select value={reportingManagerId} onValueChange={setReportingManagerId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {assignables?.managers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name ?? m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reporting HR</Label>
                  <Select value={reportingHrId} onValueChange={setReportingHrId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {assignables?.hrs.map((h) => (
                        <SelectItem key={h.user_id} value={h.user_id}>
                          {h.full_name ?? h.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Probation Status</Label>
                  <Select value={probationStatus} onValueChange={setProbationStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROBATION_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanize(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Probation Months</Label>
                  <Input value={probationMonths} onChange={(e) => setProbationMonths(e.target.value)} className="mt-1" />
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex gap-3">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
