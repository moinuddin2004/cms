import { randomUUID } from 'crypto';
import { ExpensesService } from 'src/billing/expenses.service';
import { InvoicesService } from 'src/billing/invoices/invoices.service';
import { RefundsService } from 'src/billing/refunds/refunds.service';
import { CreditPackagesService } from 'src/billing/credit-packages.service';
import { PatientCreditsService } from 'src/billing/patient-credits.service';
import {
  ChargeSource,
  ChargeStatus,
  ExpenseCategory,
  ExpensePaymentMethod,
} from 'src/billing/enums/billing.enums';
import { PayrollService } from 'src/payroll/payroll.service';
import { PaymentMethod as PayrollMethod } from 'src/payroll/enums/payroll.enums';
import { zonedTimeToUtc } from 'src/common/clock/tz.util';
import { realNow, travelTo } from '../lib/time-travel';
import {
  SeedClinic,
  SeedContext,
  addDays,
  deskUserId,
  log,
  tenant,
} from '../lib/context';
import {
  accountsFor,
  billingCtx,
  financeEmployee,
  financeUser,
} from './03-billing-setup';

const TZ = 'Asia/Karachi';
const at = (ymd: string, hhmm: string) => zonedTimeToUtc(TZ, ymd, hhmm);

/**
 * Finance after the history, each action on a believable date:
 * running expenses for the last ~3 months, a few credit-package sales,
 * refunds (one full, one partial) and a cancelled invoice, and payroll for
 * the last two complete months — which settles the commission doctors'
 * earnings (commission settlements are created by payroll generation).
 */
export async function seedBillingExtras(ctx: SeedContext): Promise<void> {
  for (const clinic of ctx.clinics) {
    const counts = { expenses: 0, credits: 0, refunds: 0, cancelled: 0, payroll: 0, paid: 0 };
    for (const loc of clinic.locations) counts.expenses += await seedExpenses(ctx, clinic, loc.key);
    counts.credits = await sellCreditPackages(ctx, clinic);
    const fix = await refundsAndVoid(ctx, clinic);
    counts.refunds = fix.refunds;
    counts.cancelled = fix.cancelled;
    for (const loc of clinic.locations) {
      const p = await seedPayroll(ctx, clinic, loc.key);
      counts.payroll += p.generated;
      counts.paid += p.paid;
    }
    log(
      `${clinic.name}: ${counts.expenses} expenses, ${counts.credits} credit packages sold, ` +
        `${counts.refunds} refunds, ${counts.cancelled} cancelled invoice(s), ` +
        `${counts.payroll} payroll records (${counts.paid} paid)`,
    );
  }
}

// ─── Expenses ───────────────────────────────────────────────────────────

interface ExpenseDef {
  day: number; // day of month
  category: ExpenseCategory;
  description: string;
  amount: [number, number];
  method: ExpensePaymentMethod;
  /** Chance it happens in a given month (default every month). */
  chance?: number;
}

const RENT: Record<string, number> = { clifton: 350000, gulshan: 180000, dha: 280000, f8: 220000 };
const POWER: Record<string, string> = { Karachi: 'K-Electric', Lahore: 'LESCO', Islamabad: 'IESCO' };
const GAS: Record<string, string> = { Karachi: 'SSGC', Lahore: 'SNGPL', Islamabad: 'SNGPL' };
const NET: Record<string, string> = { Karachi: 'StormFiber', Lahore: 'PTCL Flash Fiber', Islamabad: 'Nayatel' };
const CITY: Record<string, string> = { clifton: 'Karachi', gulshan: 'Karachi', dha: 'Lahore', f8: 'Islamabad' };

