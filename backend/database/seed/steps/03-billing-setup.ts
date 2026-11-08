import { randomUUID } from 'crypto';
import { AccessResolver } from 'src/access/access.resolver';
import { billingContext, BillingContext } from 'src/billing/common/billing-context';
import { BillingException } from 'src/billing/common/billing-errors';
import { CatalogServicesService } from 'src/billing/catalog/catalog.service';
import { ChargesService } from 'src/billing/charges/charges.service';
import { CashCloseService } from 'src/billing/cash-close/cash-close.service';
import { CreditPackagesService } from 'src/billing/credit-packages.service';
import { DiscountTypesService } from 'src/billing/discounts/discount-types.service';
import { InvoicesService } from 'src/billing/invoices/invoices.service';
import { PaymentAccountsService } from 'src/billing/payment-accounts/payment-accounts.service';
import { PaymentsService } from 'src/billing/payments/payments.service';
import { BillingSettingsService } from 'src/billing/settings/billing-settings.service';
import { ChargeResponse } from 'src/billing/mappers/billing-response.types';
import {
  AllocationMode,
  ChargeSource,
  DiscountAppliesTo,
  DiscountKind,
  PaymentMethod,
  PrintFormat,
  ServiceKind,
} from 'src/billing/enums/billing.enums';
import { zonedTimeToUtc } from 'src/common/clock/tz.util';
import { travelTo } from '../lib/time-travel';
import {
  SeedClinic,
  SeedContext,
  SeedStaff,
  SeedVisit,
  addDays,
  deskUserId,
  log,
  staffByRole,
  tenant,
} from '../lib/context';
import { servicesFor } from '../data/services';

/**
 * Billing setup, all through the billing services (audit rows included):
 * service catalog, location settings (CONS = default consultation, so every
 * completed visit gets a consultation charge), price overrides, discount
 * types, payment accounts and credit packages. Then registers the
 * end-of-day hook: the front desk invoices the day's charges, collects the
 * money (mostly cash, some card / bank / wallet, a few partial or unpaid)
 * and the accountant closes the counter.
 */
export async function seedBillingSetup(ctx: SeedContext): Promise<void> {
  // Configured a few days before the history starts (clinics "opened" a week before).
  travelTo(zonedTimeToUtc('Asia/Karachi', addDays(ctx.today, -ctx.historyDays - 5), '10:00'));
  for (const clinic of ctx.clinics) {
    await setupClinic(ctx, clinic);
    log(`${clinic.name}: ${Object.keys(clinic.services).length} services, billing configured`);
  }
}

/**
 * Registers the front desk's end-of-day hook. Called by run.ts in the parent
 * and in every per-clinic visits child process; the hook keeps no state from
 * seedBillingSetup (payment accounts are re-read from the DB).
 */
export function registerBillingHooks(ctx: SeedContext): void {
  ctx.hooks.endOfDay.push(async (clinic, locationKey, ymd, visits) => {
    try {
      await endOfDay(ctx, clinic, locationKey, ymd, visits);
    } catch (err) {
      // Name the day: a failure in a visits child process is otherwise hard to place.
      log(`billing end-of-day failed: ${clinic.key}/${locationKey} ${ymd}: ${(err as Error)?.message}`);
      throw err;
    }
  });
}

// ─── Shared helpers (also used by 08-billing-extras) ───────────────────

/** BillingContext of a real login, with that user's real permissions at the location. */
export async function billingCtx(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationKey: string,
  userId: string,
): Promise<BillingContext> {
  const t = tenant(clinic, locationKey);
  const access = await ctx.app.get(AccessResolver).resolve(userId, t.organizationId, t.locationId);
  return billingContext(t, access);
}

/** Who counts the drawer / issues refunds: accountant, else admin, else owner. */
export function financeUser(clinic: SeedClinic, locationKey: string): string {
  const s =
    staffByRole(clinic, 'accountant', locationKey)[0] ??
    staffByRole(clinic, 'admin', locationKey)[0];
  return s?.userId ?? clinic.ownerUserId;
}

/** The finance user's employee row (expenses / credits record an employee). */
export function financeEmployee(clinic: SeedClinic, locationKey: string): SeedStaff | null {
  return (
    staffByRole(clinic, 'accountant', locationKey)[0] ??
    staffByRole(clinic, 'admin', locationKey)[0] ??
    null
  );
}

