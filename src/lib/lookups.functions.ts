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
    const [depts, emp, stat] = await context.db.withRLS((tx) =>
      Promise.all([
        tx.department.findMany({
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        }),
        tx.employmentType.findMany({
          select: { code: true, label: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        }),
        tx.statusOption.findMany({
          select: { kind: true, code: true, label: true, description: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]),
    );

    const statuses: Record<StatusKind, StatusOption[]> = {
      job_posting: [],
      application: [],
      user_account: [],
    };
    for (const row of stat) {
      const kind = row.kind as StatusKind;
      if (!statuses[kind]) continue;
      statuses[kind].push({
        code: row.code,
        label: row.label,
        description: row.description,
        sort_order: row.sortOrder,
      });
    }

    return {
      departments: depts.map((d) => ({ id: d.id, name: d.name, code: d.code })),
      employment_types: emp.map((e) => ({
        code: e.code,
        label: e.label,
        sort_order: e.sortOrder,
      })),
      statuses,
    };
  });
