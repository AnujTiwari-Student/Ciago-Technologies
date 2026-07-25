import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatusKind = "job_posting" | "application" | "user_account";

export type StatusOption = {
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
};

export type DepartmentOption = {
  id: string;
  name: string;
  code: string;
};

export type EmploymentTypeOption = {
  code: string;
  label: string;
  sort_order: number;
};

export type LookupBundle = {
  departments: DepartmentOption[];
  employment_types: EmploymentTypeOption[];
  statuses: Record<StatusKind, StatusOption[]>;
};

export const listLookups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LookupBundle> => {
    const sb = context.supabase;
    const [depts, emp, stat] = await Promise.all([
      sb.from("departments").select("id, name, code").order("name", { ascending: true }),
      sb
        .from("employment_types")
        .select("code, label, sort_order")
        .order("sort_order", { ascending: true }),
      sb
        .from("status_options")
        .select("kind, code, label, description, sort_order")
        .order("sort_order", { ascending: true }),
    ]);
    if (depts.error) throw new Error(depts.error.message);
    if (emp.error) throw new Error(emp.error.message);
    if (stat.error) throw new Error(stat.error.message);

    const statuses: Record<StatusKind, StatusOption[]> = {
      job_posting: [],
      application: [],
      user_account: [],
    };
    for (const row of (stat.data ?? []) as any[]) {
      const kind = row.kind as StatusKind;
      if (!statuses[kind]) continue;
      statuses[kind].push({
        code: row.code,
        label: row.label,
        description: row.description,
        sort_order: row.sort_order,
      });
    }

    return {
      departments: (depts.data ?? []) as DepartmentOption[],
      employment_types: (emp.data ?? []) as EmploymentTypeOption[],
      statuses,
    };
  });
