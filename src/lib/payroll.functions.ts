import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeSalarySlip } from "@/lib/payroll-utils";

export type SalaryStructure = {
  id: string;
  user_id: string;
  ctc_annual_inr: number;
  basic_monthly: number;
  hra_monthly: number;
  special_monthly: number;
  pf_employee_monthly: number;
  pt_monthly: number;
  effective_from: string;
  created_at: string;
  updated_at: string;
};

export type SalarySlip = {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  working_days: number;
  lwp_days: number;
  basic: number;
  hra: number;
  special: number;
  gross: number;
  pf_employee: number;
  pt: number;
  tds: number;
  total_deductions: number;
  net_pay: number;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
};

async function requireHr(context: any) {
  const { data } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  const roles = new Set((data ?? []).map((r: any) => r.role));
  if (!roles.has("hr") && !roles.has("admin")) throw new Error("Forbidden");
}

export const getMySalaryStructure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalaryStructure | null> => {
    const { data, error } = await context.supabase
      .from("salary_structures")
      .select("*").eq("user_id", context.userId)
      .order("effective_from", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as SalaryStructure | null;
  });

export const listMySalarySlips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalarySlip[]> => {
    const { data, error } = await context.supabase
      .from("salary_slips").select("*").eq("user_id", context.userId)
      .order("period_year", { ascending: false }).order("period_month", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SalarySlip[];
  });

// ============ HR / Admin ============
export const upsertSalaryStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    user_id: z.string().uuid(),
    ctc_annual_inr: z.number().positive(),
    basic_monthly: z.number().nonnegative(),
    hra_monthly: z.number().nonnegative(),
    special_monthly: z.number().nonnegative(),
    pf_employee_monthly: z.number().nonnegative(),
    pt_monthly: z.number().nonnegative(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireHr(context);
    const { data: row, error } = await context.supabase
      .from("salary_structures")
      .insert({ ...data, created_by: context.userId })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row as SalaryStructure;
  });

export const generateSalarySlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    user_id: z.string().uuid(),
    period_month: z.number().int().min(1).max(12),
    period_year: z.number().int().min(2020).max(2100),
    working_days: z.number().int().min(1).max(31).default(22),
    lwp_days: z.number().min(0).max(31).default(0),
    tds: z.number().nonnegative().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireHr(context);
    const { data: structure } = await context.supabase
      .from("salary_structures").select("*").eq("user_id", data.user_id)
      .order("effective_from", { ascending: false }).limit(1).maybeSingle();
    if (!structure) throw new Error("No salary structure set for this employee.");

    const { basic, hra, special, gross, pf, pt, total_deductions, net_pay } = computeSalarySlip(
      structure,
      { working_days: data.working_days, lwp_days: data.lwp_days, tds: data.tds },
    );

    const { data: row, error } = await context.supabase
      .from("salary_slips")
      .upsert({
        user_id: data.user_id,
        period_month: data.period_month,
        period_year: data.period_year,
        working_days: data.working_days,
        lwp_days: data.lwp_days,
        basic, hra, special, gross,
        pf_employee: pf, pt, tds: data.tds,
        total_deductions, net_pay,
        generated_by: context.userId,
      }, { onConflict: "user_id,period_year,period_month" })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row as SalarySlip;
  });

export const listEmployeeDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireHr(context);
    const { data: roles } = await context.supabase
      .from("user_roles").select("user_id, role")
      .in("role", ["employee", "manager", "hr", "admin"]);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (!ids.length) return [];
    const { data: profiles } = await context.supabase
      .from("profiles").select("user_id, full_name").in("user_id", ids);
    return ((profiles ?? []) as any[]).map((p) => ({
      id: p.user_id as string,
      full_name: (p.full_name as string | null) ?? null,
      email: null as string | null,
    }));
  });

export const listSalarySlipsForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SalarySlip[]> => {
    await requireHr(context);
    const { data: rows, error } = await context.supabase
      .from("salary_slips").select("*").eq("user_id", data.user_id)
      .order("period_year", { ascending: false }).order("period_month", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as SalarySlip[];
  });
