import type { RevenueBasis } from '../core/report.types';

/**
 * Profit & loss math (pure, integer paisa). Revenue follows the chosen
 * basis — money collected (cash in, net of refunds) or work billed
 * (issued invoices). Costs always count in the period they belong to:
 * lab bills by bill date, commission when earned, salaries by payroll
 * month, expenses by expense date.
 */

/** Raw money of one period (a month, or a whole range), in paisa. */
export interface PnlComponents {
  clinicCollected: number;
  labCollected: number;
  clinicBilled: number;
  labBilled: number;
  labCost: number;
  commission: number;
  salaries: number;
  /** Expense category → amount. */
  expenses: Record<string, number>;
}

export interface ProfitLoss {
  basis: RevenueBasis;
  revenue: { clinic: number; lab: number; total: number };
  /** Both bases, whatever was picked (dashboard shows them side by side). */
  collected: number;
  billed: number;
  directCosts: { labBills: number; commissions: number; total: number };
  grossProfit: number;
  operating: {
    salaries: number;
    expenses: Array<{ category: string; amount: number }>;
    total: number;
  };
  totalCosts: number;
  netProfit: number;
  /** Net profit as % of revenue (one decimal); null when revenue is 0. */
  marginPct: number | null;
}

export function emptyComponents(): PnlComponents {
  return {
    clinicCollected: 0,
    labCollected: 0,
    clinicBilled: 0,
    labBilled: 0,
    labCost: 0,
    commission: 0,
    salaries: 0,
    expenses: {},
  };
}

/** Adds `b` into `a` (used to roll months up into a range). */
export function addComponents(
  a: PnlComponents,
  b: PnlComponents,
): PnlComponents {
  const expenses = { ...a.expenses };
  for (const [k, v] of Object.entries(b.expenses)) {
    expenses[k] = (expenses[k] ?? 0) + v;
  }
  return {
    clinicCollected: a.clinicCollected + b.clinicCollected,
    labCollected: a.labCollected + b.labCollected,
    clinicBilled: a.clinicBilled + b.clinicBilled,
    labBilled: a.labBilled + b.labBilled,
    labCost: a.labCost + b.labCost,
    commission: a.commission + b.commission,
    salaries: a.salaries + b.salaries,
    expenses,
  };
}

export function buildProfitLoss(
  c: PnlComponents,
  basis: RevenueBasis,
): ProfitLoss {
  const clinic = basis === 'collected' ? c.clinicCollected : c.clinicBilled;
  const lab = basis === 'collected' ? c.labCollected : c.labBilled;
  const revenue = clinic + lab;
  const direct = c.labCost + c.commission;
  const expenses = Object.entries(c.expenses)
    .filter(([, amount]) => amount !== 0)
    .map(([category, amount]) => ({ category, amount }))
    .sort((x, y) => y.amount - x.amount);
  const operating = c.salaries + expenses.reduce((a, e) => a + e.amount, 0);
  const net = revenue - direct - operating;
  return {
    basis,
    revenue: { clinic, lab, total: revenue },
    collected: c.clinicCollected + c.labCollected,
    billed: c.clinicBilled + c.labBilled,
    directCosts: {
      labBills: c.labCost,
      commissions: c.commission,
      total: direct,
    },
    grossProfit: revenue - direct,
    operating: { salaries: c.salaries, expenses, total: operating },
    totalCosts: direct + operating,
    netProfit: net,
    marginPct: revenue ? Math.round((net / revenue) * 1000) / 10 : null,
  };
}

/** Change from `prev` to `curr` in % (one decimal); null when `prev` is 0. */
export function changePct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

/** Expense categories as owners read them. */
export const EXPENSE_LABEL: Record<string, string> = {
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  SUPPLIES: 'Supplies',
  SALARY: 'Salaries (expenses)',
  EQUIPMENT: 'Equipment',
  MARKETING: 'Marketing',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other expenses',
};

export const expenseLabel = (category: string) =>
  EXPENSE_LABEL[category] ?? category;