export interface LocationAccounts {
  cash: string;
  card: string;
  bank: string;
  wallet: string;
}

/** Per-process cache, filled from the DB (safe in the visits child processes). */
const accountCache = new Map<string, LocationAccounts>();

/** The location's payment accounts by kind (read from the DB once per process). */
export async function accountsFor(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationKey: string,
): Promise<LocationAccounts> {
  const t = tenant(clinic, locationKey);
  const hit = accountCache.get(t.locationId);
  if (hit) return hit;
  const list = await ctx.app.get(PaymentAccountsService).list(t, true);
  const by = (m: PaymentMethod) => list.find((a) => a.method === m)?.id;
  const cash = by(PaymentMethod.CASH)!;
  const accounts = {
    cash,
    card: by(PaymentMethod.CARD) ?? cash,
    bank: by(PaymentMethod.BANK_TRANSFER) ?? cash,
    wallet: by(PaymentMethod.ONLINE_WALLET) ?? cash,
  };
  accountCache.set(t.locationId, accounts);
  return accounts;
}

export function referenceFor(ctx: SeedContext, kind: keyof LocationAccounts): string | undefined {
  const n = () => String(ctx.rng.int(100000, 999999));
  switch (kind) {
    case 'card':
      return `POS-${n()}`;
    case 'bank':
      return `IBFT-${n()}${n()}`;
    case 'wallet':
      return `TXN${n()}${n()}`;
    default:
      return undefined;
  }
}

// ─── Setup per clinic ───────────────────────────────────────────────────

/** Bank + wallet per clinic (Karachi / Lahore / Islamabad). */
const BANKING: Record<string, { bank: string; title: string; wallet: string }> = {
  smilecare: { bank: 'Meezan Bank', title: 'Smile Care Dental Clinic', wallet: 'JazzCash' },
  alshifa: { bank: 'HBL', title: 'Al-Shifa Dental & Implant Centre', wallet: 'Easypaisa' },
  familycare: { bank: 'Bank Alfalah', title: 'Shifa Family Clinic', wallet: 'JazzCash' },
};

/** Location price overrides (code → rupees). */
const LOCATION_PRICES: Record<string, Record<string, number>> = {
  // Gulshan branch is the cheaper neighbourhood clinic.
  gulshan: { CONS: 1200, SCALE: 3500, 'FILL-COMP': 4500, 'XRAY-IOPA': 600 },
  // Lahore DHA is the premium implant centre.
  dha: { CONS: 2000, IMPLANT: 140000, 'CROWN-ZR': 40000, WHITEN: 30000 },
  f8: { ECG: 1200 },
};

/** Doctor-specific prices: clinic → location → staff key → code → rupees. */
const DOCTOR_PRICES: Record<string, Record<string, Record<string, Record<string, number>>>> = {
  smilecare: {
    clifton: {
      usman: { 'EXT-SURG': 20000, 'EXT-SIMPLE': 4000 }, // visiting oral surgeon
      owner: { CONS: 2500, 'CROWN-ZR': 38000 }, // senior prosthodontist
      ayesha: { 'ORTHO-BRACES': 90000 },
    },
  },
  alshifa: { dha: { hassan: { CONS: 3000, IMPLANT: 150000 } } },
  familycare: { f8: { fatima: { CONS: 3000 }, omer: { CONS: 2500 } } },
};

