import { LabOrderActionsService, LabSideCall } from 'src/lab-access/actions/lab-order-actions.service';
import { LabInvoicesService } from 'src/lab-billing/services/lab-invoices.service';
import { LabPaymentsService } from 'src/lab-billing/services/lab-payments.service';
import { LabPaymentMethod } from 'src/lab-billing/enums/lab-billing.enums';
import { LabInvoice } from 'src/lab-billing/entities/lab-invoice.entity';
import { ClinicCall, LabCall, labTransitionActor } from 'src/lab-orders/common/order-context';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { MessageKind, OrderPriority } from 'src/lab-orders/enums/order.enums';
import { LabOrdersPortalService } from 'src/lab-orders/portal/lab-orders-portal.service';
import { LabOrdersService } from 'src/lab-orders/services/lab-orders.service';
import { OrderDraftsService } from 'src/lab-orders/services/order-drafts.service';
import { OrderSubmitService } from 'src/lab-orders/services/order-submit.service';
import { QcResult, RemakeReason, ResponsibleParty, ShipmentCondition } from 'src/lab-production/enums/production.enums';
import { ClinicProductionService } from 'src/lab-production/services/clinic-production.service';
import { LabWorkService } from 'src/lab-production/services/lab-work.service';
import { ShipmentsService } from 'src/lab-production/services/shipments.service';
import { VendorBill } from 'src/lab-payables/entities/vendor-bill.entity';
import { VendorBillStatus, VendorPaymentMethod } from 'src/lab-payables/enums/payables.enums';
import { LabStatementsService } from 'src/lab-payables/services/lab-statements.service';
import { VendorBillsService } from 'src/lab-payables/services/vendor-bills.service';
import { VendorPaymentsService } from 'src/lab-payables/services/vendor-payments.service';
import { LabMemberRole } from 'src/labs/enums/lab.enums';
import { realNow, travelTo } from '../lib/time-travel';
import {
  SeedClinic,
  SeedContext,
  SeedPatient,
  addDays,
  log,
  staffByRole,
} from '../lib/context';
import { SeedLab, clinicCall, labCall, seededLabs } from './04-labs-setup';

/**
 * Lab orders over the history, each walked through the real lifecycle with
 * the clock moved to every step's day: doctor drafts + submits (prices
 * frozen) → lab accepts on its portal (stages, vendor bill draft) →
 * technician starts → try-in rounds go out by shipment, the clinic receives
 * them and the doctor records the try-in → final work, QC, dispatch,
 * receive, approve, deliver (warranty). Steps that would fall after "now"
 * are not taken, so recent orders stay in progress. One order gets a try-in
 * correction, one a remake (shade), one a revision, one a clarification,
 * one is cancelled.
 *
 * Money: the patient's lab invoice is issued at submit (advance taken at
 * the chair), the rest collected at delivery for most; vendor bills are
 * approved when the final work arrives and paid in pay runs; the external
 * lab's last-month statement is reconciled.
 */

type Fate = 'normal' | 'correction' | 'remake' | 'cancel' | 'clarify' | 'revise';
type Pay = 'full' | 'advance' | 'delivery' | 'none';

interface Plan {
  /** Placed this many days ago in a 90-day history (scaled to SEED_HISTORY_DAYS). */
  daysAgo: number;
  clinic: string;
  loc: string;
  doctor: string;
  lab: SeedLab['key'];
  service: string;
  teeth?: string[];
  fate: Fate;
  pay: Pay;
  urgent?: boolean;
  discount?: number;
}