function expenseDefs(kind: SeedClinic['kind'], locationKey: string): ExpenseDef[] {
  const city = CITY[locationKey] ?? 'Karachi';
  const rent = RENT[locationKey] ?? 200000;
  const dental = kind === 'dental';
  return [
    { day: 3, category: ExpenseCategory.RENT, description: 'Monthly rent — clinic premises', amount: [rent, rent], method: ExpensePaymentMethod.BANK_TRANSFER },
    { day: 10, category: ExpenseCategory.UTILITIES, description: `${POWER[city]} electricity bill`, amount: [45000, 95000], method: ExpensePaymentMethod.ONLINE },
    { day: 12, category: ExpenseCategory.UTILITIES, description: `${GAS[city]} gas bill`, amount: [2500, 6000], method: ExpensePaymentMethod.ONLINE },
    { day: 14, category: ExpenseCategory.UTILITIES, description: `${NET[city]} internet (100 Mbps)`, amount: [7500, 7500], method: ExpensePaymentMethod.ONLINE },
    { day: 16, category: ExpenseCategory.UTILITIES, description: 'Water tanker / mineral water', amount: [3000, 7000], method: ExpensePaymentMethod.CASH },
    {
      day: 6,
      category: ExpenseCategory.SUPPLIES,
      description: dental ? 'Dental consumables — composite, GIC, burs, gloves' : 'Medical consumables — syringes, cannulas, test strips',
      amount: dental ? [35000, 75000] : [20000, 45000],
      method: ExpensePaymentMethod.BANK_TRANSFER,
    },
    {
      day: 20,
      category: ExpenseCategory.SUPPLIES,
      description: dental ? 'Impression material, anaesthetic cartridges, sterilization pouches' : 'Dressings, IV sets, nebulizer masks',
      amount: dental ? [18000, 40000] : [10000, 25000],
      method: ExpensePaymentMethod.CASH,
    },
    { day: 22, category: ExpenseCategory.MAINTENANCE, description: dental ? 'Dental chair & compressor servicing' : 'AC servicing and generator maintenance', amount: [8000, 25000], method: ExpensePaymentMethod.CASH, chance: 0.6 },
    { day: 25, category: ExpenseCategory.MARKETING, description: 'Facebook & Instagram ads', amount: [10000, 20000], method: ExpensePaymentMethod.CARD, chance: 0.7 },
    { day: 27, category: ExpenseCategory.OTHER, description: 'Staff tea, refreshments & cleaning supplies', amount: [6000, 12000], method: ExpensePaymentMethod.CASH },
    { day: 18, category: ExpenseCategory.EQUIPMENT, description: dental ? 'Replacement handpiece (high speed)' : 'Digital BP apparatus & pulse oximeter', amount: [15000, 45000], method: ExpensePaymentMethod.BANK_TRANSFER, chance: 0.25 },
  ];
}

async function seedExpenses(ctx: SeedContext, clinic: SeedClinic, locationKey: string): Promise<number> {
  const svc = ctx.app.get(ExpensesService);
  const t = tenant(clinic, locationKey);
  // App bug worked around: the controller passes users.uuid, but
  // expenses.recorded_by references employees(id) — pass the employee id.
  const recorder = financeEmployee(clinic, locationKey)?.employeeId ?? undefined;
  const from = addDays(ctx.today, -ctx.historyDays);
  let n = 0;
  for (const month of monthsBetween(from, ctx.today)) {
    for (const def of expenseDefs(clinic.kind, locationKey)) {
      if (def.chance != null && !ctx.rng.chance(def.chance)) continue;
      const ymd = `${month}-${String(def.day).padStart(2, '0')}`;
      if (ymd < from || ymd >= ctx.today) continue;
      const [lo, hi] = def.amount;
      const amount = lo === hi ? lo : Math.round(ctx.rng.int(lo, hi) / 100) * 100;
      travelTo(at(ymd, '13:00'));
      await svc.create(
        t,
        {
          category: def.category,
          description: def.description,
          amount,
          expenseDate: ymd,
          paymentMethod: def.method,
          referenceNumber:
            def.method === ExpensePaymentMethod.CASH ? undefined : `REF-${ctx.rng.int(100000, 999999)}`,
        },
        recorder as string,
      );
      n++;
    }
  }
  return n;
}

