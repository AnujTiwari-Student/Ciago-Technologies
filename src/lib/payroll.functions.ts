import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
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

async function requireHr(db: any, userId: string) {
  const count = await db.withRLS((tx: any) =>
    tx.userRole.count({ where: { userId, role: { in: ["hr", "admin"] } } }),
  );
  if (count === 0) throw new Error("Forbidden");
}

export const getMySalaryStructure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalaryStructure | null> => {
    const row = await context.db.withRLS((tx) =>
      tx.salaryStructure.findFirst({
        where: { userId: context.userId },
        orderBy: { effectiveFrom: "desc" },
      }),
    );
    return (row as unknown as SalaryStructure) ?? null;
  });

export const listMySalarySlips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SalarySlip[]> => {
    const rows = await context.db.withRLS((tx) =>
      tx.salarySlip.findMany({
        where: { userId: context.userId },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      }),
    );
    return rows as unknown as SalarySlip[];
  });

// ============ HR / Admin ============
export const upsertSalaryStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z
      .object({
        user_id: z.string().uuid(),
        ctc_annual_inr: z.number().positive(),
        basic_monthly: z.number().nonnegative(),
        hra_monthly: z.number().nonnegative(),
        special_monthly: z.number().nonnegative(),
        pf_employee_monthly: z.number().nonnegative(),
        pt_monthly: z.number().nonnegative(),
        effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireHr(context.db, context.userId);
    const adminDb = getAdminDb();
    const row = await adminDb.salaryStructure.create({
      data: {
        userId: data.user_id,
        ctcAnnualInr: data.ctc_annual_inr,
        basicMonthly: data.basic_monthly,
        hraMonthly: data.hra_monthly,
        specialMonthly: data.special_monthly,
        pfEmployeeMonthly: data.pf_employee_monthly,
        ptMonthly: data.pt_monthly,
        effectiveFrom: new Date(data.effective_from),
        createdBy: context.userId,
      },
    });
    return row as unknown as SalaryStructure;
  });

export const generateSalarySlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z
      .object({
        user_id: z.string().uuid(),
        period_month: z.number().int().min(1).max(12),
        period_year: z.number().int().min(2020).max(2100),
        working_days: z.number().int().min(1).max(31).default(22),
        lwp_days: z.number().min(0).max(31).default(0),
        tds: z.number().nonnegative().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireHr(context.db, context.userId);
    const adminDb = getAdminDb();

    const structure = await adminDb.salaryStructure.findFirst({
      where: { userId: data.user_id },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!structure) throw new Error("No salary structure set for this employee.");

    const { basic, hra, special, gross, pf, pt, total_deductions, net_pay } = computeSalarySlip(
      {
        basic_monthly: structure.basicMonthly,
        hra_monthly: structure.hraMonthly,
        special_monthly: structure.specialMonthly,
        pf_employee_monthly: structure.pfEmployeeMonthly,
        pt_monthly: structure.ptMonthly,
      },
      { working_days: data.working_days, lwp_days: data.lwp_days, tds: data.tds },
    );

    const row = await adminDb.salarySlip.upsert({
      where: {
        id: "00000000-0000-0000-0000-000000000000",
      },
      create: {
        userId: data.user_id,
        periodMonth: data.period_month,
        periodYear: data.period_year,
        workingDays: data.working_days,
        lwpDays: data.lwp_days,
        basic,
        hra,
        special,
        gross,
        pfEmployee: pf,
        pt,
        tds: data.tds,
        totalDeductions: total_deductions,
        netPay: net_pay,
        generatedBy: context.userId,
      },
      update: {
        workingDays: data.working_days,
        lwpDays: data.lwp_days,
        basic,
        hra,
        special,
        gross,
        pfEmployee: pf,
        pt,
        tds: data.tds,
        totalDeductions: total_deductions,
        netPay: net_pay,
        generatedBy: context.userId,
      },
    });
    return row as unknown as SalarySlip;
  });

export const listEmployeeDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireHr(context.db, context.userId);
    const adminDb = getAdminDb();

    const roles = await adminDb.userRole.findMany({
      where: { role: { in: ["employee", "manager", "hr", "admin"] } },
      select: { userId: true },
    });
    const ids = Array.from(new Set(roles.map((r) => r.userId)));
    if (!ids.length) return [];

    const profiles = await adminDb.profile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, fullName: true },
    });
    return profiles.map((p) => ({
      id: p.userId,
      full_name: p.fullName ?? null,
      email: null as string | null,
    }));
  });

export const listSalarySlipsForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SalarySlip[]> => {
    await requireHr(context.db, context.userId);
    const adminDb = getAdminDb();
    const rows = await adminDb.salarySlip.findMany({
      where: { userId: data.user_id },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return rows as unknown as SalarySlip[];
  });