const PLANS: Plan[] = [
  { daysAgo: 84, clinic: 'smilecare', loc: 'clifton', doctor: 'owner', lab: 'precision', service: 'PFM_CROWN', teeth: ['16'], fate: 'normal', pay: 'full' },
  { daysAgo: 80, clinic: 'alshifa', loc: 'dha', doctor: 'hassan', lab: 'precision', service: 'IMPLANT_CROWN', teeth: ['46'], fate: 'normal', pay: 'full' },
  { daysAgo: 78, clinic: 'smilecare', loc: 'clifton', doctor: 'owner', lab: 'precision', service: 'ZR_CROWN', teeth: ['11', '21'], fate: 'normal', pay: 'full', discount: 2000 },
  { daysAgo: 71, clinic: 'smilecare', loc: 'gulshan', doctor: 'sana', lab: 'precision', service: 'NIGHT_GUARD', fate: 'normal', pay: 'delivery' },
  { daysAgo: 66, clinic: 'alshifa', loc: 'dha', doctor: 'faisal', lab: 'alshifa_inhouse', service: 'PFM_CROWN', teeth: ['36'], fate: 'normal', pay: 'full' },
  { daysAgo: 64, clinic: 'smilecare', loc: 'clifton', doctor: 'bilal', lab: 'precision', service: 'PFM_BRIDGE', teeth: ['35', '36', '37'], fate: 'correction', pay: 'full' },
  { daysAgo: 57, clinic: 'smilecare', loc: 'clifton', doctor: 'owner', lab: 'precision', service: 'ZR_CROWN', teeth: ['46'], fate: 'remake', pay: 'full' },
  { daysAgo: 52, clinic: 'alshifa', loc: 'dha', doctor: 'faisal', lab: 'alshifa_inhouse', service: 'CD_DENTURE', fate: 'correction', pay: 'full' },
  { daysAgo: 50, clinic: 'smilecare', loc: 'gulshan', doctor: 'bilal', lab: 'precision', service: 'PFM_CROWN', teeth: ['26'], fate: 'cancel', pay: 'none' },
  { daysAgo: 43, clinic: 'smilecare', loc: 'clifton', doctor: 'ayesha', lab: 'precision', service: 'IMPLANT_CROWN', teeth: ['36'], fate: 'clarify', pay: 'advance' },
  { daysAgo: 38, clinic: 'alshifa', loc: 'dha', doctor: 'hassan', lab: 'precision', service: 'ZR_CROWN', teeth: ['11'], fate: 'normal', pay: 'advance' },
  { daysAgo: 33, clinic: 'smilecare', loc: 'clifton', doctor: 'owner', lab: 'precision', service: 'CD_DENTURE', fate: 'normal', pay: 'advance' },
  { daysAgo: 22, clinic: 'smilecare', loc: 'gulshan', doctor: 'sana', lab: 'precision', service: 'PFM_CROWN', teeth: ['14'], fate: 'revise', pay: 'advance' },
  { daysAgo: 12, clinic: 'smilecare', loc: 'clifton', doctor: 'owner', lab: 'precision', service: 'ZR_CROWN', teeth: ['24'], fate: 'normal', pay: 'full', urgent: true },
  { daysAgo: 8, clinic: 'alshifa', loc: 'dha', doctor: 'hassan', lab: 'precision', service: 'IMPLANT_CROWN', teeth: ['24'], fate: 'normal', pay: 'advance' },
  { daysAgo: 6, clinic: 'smilecare', loc: 'clifton', doctor: 'bilal', lab: 'precision', service: 'PFM_CROWN', teeth: ['46', '47'], fate: 'normal', pay: 'advance' },
  { daysAgo: 3, clinic: 'alshifa', loc: 'dha', doctor: 'faisal', lab: 'alshifa_inhouse', service: 'DENTURE_REPAIR', fate: 'normal', pay: 'delivery' },
  { daysAgo: 1, clinic: 'smilecare', loc: 'gulshan', doctor: 'sana', lab: 'precision', service: 'NIGHT_GUARD', fate: 'normal', pay: 'delivery' },
];

const OPEN_ITEM = (s: string) => !['delivered', 'cancelled', 'rejected', 'remake_required'].includes(s);

/** UTC instant for a clinic day at hh:mm PKT (UTC+5). */
const pkt = (ymd: string, hh: number, mm = 0) =>
  new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), hh - 5, mm));

interface ItemRow {
  id: string;
  status_code: string;
  stage_id: string | null;
  stage_status: string | null;
  is_final: boolean | null;
}

interface Run {
  ctx: SeedContext;
  tl: Timeline;
  /** Tie-break between steps at the same instant (plan order). */
  key: number;
  plan: Plan;
  clinic: SeedClinic;
  lab: SeedLab;
  orderId: string;
  orderNo: string;
  patient: SeedPatient;
  appointmentId: string | null;
  doctor: ClinicCall;
  desk: ClinicCall;
  accounts: ClinicCall;
  labAdmin: LabCall;
  tech: LabCall;
  techMemberId: string | null;
  /** Current simulated day + last instant used (steps never go back in time). */
  day: string;
  last: Date;
  invoiceId: string | null;
  corrected: boolean;
  remade: boolean;
}

let vendorInvoiceSeq = 1040;

/**
 * Many cases side by side in simulated time, like a real clinic and lab:
 * every case runs as its own task, but only one step runs at a time and
 * always the earliest one waiting (ties: plan order). So every record —
 * order/shipment/bill numbers, payments, notifications — is written in
 * increasing time order, whatever case it belongs to.
 */
class Timeline {
  private waiting: { t: number; key: number; resolve: (ok: boolean) => void }[] = [];
  private running = 0;
  private failed = false;