/** `YYYY-MM` of every month touching [from, to]. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key >= end) return out;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

// ─── Credit packages ────────────────────────────────────────────────────

async function sellCreditPackages(ctx: SeedContext, clinic: SeedClinic): Promise<number> {
  const pkgs = await ctx.app.get(CreditPackagesService).findAll(clinic.orgId);
  const credits = ctx.app.get(PatientCreditsService);
  const loc = clinic.locations[0];
  // Same FK as expenses: purchased_by references employees(id), not users.
  const seller = financeEmployee(clinic, loc.key)?.employeeId ?? null;
  const buyers = clinic.patients.filter((p) => p.locationKey === loc.key).slice(0, 3);
  let n = 0;
  for (const [i, p] of buyers.entries()) {
    if (!pkgs.length || !seller) break;
    // Spread over the second half of the history, never before registration.
    let day = addDays(ctx.today, -Math.floor(ctx.historyDays / 2) + i * Math.ceil(ctx.historyDays / 8));
    if (day < p.registeredOn) day = p.registeredOn;
    if (day >= addDays(ctx.today, -1)) continue;
    travelTo(at(day, '17:30'));
    const credit = await credits.purchasePackage(p.id, pkgs[i % pkgs.length].id, clinic.orgId, loc.id, seller);
    n++;
    if (i === 0) {
      // First buyer already used part of it.
      const used = addDays(day, Math.min(10, Math.floor((Date.parse(ctx.today) - Date.parse(day)) / 864e5) - 1));
      travelTo(at(used, '18:00'));
      await credits.useCredit(credit.id, clinic.orgId, Math.round(Number(credit.totalAmount) / 2), p.id);
    }
  }
  return n;
}

// ─── Refunds + a cancelled invoice ──────────────────────────────────────

/**
 * Done this morning, after the last cash close, so the cash refunds fall
 * into the counter's open window (closed windows never change).
 */
async function refundsAndVoid(
  ctx: SeedContext,
  clinic: SeedClinic,
): Promise<{ refunds: number; cancelled: number }> {
  const { ds } = ctx.app;
  const loc = clinic.locations[0];
  const t = tenant(clinic, loc.key);
  let refunds = 0;
  let cancelled = 0;

  const [last]: Array<{ at: string | null }> = await ds.query(
    `SELECT max(period_end) AS at FROM cash_closes WHERE organization_id = $1 AND location_id = $2`,
    [t.organizationId, t.locationId],
  );
  const lastClose: Date | null = last?.at ? new Date(last.at) : null;
  // Today 10:30 (or a bit before the real now if that is earlier), never before the last close.
  const real = realNow().getTime() - 5 * 60_000;
  let when = Math.min(at(ctx.today, '10:30').getTime(), real);
  if (lastClose) when = Math.max(when, lastClose.getTime() + 10 * 60_000);
  travelTo(new Date(when));

  const finance = await billingCtx(ctx, clinic, loc.key, financeUser(clinic, loc.key));
  const refundSvc = ctx.app.get(RefundsService);
  const invoiceSvc = ctx.app.get(InvoicesService);
  const { cash } = await accountsFor(ctx, clinic, loc.key);

  // Fully paid, never refunded, recent visit invoices (no treatment-plan bills).
  const paid: Array<{ id: string; n: number }> = await ds.query(
    `SELECT i.id, count(c.id)::int AS n
       FROM invoices i
       JOIN charges c ON c.invoice_id = i.id AND c.status = 'ACTIVE'
      WHERE i.organization_id = $1 AND i.location_id = $2 AND i.status = 'ISSUED'
        AND i.total_amount > 0 AND i.paid_amount = i.total_amount AND i.refunded_amount = 0
        AND i.issue_date >= $3
        AND NOT EXISTS (SELECT 1 FROM charges x WHERE x.invoice_id = i.id AND x.source = 'TREATMENT_PLAN')
      GROUP BY i.id, i.issue_date, i.invoice_number
      ORDER BY i.issue_date DESC, i.invoice_number DESC
      LIMIT 30`,
    [t.organizationId, t.locationId, addDays(ctx.today, -30)],
  );

  // Partial: one line of a multi-line invoice wasn't done.
  const partial = paid.find((r) => r.n >= 2);
  if (partial) {
    const inv = await invoiceSvc.detail(t, partial.id);
    // The cheapest treatment line (else the cheapest line) wasn't done.
    const active = inv.charges!.filter((c) => c.status === ChargeStatus.ACTIVE);
    const treatments = active.filter((c) => c.source !== ChargeSource.CONSULTATION);
    const line = [...(treatments.length ? treatments : active)].sort(
      (a, b) => a.payableAmount - b.payableAmount,
    )[0];
    await refundSvc.createInvoiceRefund(finance, inv.id, {
      edit: {
        expectedRevision: inv.revision,
        operations: [{ op: 'voidCharge', chargeId: line.id }],
        reason: `${line.description} not performed — patient declined`,
      },
      refund: {
        amount: line.payableAmount,
        paymentAccountId: cash,
        reason: `${line.description} not performed — refunded in cash`,
        clientRequestId: randomUUID(),
      },
    });
    refunds++;
  }

  // Full: one clinic (the busiest) also refunds a whole invoice.
  const full = clinic.key === 'smilecare' ? paid.find((r) => r.id !== partial?.id) : undefined;
  if (full) {
    const inv = await invoiceSvc.detail(t, full.id);
    const active = inv.charges!.filter((c) => c.status === ChargeStatus.ACTIVE);
    await refundSvc.createInvoiceRefund(finance, inv.id, {
      edit: {
        expectedRevision: inv.revision,
        operations: active.map((c) => ({ op: 'voidCharge' as const, chargeId: c.id })),
        reason: 'Patient complaint — visit waived by the clinic manager',
      },
      refund: {
        amount: inv.paidAmount,
        paymentAccountId: cash,
        reason: 'Full refund — visit waived after complaint',
        clientRequestId: randomUUID(),
      },
    });
    refunds++;
  }

  // Cancelled: an unpaid invoice raised on the wrong patient file — cancelled, then re-issued.
  const [unpaid]: Array<{ id: string; patient_id: string }> = await ds.query(
    `SELECT i.id, i.patient_id FROM invoices i
      WHERE i.organization_id = $1 AND i.location_id = $2 AND i.status = 'ISSUED'
        AND i.paid_amount = 0 AND i.total_amount > 0
        AND NOT EXISTS (SELECT 1 FROM charges x WHERE x.invoice_id = i.id AND x.source = 'TREATMENT_PLAN')
      ORDER BY i.issue_date DESC, i.invoice_number DESC LIMIT 1`,
    [t.organizationId, t.locationId],
  );
  if (unpaid) {
    const inv = await invoiceSvc.detail(t, unpaid.id);
    const chargeIds = inv.charges!.filter((c) => c.status === ChargeStatus.ACTIVE).map((c) => c.id);
    await invoiceSvc.cancel(finance, inv.id, 'Duplicate invoice — tax line missing, re-issued');
    cancelled++;
    const desk = await billingCtx(ctx, clinic, loc.key, deskUserId(clinic, loc.key));
    await invoiceSvc.create(desk, { patientId: unpaid.patient_id, chargeIds, notes: `Replaces ${inv.invoiceNumber}` });
  }
  return { refunds, cancelled };
}