async function setupClinic(ctx: SeedContext, clinic: SeedClinic): Promise<void> {
  const firstLoc = clinic.locations[0].key;
  const owner = await billingCtx(ctx, clinic, firstLoc, clinic.ownerUserId);

  // 1. Service catalog (org-wide).
  const catalog = ctx.app.get(CatalogServicesService);
  for (const [i, s] of servicesFor(clinic.kind).entries()) {
    const created = await catalog.create(owner, {
      name: s.name,
      code: s.code,
      kind: s.kind as ServiceKind,
      defaultPrice: s.price,
      sortOrder: i,
    });
    clinic.services[s.code] = created.id;
  }

  // 2. Discount types (org-wide).
  const discounts = ctx.app.get(DiscountTypesService);
  const promoFrom = addDays(ctx.today, -ctx.historyDays);
  for (const d of [
    { name: 'Staff family', code: 'STAFF', kind: DiscountKind.PERCENTAGE, value: 20, requiresNote: true },
    { name: 'Senior citizen', code: 'SENIOR', kind: DiscountKind.PERCENTAGE, value: 10, maxAmount: 5000 },
    {
      name: 'Loyal patient',
      code: 'LOYAL',
      kind: DiscountKind.PERCENTAGE,
      value: 10,
      receptionEditable: true,
      minValue: 5,
      maxValue: 15,
    },
    {
      name: 'Welcome promo Rs 500',
      code: 'WELCOME500',
      kind: DiscountKind.FIXED,
      value: 500,
      appliesTo: DiscountAppliesTo.SERVICE_KINDS,
      serviceKinds: [ServiceKind.PROCEDURE],
      validFrom: promoFrom,
      validTo: addDays(ctx.today, 60),
    },
  ]) {
    await discounts.create(owner, d);
  }

  // 3. Credit packages (org-wide; the service takes the org id only).
  const packages = ctx.app.get(CreditPackagesService);
  const pkgDefs =
    clinic.kind === 'dental'
      ? [
          { name: 'Smile Care Plan — 2 cleanings / year', description: 'Two scaling & polishing visits plus check-ups', totalCredits: 8000, price: 7000, validityDays: 365 },
          { name: 'Family Dental Card', description: 'Rs 20,000 of treatment credit for the whole family', totalCredits: 20000, price: 18000, validityDays: 365 },
        ]
      : [
          { name: 'Diabetes Care — quarterly', description: 'Consultations + sugar tests for 3 months', totalCredits: 9000, price: 8000, validityDays: 90 },
          { name: 'Child Wellness Card', description: 'Paediatric visits and vaccinations', totalCredits: 15000, price: 13500, validityDays: 365 },
        ];
  for (const p of pkgDefs) await packages.create(clinic.orgId, p);

  // 4. Per location: settings, accounts, price overrides.
  const banking = BANKING[clinic.key];
  for (const loc of clinic.locations) {
    const locOwner = await billingCtx(ctx, clinic, loc.key, clinic.ownerUserId);

    await ctx.app.get(BillingSettingsService).update(locOwner, {
      defaultConsultationServiceId: clinic.services.CONS,
      dueDays: 7,
      invoicePrintFormat: PrintFormat.A4,
      receiptPrintFormat: PrintFormat.THERMAL_80,
      showPreviousBalance: true,
      showOutstandingAtCheckIn: true,
      footerNote: 'Thank you for visiting. Please keep this receipt for follow-up.',
      cashVarianceAlertAmount: 500,
    });

    // "Cash" already exists (created with the settings, the default account).
    const accounts = ctx.app.get(PaymentAccountsService);
    await accounts.create(locOwner, { name: 'Card (POS)', method: PaymentMethod.CARD, sortOrder: 1 });
    await accounts.create(locOwner, {
      name: banking.bank,
      method: PaymentMethod.BANK_TRANSFER,
      bankName: banking.bank,
      accountTitle: banking.title,
      accountNumber: `0${ctx.rng.int(100, 999)}-${ctx.rng.int(1000000, 9999999)}-${ctx.rng.int(10, 99)}`,
      sortOrder: 2,
    });
    await accounts.create(locOwner, {
      name: banking.wallet,
      method: PaymentMethod.ONLINE_WALLET,
      accountTitle: banking.title,
      accountNumber: `03${ctx.rng.int(100000000, 999999999)}`,
      sortOrder: 3,
    });

    for (const [code, price] of Object.entries(LOCATION_PRICES[loc.key] ?? {})) {
      await catalog.createPrice(locOwner, { serviceId: clinic.services[code], price });
    }
    for (const [staffKey, prices] of Object.entries(DOCTOR_PRICES[clinic.key]?.[loc.key] ?? {})) {
      const doc = clinic.staff.find((s) => s.key === staffKey);
      if (!doc) continue;
      for (const [code, price] of Object.entries(prices)) {
        await catalog.createPrice(locOwner, { serviceId: clinic.services[code], doctorId: doc.employeeId, price });
      }
    }
  }
}

// ─── End of day at the front desk ───────────────────────────────────────

const MIN = 60_000;