  async run(tasks: Array<() => Promise<void>>): Promise<void> {
    this.running = tasks.length;
    await Promise.all(
      tasks.map(async (task) => {
        try {
          await task();
        } catch (err) {
          this.failed = true;
          throw err;
        } finally {
          this.running--;
          this.next();
        }
      }),
    );
  }

  /** Wait until `t` is the earliest pending step; false (no wait) when `t` is still in the future. */
  at(t: Date, key: number): Promise<boolean> {
    if (t.getTime() > realNow().getTime() - 15 * 60_000) return Promise.resolve(false);
    return new Promise((resolve) => {
      this.waiting.push({ t: t.getTime(), key, resolve });
      this.running--;
      this.next();
    });
  }

  private next(): void {
    if (this.failed || this.running > 0 || !this.waiting.length) return;
    this.waiting.sort((a, b) => a.t - b.t || a.key - b.key);
    const w = this.waiting.shift()!;
    this.running++;
    travelTo(new Date(w.t));
    w.resolve(true);
  }
}

export async function seedLabOrders(ctx: SeedContext): Promise<void> {
  const labs = seededLabs(ctx);
  if (!labs.length) {
    log('lab orders: no labs seeded (run with the labs group) — skipped');
    return;
  }
  const used = new Set<string>();
  const tl = new Timeline();
  const tasks: Array<() => Promise<void>> = [];
  let placed = 0;
  for (const [i, plan] of PLANS.entries()) {
    const clinic = ctx.clinics.find((c) => c.key === plan.clinic);
    const lab = labs.find((l) => l.key === plan.lab);
    if (!clinic || !lab || !lab.clinicKeys.includes(clinic.key)) continue;
    tasks.push(async () => {
      const run = await placeOrder(ctx, tl, plan, clinic, lab, i, used);
      if (!run) return;
      placed++;
      await walk(run);
    });
  }
  let k = 1000;
  for (const clinic of ctx.clinics) {
    for (const lab of labs.filter((l) => l.clinicKeys.includes(clinic.key))) {
      const key = k++;
      tasks.push(() => payRuns(ctx, tl, key, clinic, lab));
      // Its own task: each task's steps must come in time order.
      if (lab.key === 'precision') tasks.push(() => statement(ctx, tl, key + 500, clinic, lab));
    }
  }
  await tl.run(tasks);

  const rows: { status_code: string; n: number }[] = await ctx.app.ds.query(
    `SELECT status_code, count(*)::int AS n FROM lab_orders GROUP BY status_code ORDER BY 1`,
  );
  log(`lab orders: ${placed} (${rows.map((r) => `${r.status_code} ${r.n}`).join(', ')})`);
}

// ─── Placing an order ───────────────────────────────────────────────────

