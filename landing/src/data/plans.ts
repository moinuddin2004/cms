/**
 * Mirrors backend/src/subscriptions/plans.ts. Keep the two in sync when a
 * price or limit changes.
 */
export interface Plan {
  key: 'free' | 'starter' | 'professional' | 'enterprise';
  name: string;
  /** PKR per month. null = priced per clinic. */
  monthlyPrice: number | null;
  /** null = unlimited */
  maxLocations: number | null;
  maxUsers: number | null;
  description: string;
  /**
   * PLACEHOLDER: the backend plans only limit branches and logins; which
   * features each plan shows here is a marketing choice still to confirm.
   */
  highlights: string[];
}

export const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    monthlyPrice: 0,
    maxLocations: 1,
    maxUsers: 2,
    description: 'For a doctor and one assistant getting started.',
    highlights: ['Appointments and queue', 'Patient records', 'Invoices and payments'],
  },
  {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: 4999,
    maxLocations: 1,
    maxUsers: 5,
    description: 'A single clinic with a small team.',
    highlights: ['Everything in Free', 'Prescriptions and treatment plans', 'Lab orders and lab payables'],
  },
  {
    key: 'professional',
    name: 'Professional',
    monthlyPrice: 9999,
    maxLocations: 3,
    maxUsers: 15,
    description: 'Up to three branches and a growing team.',
    highlights: ['Everything in Starter', 'Payroll and doctor commissions', 'Finance reports with Excel and PDF'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    maxLocations: null,
    maxUsers: null,
    description: 'Hospitals and clinic groups with many branches.',
    highlights: ['Everything in Professional', 'Priced for your branches and team'],
  },
];

/**
 * DEMO VALUES: discount for paying several months at once. Not decided by
 * the business yet; confirm before launch.
 */
export const TERMS = [
  { months: 1, label: 'Monthly', discount: 0 },
  { months: 3, label: '3 months', discount: 0.05 },
  { months: 6, label: '6 months', discount: 0.1 },
  { months: 12, label: '12 months', discount: 0.15 },
];

export function recommendPlan(branches: number, logins: number): Plan {
  return (
    PLANS.find(
      (p) =>
        (p.maxLocations === null || branches <= p.maxLocations) &&
        (p.maxUsers === null || logins <= p.maxUsers),
    ) ?? PLANS[PLANS.length - 1]
  );
}

export function formatPkr(value: number): string {
  return `Rs ${Math.round(value).toLocaleString('en-PK')}`;
}