async function endOfDay(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationKey: string,
  ymd: string,
  visits: SeedVisit[],
): Promise<void> {
  const t = tenant(clinic, locationKey);
  const desk = await billingCtx(ctx, clinic, locationKey, deskUserId(clinic, locationKey));
  const accounts = await accountsFor(ctx, clinic, locationKey);

  // Today's visitors first (visit order), then anyone else with charges dated today.
  const patientIds: string[] = [];
  for (const v of visits) if (!patientIds.includes(v.patientId)) patientIds.push(v.patientId);
  const ready = await ctx.app.get(ChargesService).readyToBill(t, ymd);
  for (const r of [...ready].sort((a, b) => a.patientName.localeCompare(b.patientName))) {
    if (!patientIds.includes(r.patientId)) patientIds.push(r.patientId);
  }
  if (!patientIds.length) return;

  // Today the clinic is still open: collect at "now" and leave the counter open.
  if (ymd >= ctx.today) {
    for (const patientId of patientIds) await settlePatient(ctx, desk, accounts, patientId, ymd);
    return;
  }

  // Past days: patients pay one after another (a couple of minutes apart),
  // then the counter is closed.
  const start = Date.now();
  for (const [i, patientId] of patientIds.entries()) {
    travelTo(new Date(start + i * 2 * MIN));
    await settlePatient(ctx, desk, accounts, patientId, ymd);
  }
  travelTo(new Date(start + (patientIds.length * 2 + 15) * MIN));
  await closeCounter(ctx, clinic, locationKey);
}

/** What the desk does for one patient: price, maybe discount, invoice, collect. */
async function settlePatient(
  ctx: SeedContext,
  desk: BillingContext,
  accounts: LocationAccounts,
  patientId: string,
  ymd: string,
): Promise<void> {
  const { rng } = ctx;
  const charges = ctx.app.get(ChargesService);
  const payments = ctx.app.get(PaymentsService);

  // 1. Anything still waiting for a price (a treatment without a catalog service).
  let open = await charges.list(desk.tenant, patientId, 'open');
  const unpriced = open.filter((c) => c.needsPricing && !c.invoiceId);
  for (const c of unpriced) {
    await charges.update(desk, c.id, { unitPrice: rng.pick([1000, 1500, 2000, 2500, 3000]) });
  }

  // 2. Occasionally a preset discount on today's charges (~7%).
  const todays = open.filter((c) => !c.invoiceId && c.chargeDate === ymd);
  if (todays.length && rng.chance(0.07)) await giveDiscount(ctx, desk, todays);
  if (unpriced.length || todays.length) open = await charges.list(desk.tenant, patientId, 'open');

  const visitCharges = open.filter((c) => c.source !== ChargeSource.TREATMENT_PLAN);
  const planCharges = open.filter((c) => c.source === ChargeSource.TREATMENT_PLAN);

  // 3. Today's visit (plus any old dues).
  if (visitCharges.length) {
    const roll = rng.next();
    const unbilled = visitCharges.filter((c) => !c.invoiceId);
    if (roll < 0.05) {
      // Leaves without paying: invoice issued, balance stays on account.
      if (unbilled.length) {
        await ctx.app.get(InvoicesService).create(desk, {
          patientId,
          chargeIds: unbilled.map((c) => c.id),
          notes: rng.pick(['Will pay on next visit', 'Payment pending — patient to transfer', 'Credit allowed by manager']),
        });
      }
    } else {
      const due = await amountDue(payments, desk, patientId, visitCharges);
      if (due <= 0) {
        // The advance covers it: apply, no new receipt.
        await payments.applyAdvance(desk, patientId, {
          mode: AllocationMode.AUTO,
          selections: visitCharges.map((c) => ({ chargeId: c.id })),
        });
      } else {
        let amount = due;
        let notes: string | undefined;
        if (roll < 0.15) {
          amount = Math.floor((due * (0.3 + rng.next() * 0.4)) / 100) * 100;
          if (amount <= 0 || amount >= due) amount = due;
          else notes = 'Part payment, balance on next visit';
        } else if (roll > 0.975) {
          amount = Math.ceil((due + 1) / 5000) * 5000;
          notes = 'Rounded up — rest kept as advance';
        }
        await collect(ctx, desk, accounts, patientId, amount, visitCharges, notes);
      }
    }
  }

  // 4. Treatment plan: a deposit the day it starts, instalments later.
  if (planCharges.length) {
    const due = await amountDue(payments, desk, patientId, planCharges);
    const startedToday = planCharges.some((c) => c.chargeDate === ymd);
    let amount = 0;
    if (startedToday) amount = Math.max(5000, Math.round((due * (0.25 + rng.next() * 0.25)) / 1000) * 1000);
    else if (rng.chance(0.55)) amount = due <= 10000 ? due : Math.round((due * (0.3 + rng.next() * 0.3)) / 1000) * 1000;
    amount = Math.min(amount, due);
    if (amount > 0) {
      await collect(ctx, desk, accounts, patientId, amount, planCharges, 'Treatment plan instalment', true);
    }
  }

  // 5. Now and then an advance deposit for upcoming work (~2%).
  if (rng.chance(0.02)) {
    await collect(ctx, desk, accounts, patientId, rng.pick([5000, 10000, 15000, 20000]), [], 'Advance for upcoming treatment', true);
  }
}