async function placeOrder(
  ctx: SeedContext,
  tl: Timeline,
  plan: Plan,
  clinic: SeedClinic,
  lab: SeedLab,
  index: number,
  used: Set<string>,
): Promise<Run | null> {
  const daysAgo = Math.max(1, Math.round((plan.daysAgo * Math.max(ctx.historyDays - 3, 1)) / 87));
  let day = addDays(ctx.today, -daysAgo);
  let loc = plan.loc;
  let doctor = clinic.staff.find((s) => s.key === plan.doctor && s.isDoctor && s.assignments[loc]);
  let patient: SeedPatient | undefined;
  let appointmentId: string | null = null;

  // Prefer a real visit (impression taken that day): same doctor within a week.
  const visits = (ctx.visits ?? []).filter(
    (v) => v.clinicKey === clinic.key && v.appointmentId && !used.has(v.patientId) && v.ymd < ctx.today,
  );
  const near = (v: { ymd: string }) => Math.abs(Date.parse(v.ymd) - Date.parse(day)) / 86_400_000;
  const visit =
    visits.filter((v) => v.doctor.key === plan.doctor && near(v) <= 7).sort((a, b) => near(a) - near(b))[0] ??
    visits.filter((v) => near(v) <= 4).sort((a, b) => near(a) - near(b))[0];
  if (visit) {
    day = visit.ymd;
    loc = visit.locationKey;
    doctor = clinic.staff.find((s) => s.employeeId === visit.doctor.employeeId) ?? visit.doctor;
    patient = clinic.patients.find((p) => p.id === visit.patientId);
    appointmentId = visit.appointmentId;
  }
  if (!doctor?.userId) return null;
  if (!patient) {
    const pool = clinic.patients.filter((p) => p.locationKey === loc && p.registeredOn <= day && !used.has(p.id));
    const any = clinic.patients.filter((p) => p.registeredOn <= day && !used.has(p.id));
    const all = clinic.patients.filter((p) => p.registeredOn <= day);
    patient = pool.length ? ctx.rng.pick(pool) : any.length ? ctx.rng.pick(any) : all.length ? ctx.rng.pick(all) : undefined;
  }
  if (!patient) return null;
  used.add(patient.id);

  const desk = staffByRole(clinic, 'receptionist', loc)[0] ?? doctor;
  const accountant = staffByRole(clinic, 'accountant', loc)[0];
  const tech = lab.technicians.length ? lab.technicians[index % lab.technicians.length] : null;

  const run: Run = {
    ctx,
    tl,
    key: index,
    plan,
    clinic,
    lab,
    orderId: '',
    orderNo: '',
    patient,
    appointmentId,
    // Resolved below, once it is this case's turn on the timeline.
    doctor: null as unknown as ClinicCall,
    desk: null as unknown as ClinicCall,
    accounts: null as unknown as ClinicCall,
    labAdmin: labCall(lab.id, lab.adminUserId, LabMemberRole.LAB_ADMIN),
    tech: tech ? labCall(lab.id, tech.userId, LabMemberRole.LAB_TECHNICIAN) : labCall(lab.id, lab.adminUserId, LabMemberRole.LAB_ADMIN),
    techMemberId: tech?.memberId ?? null,
    day,
    last: new Date(0),
    invoiceId: null,
    corrected: false,
    remade: false,
  };

  // Draft + submit right after the appointment (prices frozen, order number given).
  if (!(await go(run, 0, 20, 0))) return null;
  run.doctor = await clinicCall(ctx, clinic, loc, doctor.userId);
  run.desk = await clinicCall(ctx, clinic, loc, desk.userId ?? doctor.userId);
  run.accounts = await clinicCall(ctx, clinic, loc, accountant?.userId ?? clinic.ownerUserId);
  const service = lab.services[plan.service];
  const id = await ctx.app.get(OrderDraftsService).create(
    run.doctor,
    {
      patientId: patient.id,
      labId: lab.id,
      priority: plan.urgent ? OrderPriority.URGENT : OrderPriority.NORMAL,
      requestedOn: addDays(day, service.turnaroundDays + (plan.urgent ? 0 : 3)),
      appointmentId: appointmentId ?? undefined,
      notes: plan.urgent ? 'Patient travelling abroad — needed before the 15th.' : undefined,
      items: [{ labServiceId: service.id, rush: plan.urgent ?? false, answers: answersFor(service.form, plan) }],
    },
    `seed-lab-draft-${index}`,
  );
  const draft = await ctx.app.ds.getRepository(LabOrder).findOneByOrFail({ id });
  const submitted = await ctx.app.get(OrderSubmitService).submit(run.doctor, id, draft.version, `seed-lab-submit-${index}`);
  run.orderId = id;
  run.orderNo = submitted.orderNo;
  if (ctx.rng.chance(0.4)) {
    await ctx.app.get(LabOrdersService).clinicMessage(run.doctor, id, {
      kind: MessageKind.NOTE,
      body: ctx.rng.pick([
        'Patient is a bruxer — please keep the occlusion light.',
        'Impression disinfected and packed with the bite registration.',
        'Please match the adjacent teeth; photo shared on WhatsApp.',
      ]),
    });
  }

  // The patient's lab invoice, issued at the chair; advance taken now.
  if (plan.pay !== 'none' && plan.fate !== 'cancel') {
    if (!(await soon(run, 10))) return run;
    run.invoiceId = await ctx.app.get(LabInvoicesService).create(run.accounts, {
      orderId: id,
      discountMinor: plan.discount ? plan.discount * 100 : undefined,
      issue: true,
      notes: plan.discount ? 'Courtesy discount (repeat patient)' : undefined,
    });
    if (plan.pay === 'full' || plan.pay === 'advance') {
      const inv = await invoice(run);
      const advance = Math.round(Number(inv.totalMinor) / 2 / 10_000) * 10_000;
      if (advance > 0) await collect(run, advance, 'advance');
    }
  }
  return run;
}

// ─── Walking the lifecycle ──────────────────────────────────────────────

/** Move to `days` after the run's day at hh:mm PKT; false when that is still in the future. */
async function go(run: Run, days: number, hh: number, mm = 0): Promise<boolean> {
  const ymd = addDays(run.day, days);
  let t = pkt(ymd, hh, mm);
  if (t <= run.last) t = new Date(run.last.getTime() + 20 * 60_000);
  if (!(await run.tl.at(t, run.key))) return false;
  run.day = ymd;
  run.last = t;
  return true;
}

/** A few minutes after the last step (same visit). */
async function soon(run: Run, minutes: number): Promise<boolean> {
  const t = new Date(run.last.getTime() + minutes * 60_000);
  if (!(await run.tl.at(t, run.key))) return false;
  run.last = t;
  return true;
}

