import { describe, it, expect } from "vitest";
import { computeSalarySlip, lwpFactor } from "../payroll-utils";

const structure = {
  basic_monthly: 50000,
  hra_monthly: 20000,
  special_monthly: 10000,
  pf_employee_monthly: 1800,
  pt_monthly: 200,
};

describe("lwpFactor", () => {
  it("returns 1 when no LWP days", () => {
    expect(lwpFactor(22, 0)).toBe(1);
  });
  it("prorates linearly", () => {
    expect(lwpFactor(20, 5)).toBeCloseTo(0.75, 5);
  });
  it("clamps to 0 when LWP exceeds working days", () => {
    expect(lwpFactor(20, 30)).toBe(0);
  });
  it("guards zero/negative working days", () => {
    expect(lwpFactor(0, 0)).toBe(0);
    expect(lwpFactor(-5, 1)).toBe(0);
  });
});

describe("computeSalarySlip", () => {
  it("computes gross/net with no LWP", () => {
    const s = computeSalarySlip(structure, { working_days: 22, lwp_days: 0, tds: 5000 });
    expect(s.gross).toBe(80000);
    expect(s.total_deductions).toBe(7000); // 1800 + 200 + 5000
    expect(s.net_pay).toBe(73000);
  });

  it("prorates every earnings component + PF but not PT/TDS", () => {
    const s = computeSalarySlip(structure, { working_days: 20, lwp_days: 5, tds: 1000 });
    // factor = 0.75
    expect(s.basic).toBe(37500);
    expect(s.hra).toBe(15000);
    expect(s.special).toBe(7500);
    expect(s.gross).toBe(60000);
    expect(s.pf).toBe(1350);
    expect(s.pt).toBe(200); // fixed statutory
    expect(s.tds).toBe(1000); // fixed input
    expect(s.total_deductions).toBe(2550);
    expect(s.net_pay).toBe(57450);
  });

  it("zeros out earnings when factor is 0", () => {
    const s = computeSalarySlip(structure, { working_days: 22, lwp_days: 30, tds: 0 });
    expect(s.gross).toBe(0);
    expect(s.pf).toBe(0);
    expect(s.net_pay).toBe(-200); // PT still owed
  });
});