async function amountDue(
  payments: PaymentsService,
  desk: BillingContext,
  patientId: string,
  charges: ChargeResponse[],
): Promise<number> {
  const preview = await payments.preview(desk, {
    patientId,
    amount: 0,
    applyAdvance: true,
    mode: AllocationMode.AUTO,
    selections: charges.map((c) => ({ chargeId: c.id })),
  });
  return preview.amountToClearSelected;
}

/** Mostly cash; bigger amounts more often by card / bank transfer. */
async function collect(
  ctx: SeedContext,
  desk: BillingContext,
  accounts: LocationAccounts,
  patientId: string,
  amount: number,
  charges: ChargeResponse[],
  notes?: string,
  bigTicket = false,
): Promise<void> {
  const r = ctx.rng.next();
  const kind: keyof LocationAccounts =
    bigTicket || amount >= 30000
      ? r < 0.35 ? 'cash' : r < 0.6 ? 'card' : r < 0.9 ? 'bank' : 'wallet'
      : r < 0.7 ? 'cash' : r < 0.8 ? 'card' : r < 0.9 ? 'bank' : 'wallet';
  await ctx.app.get(PaymentsService).collect(desk, {
    patientId,
    amount: Math.round(amount * 100) / 100,
    paymentAccountId: accounts[kind],
    referenceNumber: referenceFor(ctx, kind),
    applyAdvance: true,
    mode: AllocationMode.AUTO,
    selections: charges.map((c) => ({ chargeId: c.id })),
    notes,
    clientRequestId: randomUUID(),
  });
}

/** A preset discount on today's charges; types that don't fit are skipped by the service. */
async function giveDiscount(
  ctx: SeedContext,
  desk: BillingContext,
  charges: ChargeResponse[],
): Promise<void> {
  const types = await ctx.app.get(DiscountTypesService).list(desk.tenant, true);
  if (!types.length) return;
  const type = ctx.rng.pick(types);
  try {
    await ctx.app.get(ChargesService).bulkDiscount(desk, {
      chargeIds: charges.map((c) => c.id),
      discountTypeId: type.id,
      note: type.requiresNote
        ? ctx.rng.pick(['Brother of our assistant', 'Wife of staff member', 'Mother of front desk officer'])
        : undefined,
    });
  } catch (err) {
    // e.g. none of the charges fit the type (all skipped) — the desk just moves on.
    if (!(err instanceof BillingException)) throw err;
  }
}

/** The accountant counts the drawer: usually exact, sometimes a little short / over. */
async function closeCounter(ctx: SeedContext, clinic: SeedClinic, locationKey: string): Promise<void> {
  const svc = ctx.app.get(CashCloseService);
  const t = tenant(clinic, locationKey);
  const preview = await svc.preview(t);
  if (!preview.lines.some((l) => l.paymentCount > 0 || l.refundCount > 0)) return;

  const { rng } = ctx;
  let note: string | undefined;
  const lines = preview.lines
    .filter((l) => l.countedInCashClose)
    .map((l) => {
      let counted = l.expected;
      const r = rng.next();
      if (l.expected > 0 && r < 0.08) {
        const short = rng.pick([50, 100, 200, 500]);
        counted = Math.max(0, l.expected - short);
        note = `Short by Rs ${short} — change given from the drawer`;
      } else if (l.expected > 0 && r < 0.11) {
        const over = rng.pick([100, 500]);
        counted = l.expected + over;
        note = `Over by Rs ${over} — patient left without change`;
      }
      return { paymentAccountId: l.paymentAccountId, counted };
    });
  const closer = await billingCtx(ctx, clinic, locationKey, financeUser(clinic, locationKey));
  await svc.create(closer, { periodEnd: preview.periodEnd, lines, note });
}
