// Full enterprise directory panel - moved from routes/_authenticated/users.tsx
// This is the comprehensive user management view with employee details, documents, etc.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import {
  listDirectory,
  updateBgCheckStatus,
  updateUserAppRole,
  DEPT_TYPES,
  BG_CHECK_STATUSES,
  APP_ROLES,
  type DirectoryRow,
} from "@/lib/users.functions";
import { useMyRoles } from "@/hooks/use-my-roles";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  moderator: "Moderator",
  user: "User",
  employee: "Employee",
  hr: "HR",
  manager: "Manager",
  system_engineer: "Sys Engineer",
  developer: "Developer",
};

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
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function BgCheckSelect({ row }: { row: DirectoryRow }) {
  const qc = useQueryClient();
  const updateBgFn = useServerFn(updateBgCheckStatus);

  const mutation = useMutation({
    mutationFn: (status: string) => updateBgFn({ data: { user_id: row.user_id, status } }),
    onSuccess: () => {
      toast.success("Background check status updated");
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  return (
    <Select
      value={row.background_check_status}
      onValueChange={(v) => mutation.mutate(v)}
      disabled={mutation.isPending}
    >
      <SelectTrigger
        className={`h-7 w-[130px] text-xs border ${
          row.background_check_status === "cleared"
            ? "text-emerald-600 border-emerald-600/30"
            : row.background_check_status === "flagged"
              ? "text-rose-600 border-rose-600/30"
              : row.background_check_status === "in_progress"
                ? "text-blue-600 border-blue-600/30"
                : "text-muted-foreground border-muted-foreground/30"
        }`}
      >
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
  );
}

function RoleSelect({ row }: { row: DirectoryRow }) {
  const qc = useQueryClient();
  const updateRoleFn = useServerFn(updateUserAppRole);

  const mutation = useMutation({
    mutationFn: (role: string) => updateRoleFn({ data: { user_id: row.user_id, role } }),
    onSuccess: (_data, role) => {
      toast.success(`Role "${ROLE_LABEL[role] || role}" assigned & synced to Frappe`);
      qc.invalidateQueries({ queryKey: ["directory"] });
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const currentRole = row.is_admin ? "admin" : row.role;

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => mutation.mutate(v)}
      disabled={mutation.isPending}
    >
      <SelectTrigger
        className={`h-7 w-[120px] text-xs border ${
          currentRole === "admin"
            ? "text-purple-600 border-purple-600/30"
            : currentRole === "hr"
              ? "text-teal-600 border-teal-600/30"
              : currentRole === "manager"
                ? "text-blue-600 border-blue-600/30"
                : "text-muted-foreground border-muted-foreground/30"
        }`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {APP_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r] || humanize(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
                    {APP_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r] || humanize(r)}
                      </SelectItem>
                    ))}
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
              ) : error ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-destructive">
                    Error loading users: {(error as Error).message}
                  </p>
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
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Name
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Role
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Dept
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Designation
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Docs Status
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          BG Check
                        </th>
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
                            <RoleSelect row={r} />
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {r.department
                              ? (DEPT_LABEL[r.department] ?? humanize(r.department))
                              : "—"}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {r.designation || "—"}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <DocStatusBadge
                                approvedCount={r.docs_approved_count}
                                totalCount={r.docs_total_count}
                              />
                              <Badge
                                variant="outline"
                                className={
                                  r.doc_verification_status === "verified"
                                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                    : r.doc_verification_status === "rejected"
                                      ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                                      : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                }
                              >
                                {humanize(r.doc_verification_status)}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <BgCheckSelect row={r} />
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
    </div>
  );
}