async function walk(run: Run): Promise<void> {
  const { ctx, plan } = run;
  const svc = run.lab.services[plan.service];

  if (plan.fate === 'cancel') {
    if (!(await go(run, 1, 10, 30))) return;
    const o = await order(run);
    await ctx.app.get(LabOrdersService).transition(run.doctor, run.orderId, {
      action: 'cancel',
      version: o.version,
      reason: 'Patient postponed the treatment — will re-order after Eid.',
    });
    return;
  }

  // Lab side opens the order the next morning.
  let acceptAt: [number, number] = [1, 11];
  if (plan.fate === 'clarify') {
    if (!(await go(run, 1, 11))) return;
    await ctx.app.get(LabOrderActionsService).clarify(await labOrder(run), {
      body: 'Which implant system and platform? The form says Straumann BLT but the scan body looks like Osstem.',
    }, labSide(run.labAdmin));
    if (!(await go(run, 0, 13))) return;
    await ctx.app.get(LabOrdersService).clinicMessage(run.doctor, run.orderId, {
      kind: MessageKind.REPLY,
      body: 'Confirmed: Straumann BLT, regular platform. Scan body was Straumann — sorry for the confusion.',
    });
    acceptAt = [0, 15];
  }

  for (let guard = 0; guard < 40; guard++) {
    const items = (await itemRows(run)).filter((i) => OPEN_ITEM(i.status_code));
    if (!items.length) break;
    const it = items[0];
    const group = items.filter((i) => i.status_code === it.status_code && i.stage_status === it.stage_status);

    switch (it.status_code) {
      case 'pending_acceptance': {
        const [d, h] = run.remade ? [1, 11] : acceptAt;
        if (!(await go(run, d, h))) return;
        await ctx.app.get(LabOrderActionsService).accept(
          await labOrder(run),
          {
            labExpectedOn: addDays(run.day, svc.turnaroundDays + (plan.urgent ? -2 : 0)),
            note: run.remade ? 'Remake at no charge — new shade tab used.' : undefined,
          },
          labSide(run.labAdmin),
        );
        break;
      }
      case 'accepted': {
        if (!(await go(run, 0, 12))) return;
        const work = ctx.app.get(LabWorkService);
        for (const i of group) {
          if (run.techMemberId) await work.assign(run.labAdmin, i.id, run.techMemberId);
          await work.start(run.tech, i.id);
        }
        if (ctx.rng.chance(0.5)) {
          await ctx.app.get(LabOrdersService).labMessage(run.labAdmin, await labOrder(run), {
            kind: MessageKind.NOTE,
            body: ctx.rng.pick([
              'Case received, impressions are good. Work started.',
              'Model poured; die trimmed. Will update at try-in.',
              'Received with bite. Expected on time.',
            ]),
          });
        }
        if (plan.fate === 'revise' && (await go(run, 1, 12))) {
          const o = await order(run);
          const revisionNo = await ctx.app.get(LabOrdersService).revise(run.doctor, run.orderId, {
            version: o.version,
            reason: 'Shade re-taken in daylight',
            notes: 'Please use A3 instead of A2.',
            items: [{ itemId: it.id, answers: answersFor(svc.form, plan, 'A3') }],
          });
          if (await go(run, 0, 15)) {
            await ctx.app.get(LabOrdersService).acknowledgeRevision(run.labAdmin, await labOrder(run), revisionNo);
          }
        }
        break;
      }
      case 'in_production': {
        const tryin = it.stage_id && !it.is_final && it.stage_status === 'at_lab';
        if (tryin) {
          // Try-in work (metal coping / bite block / wax set-up) goes to the clinic.
          if (!(await go(run, ctx.rng.int(2, 3), 17))) return;
          await dispatch(run, group);
        } else if (!it.stage_id || it.stage_status === 'at_lab') {
          // Final work: finish → QC → ready → dispatched.
          if (!(await go(run, ctx.rng.int(2, 3), 15))) return;
          const work = ctx.app.get(LabWorkService);
          for (const i of group) {
            await work.finish(run.tech, i.id);
            await work.qc(run.tech, i.id, { result: QcResult.PASS, notes: 'Fit on die and contacts checked' });
          }
          if (!(await go(run, 0, 17, 30))) return;
          await dispatch(run, group);
        } else {
          log(`lab order ${run.orderNo}: unexpected stage ${it.stage_status} in production — stopped`);
          return;
        }
        break;
      }
      case 'qc': {
        if (!(await go(run, 0, 16))) return;
        for (const i of group) await ctx.app.get(LabWorkService).qc(run.tech, i.id, { result: QcResult.PASS });
        break;
      }
      case 'ready': {
        if (!(await go(run, 0, 17, 30))) return;
        await dispatch(run, group);
        break;
      }
      case 'at_clinic_tryin':
      case 'dispatched': {
        if (it.stage_status === 'sent_to_clinic' || it.status_code === 'dispatched') {
          if (!(await go(run, 1, 10, 30))) return;
          await receiveAll(run);
          if (it.status_code === 'dispatched') await approveBill(run);
          break;
        }
        // Patient back in the chair for the try-in.
        if (!(await go(run, ctx.rng.int(0, 2), ctx.rng.int(12, 18)))) return;
        const prod = ctx.app.get(ClinicProductionService);
        for (const i of group) {
          if (i.stage_status === 'received') {
            await prod.recordTryin(run.doctor, run.orderId, i.stage_id!, { appointmentId: undefined, notes: 'Tried in, patient comfortable' });
          }
          const correct = plan.fate === 'correction' && !run.corrected;
          await prod.decideStage(run.doctor, run.orderId, i.stage_id!, correct
            ? { decision: 'correction', notes: plan.service === 'CD_DENTURE' ? 'Midline shifted 2 mm to the left; raise the lower occlusal plane by 1 mm.' : 'Margin open on the distal of 36 — please re-adapt the coping.' }
            : { decision: 'approve' });
        }
        if (plan.fate === 'correction') run.corrected = true;
        break;
      }
      case 'received': {
        // Final fitting appointment.
        if (!(await go(run, ctx.rng.int(1, 3), ctx.rng.int(12, 18)))) return;
        const prod = ctx.app.get(ClinicProductionService);
        if (plan.fate === 'remake' && !run.remade) {
          const remakeId = await prod.rejectWork(run.doctor, run.orderId, it.id, {
            reasonCode: RemakeReason.SHADE,
            reason: 'Crown too opaque and a shade lighter than the adjacent teeth.',
          });
          const [r] = await ctx.app.ds.query(`SELECT version FROM remake_requests WHERE id = $1`, [remakeId]);
          await prod.decideRemake(run.doctor, run.orderId, remakeId, {
            decision: 'agree',
            version: r.version,
            responsibleParty: ResponsibleParty.LAB,
            note: 'Lab agreed on the phone: shade layering error.',
          });
          run.remade = true;
          break;
        }
        for (const i of group) {
          if (i.stage_id && i.stage_status === 'received') {
            await prod.recordTryin(run.doctor, run.orderId, i.stage_id, { notes: 'Final fit, contacts and occlusion checked' });
            await prod.decideStage(run.doctor, run.orderId, i.stage_id, { decision: 'approve' });
          } else if (!i.stage_id) {
            await prod.approveWork(run.doctor, run.orderId, i.id);
          }
        }
        if (!(await soon(run, 25))) return;
        for (const i of group) await prod.deliver(run.doctor, run.orderId, i.id);
        await settleAtDelivery(run);
        break;
      }
      case 'approved': {
        if (!(await soon(run, 25))) return;
        for (const i of group) await ctx.app.get(ClinicProductionService).deliver(run.doctor, run.orderId, i.id);
        await settleAtDelivery(run);
        break;
      }
      default:
        log(`lab order ${run.orderNo}: no seed step for item status ${it.status_code}`);
        return;
    }
  }
}

