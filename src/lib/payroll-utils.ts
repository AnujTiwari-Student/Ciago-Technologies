// Pure helpers for salary slip math. Kept dependency-free so they can be
// unit-tested without pulling the server runtime.

export type SalaryStructureLike = {
  basic_monthly: number;
  hra_monthly: number;
  special_monthly: number;
  pf_employee_monthly: number;
  pt_monthly: number;
};

export type SlipInput = {
  working_days: number;
  lwp_days: number;
  tds: number;
};

export type SlipComputation = {
  factor: number;
  basic: number;
  hra: number;
  special: number;
  gross: number;
  pf: number;
  pt: number;
  tds: number;
  total_deductions: number;
  net_pay: number;
};

const r2 = (n: number) => Number(n.toFixed(2));

/** Loss-of-Pay proration factor bounded to [0, 1]. */
export function lwpFactor(working_days: number, lwp_days: number): number {
  if (!Number.isFinite(working_days) || working_days <= 0) return 0;
  const raw = (working_days - Math.max(0, lwp_days)) / working_days;
  return Math.min(1, Math.max(0, raw));
}

/** Compute a monthly salary slip breakdown for the given structure + attendance. */
export function computeSalarySlip(
  structure: SalaryStructureLike,
  input: SlipInput,
): SlipComputation {
  const factor = lwpFactor(input.working_days, input.lwp_days);
  const basic = r2(structure.basic_monthly * factor);
  const hra = r2(structure.hra_monthly * factor);
  const special = r2(structure.special_monthly * factor);
  const gross = r2(basic + hra + special);
  const pf = r2(structure.pf_employee_monthly * factor);
  const pt = r2(structure.pt_monthly);
  const tds = r2(input.tds);
  const total_deductions = r2(pf + pt + tds);
  const net_pay = r2(gross - total_deductions);
  return { factor, basic, hra, special, gross, pf, pt, tds, total_deductions, net_pay };
}
