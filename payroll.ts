/** حسابات الرواتب والجباية — كل النسب تُقرأ من جدول tax_settings */

export type Bracket = { from: number; to: number | null; rate: number };

export type TaxConfig = {
  year: number;
  tva_normal: number;
  tva_reduced: number;
  tap: number;
  cnas_employee: number;
  cnas_employer: number;
  irg_brackets: Bracket[];
  timbre_rate: number;
};

/** حساب IRG بجدول تنازلي (شرائح) */
export function computeIRG(taxable: number, brackets: Bracket[]): number {
  let tax = 0;
  for (const b of brackets) {
    const upper = b.to == null ? Infinity : b.to;
    if (taxable > b.from) {
      const slice = Math.min(taxable, upper) - b.from;
      if (slice > 0) tax += (slice * b.rate) / 100;
    }
  }
  return Math.round(tax);
}

export type PayslipInput = {
  base_salary: number;
  allowances: number;
  bonus: number;
  advance_deduction: number;
  other_deductions?: number;
};

export function computePayslip(input: PayslipInput, cfg: TaxConfig) {
  const base = +input.base_salary || 0;
  const allowances = +input.allowances || 0;
  const bonus = +input.bonus || 0;
  const gross = base + allowances + bonus;
  const cnasEmployee = Math.round((gross * cfg.cnas_employee) / 100);
  const cnasEmployer = Math.round((gross * cfg.cnas_employer) / 100);
  const taxable = gross - cnasEmployee;
  const irg = computeIRG(taxable, cfg.irg_brackets);
  const advance = +input.advance_deduction || 0;
  const other = +(input.other_deductions || 0);
  const net = Math.round(gross - cnasEmployee - irg - advance - other);
  return {
    base_salary: base,
    allowances,
    bonus,
    gross,
    cnas_employee: cnasEmployee,
    cnas_employer: cnasEmployer,
    taxable,
    irg,
    advance_deduction: advance,
    other_deductions: other,
    net,
  };
}