// ─── Step helpers ───────────────────────────────────────────────────────

function labSide(c: LabCall): LabSideCall {
  return { actor: labTransitionActor(c), onBehalfOfLabId: null, ref: c.ref, authorUserId: c.lab.userId };
}

function order(run: Run): Promise<LabOrder> {
  return run.ctx.app.ds.getRepository(LabOrder).findOneByOrFail({ id: run.orderId });
}

function labOrder(run: Run): Promise<LabOrder> {
  return run.ctx.app.get(LabOrdersPortalService).order(run.labAdmin.lab, run.orderId);
}

function itemRows(run: Run): Promise<ItemRow[]> {
  return run.ctx.app.ds.query(
    `SELECT i.id, i.status_code, s.id AS stage_id, s.status_code AS stage_status, s.is_final
       FROM lab_order_items i
       LEFT JOIN order_item_stages s ON s.item_id = i.id AND s.is_active
      WHERE i.order_id = $1 ORDER BY i.line_no`,
    [run.orderId],
  );
}

async function dispatch(run: Run, items: ItemRow[]): Promise<void> {
  await run.ctx.app.get(ShipmentsService).dispatchToClinic(run.labAdmin, {
    lines: items.map((i) => ({ itemId: i.id })),
    courierName: run.lab.key === 'precision' ? run.ctx.rng.pick(['Lab rider', 'TCS', 'Lab rider']) : 'Hand delivery',
    trackingNo: run.lab.key === 'precision' ? `TCS${run.ctx.rng.int(10_000_000, 99_999_999)}` : undefined,
  });
}