// ─── Payroll (+ commission settlements) ─────────────────────────────────

/**
 * The last two complete months: generated on the 1st (salary + unsettled
 * commission → settlement), paid on the 3rd–5th. In the latest month the
 * commission doctors' payouts are still pending (being verified).
 */
async function seedPayroll(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationKey: string,
): Promise<{ generated: number; paid: number }> {
  const svc = ctx.app.get(PayrollService);
  const t = tenant(clinic, locationKey);
  const userId = financeUser(clinic, locationKey);
  const thisMonth = `${ctx.today.slice(0, 7)}-01`;
  let generated = 0;
  let paid = 0;

  for (const back of [2, 1]) {
    const first = monthStart(thisMonth, -back); // first day of the payroll month
    const generatedOn = monthStart(thisMonth, -back + 1);
    if (generatedOn > ctx.today) continue;
    const [year, month] = first.split('-').map(Number);

    travelTo(at(generatedOn, '10:00'));
    const res = await svc.generate({ month, year }, t, userId);
    generated += res.generated;

    for (const [i, r] of res.records.entries()) {
      const latest = back === 1;
      if (latest && Number(r.commissionMinor) > 0) continue; // commission pending verification
      const payDay = addDays(generatedOn, 2 + (i % 3));
      if (payDay > ctx.today) continue;
      travelTo(at(payDay, '15:00'));
      const bank = Number(r.totalMinor) >= 5_000_000; // ≥ Rs 50,000 by bank transfer
      await svc.markPaid(
        r.id,
        {
          paymentMethod: bank ? PayrollMethod.BANK_TRANSFER : PayrollMethod.CASH,
          paymentReference: bank ? `SAL-${year}${String(month).padStart(2, '0')}-${ctx.rng.int(1000, 9999)}` : undefined,
          notes: r.commissionMinor && Number(r.commissionMinor) > 0 ? 'Salary + commission' : undefined,
        },
        clinic.orgId,
        userId,
      );
      paid++;
    }
  }
  return { generated, paid };
}

/** First day of the month `offset` months from `ymd01` (YYYY-MM-01). */
function monthStart(ymd01: string, offset: number): string {
  const [y, m] = ymd01.split('-').map(Number);
  const idx = y * 12 + (m - 1) + offset;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
}