/** The front desk receives every open parcel of the order (QR scan). */
async function receiveAll(run: Run): Promise<void> {
  const shipments: { id: string }[] = await run.ctx.app.ds.query(
    `SELECT DISTINCT s.id, s.dispatched_at FROM shipments s JOIN shipment_items si ON si.shipment_id = s.id
      WHERE si.order_id = $1 AND s.direction = 'to_clinic' AND s.status = 'dispatched' ORDER BY s.dispatched_at`,
    [run.orderId],
  );
  for (const s of shipments) {
    const lines: { id: string; quantity: number }[] = await run.ctx.app.ds.query(
      `SELECT id, quantity FROM shipment_items WHERE shipment_id = $1`,
      [s.id],
    );
    await run.ctx.app.get(ShipmentsService).receive({ side: 'clinic', c: run.desk }, s.id, {
      viaQr: true,
      lines: lines.map((l) => ({
        shipmentItemId: l.id,
        receivedQty: l.quantity,
        condition: ShipmentCondition.OK,
        qcResult: QcResult.PASS,
      })),
    });
  }
}

/** Final work arrived: accounts approve the lab's bill for the order (lab invoice no. on it). */
async function approveBill(run: Run): Promise<void> {
  const bill = await run.ctx.app.ds.getRepository(VendorBill).findOneBy({
    labOrderId: run.orderId,
    status: VendorBillStatus.DRAFT,
  });
  if (!bill || Number(bill.totalMinor) <= 0) return;
  const prefix = run.lab.key === 'precision' ? 'PDL' : 'IHL';
  await run.ctx.app.get(VendorBillsService).approve(run.accounts, bill.id, {
    version: bill.version,
    vendorInvoiceNo: `${prefix}-${++vendorInvoiceSeq}`,
  });
}

async function invoice(run: Run): Promise<LabInvoice> {
  return run.ctx.app.ds.getRepository(LabInvoice).findOneByOrFail({ id: run.invoiceId! });
}

async function collect(run: Run, amountMinor: number, what: string): Promise<void> {
  await run.ctx.app.get(LabPaymentsService).collect(
    run.accounts,
    {
      patientId: run.patient.id,
      amountMinor,
      method: run.ctx.rng.pick([LabPaymentMethod.CASH, LabPaymentMethod.CASH, LabPaymentMethod.CARD, LabPaymentMethod.BANK_TRANSFER]),
      notes: what === 'advance' ? 'Advance for lab work' : 'Balance at delivery',
      allocations: [{ invoiceId: run.invoiceId!, amountMinor }],
    },
    `seed-lab-pay-${run.orderNo}-${what}`,
  );
}

async function settleAtDelivery(run: Run): Promise<void> {
  if (!run.invoiceId || !(run.plan.pay === 'full' || run.plan.pay === 'delivery')) return;
  const inv = await invoice(run);
  if (Number(inv.balanceMinor) > 0) await collect(run, Number(inv.balanceMinor), 'balance');
}

// ─── Form answers per engine form (dental-forms.seed.ts) ────────────────

function answersFor(form: string | null, plan: Plan, shade = 'A2'): Record<string, unknown> {
  const teeth = (plan.teeth ?? []).map((tooth) => ({ tooth }));
  switch (form) {
    case 'CROWN':
      return {
        teeth,
        material: plan.service.startsWith('ZR') ? 'zirconia_monolithic' : 'pfm',
        shade_system: 'VITA_classical',
        shade,
        margin_type: plan.service.startsWith('ZR') ? 'shoulder' : 'chamfer',
        impression_type: 'physical',
      };
    case 'BRIDGE':
      return {
        teeth: (plan.teeth ?? []).map((tooth, i, all) => ({ tooth, role: i === 0 || i === all.length - 1 ? 'abutment' : 'pontic' })),
        material: 'pfm',
        shade_system: 'VITA_classical',
        shade,
        pontic_design: 'modified_ridge_lap',
        impression_type: 'physical',
      };
    case 'IMPLANT_CROWN':
      return {
        teeth: (plan.teeth ?? []).map((tooth) => ({ tooth, role: 'implant' })),
        implant_system: 'Straumann BLT',
        implant_platform: 'regular',
        implant_diameter_mm: 4.1,
        abutment: 'ti_base',
        retention: 'screw_retained',
        material: 'zirconia_monolithic',
        shade_system: 'VITA_classical',
        shade,
        impression_type: 'physical',
      };
    case 'DENTURE':
      return { arch: 'upper', denture_type: 'complete', tooth_shade: shade, gum_shade: 'standard', notes: 'Edentulous upper arch, well-formed ridge.' };
    case 'REPAIR':
      return { appliance: 'denture', problem: 'Upper denture fractured at the midline after a fall.', add_teeth: false };
    default:
      return {};
  }
}

// ─── Payables: pay runs and the monthly statement ───────────────────────

/** Accounts pay the lab every ~month: bills at least 10 days old, in full. */
async function payRuns(ctx: SeedContext, tl: Timeline, key: number, clinic: SeedClinic, lab: SeedLab): Promise<void> {
  const accountant = staffByRole(clinic, 'accountant')[0];
  const first = addDays(ctx.today, -ctx.historyDays);
  let n = 0;
  for (const back of [60, 30, 4]) {
    const day = addDays(ctx.today, -back);
    if (day < first) continue;
    if (!(await tl.at(pkt(day, 12), key))) continue;
    const c = await clinicCall(ctx, clinic, clinic.locations[0].key, accountant?.userId ?? clinic.ownerUserId);
    const bills: { id: string; balance_minor: string }[] = await ctx.app.ds.query(
      `SELECT id, balance_minor FROM vendor_bills
        WHERE organization_id = $1 AND lab_id = $2 AND status IN ('approved', 'partially_paid')
          AND balance_minor > 0 AND approved_at < $3 AND bill_date <= $4
        ORDER BY bill_date, bill_no`,
      [clinic.orgId, lab.id, new Date(), addDays(day, -10)],
    );
    if (!bills.length) continue;
    const allocations = bills.map((b) => ({ billId: b.id, amountMinor: Number(b.balance_minor) }));
    const amountMinor = allocations.reduce((a, b) => a + b.amountMinor, 0);
    const internal = lab.key !== 'precision';
    await ctx.app.get(VendorPaymentsService).create(
      c,
      {
        labId: lab.id,
        amountMinor,
        method: internal ? VendorPaymentMethod.OTHER : VendorPaymentMethod.BANK_TRANSFER,
        reference: internal ? 'Internal transfer to lab cost centre' : `IBFT-${clinic.key.slice(0, 3).toUpperCase()}-${day.replace(/-/g, '')}`,
        paidOn: day,
        allocations,
      },
      `seed-vpay-${clinic.key}-${lab.key}-${back}`,
    );
    n++;
  }
  if (n) log(`${clinic.name}: ${n} payment(s) to ${lab.name}`);
}

/**
 * The lab's statement for last month, entered by accounts and reconciled
 * against the bills. Al-Shifa's carries a courier charge the clinic never
 * agreed to (missing in system) → it stays "reconciling".
 */
async function statement(ctx: SeedContext, tl: Timeline, key: number, clinic: SeedClinic, lab: SeedLab): Promise<void> {
  const monthStart = `${ctx.today.slice(0, 7)}-01`;
  const periodEnd = addDays(monthStart, -1);
  const periodStart = `${periodEnd.slice(0, 7)}-01`;
  const enterOn = addDays(monthStart, 4) < ctx.today ? addDays(monthStart, 4) : addDays(ctx.today, -1);
  if (enterOn <= periodEnd || !(await tl.at(pkt(enterOn, 16), key))) return;
  const bills: { vendor_invoice_no: string | null; bill_no: string; total_minor: string; bill_date: string }[] =
    await ctx.app.ds.query(
      `SELECT vendor_invoice_no, bill_no, total_minor, bill_date::text AS bill_date FROM vendor_bills
        WHERE organization_id = $1 AND lab_id = $2 AND status <> 'void' AND total_minor > 0
          AND bill_date BETWEEN $3 AND $4 ORDER BY bill_date`,
      [clinic.orgId, lab.id, periodStart, periodEnd],
    );
  if (!bills.length) return;
  const accountant = staffByRole(clinic, 'accountant')[0];
  const c = await clinicCall(ctx, clinic, clinic.locations[0].key, accountant?.userId ?? clinic.ownerUserId);
  const lines = bills.map((b) => ({
    labReference: b.vendor_invoice_no ?? b.bill_no,
    lineDate: b.bill_date,
    description: 'Lab work',
    amountMinor: Number(b.total_minor),
  }));
  if (clinic.key !== 'smilecare') {
    lines.push({ labReference: 'PDL-COURIER', lineDate: periodEnd, description: 'Courier charges (TCS)', amountMinor: 60_000 });
  }
  await ctx.app.get(LabStatementsService).create(c, {
    labId: lab.id,
    periodStart,
    periodEnd,
    statementRef: `PDL-ST-${periodEnd.slice(0, 7)}`,
    notes: 'Monthly statement received by email',
    lines,
  });
}
