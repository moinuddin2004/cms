import { AppointmentsService } from 'src/appointments/appointments.service';
import { QueueOrchestrator } from 'src/queue/services/queue-orchestrator.service';
import { queueActorFrom, QueueActor } from 'src/queue/queue-actor';
import { EncountersService } from 'src/encounters/encounters.service';
import { TreatmentsService } from 'src/treatments/treatments.service';
import { TreatmentPlansService } from 'src/treatment-plans/treatment-plans.service';
import { PrescriptionService } from 'src/prescriptions/services/prescription.service';
import { PatientsService } from 'src/patients/patients.service';
import { AccessResolver } from 'src/access/access.resolver';
import type { AccessContext } from 'src/access/access-context';
import { zonedTimeToUtc } from 'src/common/clock/tz.util';
import { NotificationDispatcher } from 'src/notifications/delivery/notification-dispatcher.service';
import { realNow, travelHome, travelTo } from '../lib/time-travel';
import {
  SeedClinic,
  SeedContext,
  SeedPatient,
  SeedStaff,
  SeedVisit,
  addDays,
  clinicActor,
  dayOfWeek,
  deskUserId,
  doctors,
  log,
  staffByRole,
  tenant,
} from '../lib/context';
import { servicesFor } from '../data/services';
import { DENTAL_SCENARIOS, GENERAL_SCENARIOS, Med, Scenario } from '../data/clinical';

/**
 * Day-by-day clinic life over the history, through the app's own services:
 * booking (days ahead or same day) → confirm / cancel / no-show → check-in
 * (token) → doctor calls → consultation (notes, treatments, chart, vitals,
 * plan, prescription) → complete (creates the visit's charges) → end of day
 * (doctors close their queue, end-of-day hooks such as billing, notifications).
 *
 * Every action is an EVENT at a clinic time; a clinic's events run strictly
 * in time order (like the real clinic), so "latest" lookups and numbering in
 * the app see the same order as in real life. Today stops at the real "now"
 * (patients waiting / in consultation / booked later); the next two weeks
 * get bookings.
 */

const SLOT_MIN = 30;
const FUTURE_DAYS = 14;
/** Bookings are made up to this many days ahead. */
const LOOKAHEAD = 3;

interface OpenPlan {
  planId: string;
  patientId: string;
  doctorKey: string;
  locationKey: string;
  name: string;
  items: Array<{ id: string; left: number; label: string }>;
  /** Next session due on/after this day; '9999' while one is booked. */
  nextOn: string;
}

interface PlannedVisit {
  patient: SeedPatient;
  doctor: SeedStaff;
  hhmm: string;
  scenario: Scenario | null;
  plan: OpenPlan | null;
  walkIn: boolean;
  outcome: 'visit' | 'no_show' | 'cancel';
}

/** Mutable state of one visit while its events run. */
interface VisitState {
  clinic: SeedClinic;
  locKey: string;
  ymd: string;
  v: PlannedVisit;
  dead: boolean;
  appointmentId: string | null;
  entryId?: string;
  encounterId?: string;
}

interface SimEvent {
  at: number;
  seq: number;
  visit?: VisitState;
  run: () => Promise<void>;
}

class VisitSim {
  private readonly appts: AppointmentsService;
  private readonly queue: QueueOrchestrator;
  private readonly encounters: EncountersService;
  private readonly treatments: TreatmentsService;
  private readonly plans: TreatmentPlansService;
  private readonly rx: PrescriptionService;
  private readonly patients: PatientsService;
  private readonly resolver: AccessResolver;
  private readonly accessCache = new Map<string, AccessContext>();
  private readonly openPlans = new Map<string, OpenPlan>(); // by patient id
  /** Patients with a visit planned but not yet done. */
  private readonly reserved = new Set<string>();
  private readonly charted = new Set<string>();
  /** Queue sessions started (doctor-day). */
  private readonly sessions = new Map<string, { locKey: string; ymd: string; doctor: SeedStaff; closed?: boolean }>();
  private events: SimEvent[] = [];
  private seq = 0;
  /** Completed visits per `${locKey}|${ymd}`. */
  readonly done = new Map<string, SeedVisit[]>();
  private counts = { visits: 0, noShow: 0, cancelled: 0, walkIns: 0, plans: 0, rx: 0 };

  constructor(
    private readonly ctx: SeedContext,
    private readonly clinic: SeedClinic,
  ) {
    this.appts = ctx.app.get(AppointmentsService);
    this.queue = ctx.app.get(QueueOrchestrator);
    this.encounters = ctx.app.get(EncountersService);
    this.treatments = ctx.app.get(TreatmentsService);
    this.plans = ctx.app.get(TreatmentPlansService);
    this.rx = ctx.app.get(PrescriptionService);
    this.patients = ctx.app.get(PatientsService);
    this.resolver = ctx.app.get(AccessResolver);
  }

  // ── Event queue ─────────────────────────────────────────────────────

  private on(at: Date, run: () => Promise<void>, visit?: VisitState): void {
    this.events.push({ at: at.getTime(), seq: this.seq++, visit, run });
  }

  /** Runs every event before `limit`, in time order. */
  async runUntil(limit: Date): Promise<void> {
    for (;;) {
      this.events.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = this.events[0];
      if (!next || next.at >= limit.getTime()) return;
      this.events.shift();
      if (next.visit?.dead) continue;
      travelTo(new Date(next.at));
      await next.run();
      // The app finishes some work after a request returns (notifications
      // after commit, in their own transaction). Let it land before the next
      // event, or it deadlocks with it and runs at the wrong simulated time.
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  /** Forget events that never happened (after the real "now"). */
  dropPending(): void {
    this.events = [];
  }

  at(locKey: string, ymd: string, hhmm: string, plusMin = 0): Date {
    const tz = this.clinic.locations.find((l) => l.key === locKey)!.timezone;
    return new Date(zonedTimeToUtc(tz, ymd, hhmm).getTime() + plusMin * 60_000);
  }

  // ── Who acts ────────────────────────────────────────────────────────

  private async access(userId: string, locKey: string): Promise<AccessContext> {
    const t = tenant(this.clinic, locKey);
    const key = `${userId}|${t.locationId}`;
    let a = this.accessCache.get(key);
    if (!a) {
      a = await this.resolver.resolve(userId, t.organizationId, t.locationId);
      this.accessCache.set(key, a);
    }
    return a;
  }

  private async actor(userId: string, locKey: string): Promise<QueueActor> {
    return queueActorFrom(await this.access(userId, locKey));
  }

  // ── Planning a day ──────────────────────────────────────────────────

  plan(locKey: string, ymd: string, busy: number): PlannedVisit[] {
    const { rng } = this.ctx;
    const clinic = this.clinic;
    const dow = dayOfWeek(ymd);
    const docs = doctors(clinic, locKey).filter((d) => d.schedule[locKey]?.days.includes(dow));
    if (!docs.length) return [];

    const free = new Map<string, string[]>();
    for (const d of docs) {
      const s = d.schedule[locKey];
      free.set(d.key, rng.shuffle(slots(s.start, s.end)));
    }
    const take = (d: SeedStaff, after?: string) => {
      const list = free.get(d.key)!;
      const i = after ? list.findIndex((h) => h >= after) : list.length - 1;
      return i < 0 ? undefined : list.splice(i, 1)[0];
    };

    const out: PlannedVisit[] = [];
    const pool = clinic.patients.filter(
      (p) => p.locationKey === locKey && p.registeredOn <= ymd && !this.reserved.has(p.id),
    );

    // 1. Plan sessions that are due, with the plan's doctor.
    for (const op of this.openPlans.values()) {
      if (op.locationKey !== locKey || op.nextOn > ymd) continue;
      const d = docs.find((x) => x.key === op.doctorKey);
      const p = pool.find((x) => x.id === op.patientId);
      const hhmm = d && p && take(d);
      if (!d || !p || !hhmm) continue;
      op.nextOn = '9999';
      out.push({ patient: p, doctor: d, hhmm, scenario: null, plan: op, walkIn: false, outcome: 'visit' });
    }
    // 2. Patients registering today: first visit after they register.
    for (const p of pool.filter((x) => x.registeredOn === ymd)) {
      if (out.some((x) => x.patient.id === p.id)) continue;
      const d = rng.pick(docs);
      const sc = this.pickScenario(p, d);
      const after = localHHMM(new Date(new Date(p.registeredAt).getTime() + 20 * 60_000));
      const hhmm = take(d, after);
      if (!sc || !hhmm) continue;
      out.push({ patient: p, doctor: d, hhmm, scenario: sc, plan: null, walkIn: rng.chance(0.5), outcome: 'visit' });
    }
    // 3. Returning patients.
    for (const p of rng.shuffle(pool)) {
      if (out.length >= busy) break;
      if (p.registeredOn === ymd || this.openPlans.has(p.id) || out.some((x) => x.patient.id === p.id)) continue;
      const d = rng.pick(docs);
      const sc = this.pickScenario(p, d);
      const hhmm = take(d);
      if (!sc || !hhmm) continue;
      const r = rng.next();
      out.push({
        patient: p, doctor: d, hhmm, scenario: sc, plan: null,
        walkIn: r < 0.15,
        outcome: r > 0.9 ? 'no_show' : r > 0.84 ? 'cancel' : 'visit',
      });
    }
    for (const pv of out) this.reserved.add(pv.patient.id);
    return out;
  }

  private pickScenario(p: SeedPatient, d: SeedStaff): Scenario | null {
    const list = this.clinic.kind === 'dental' ? DENTAL_SCENARIOS : GENERAL_SCENARIOS;
    const ok = list.filter((s) => {
      if (s.specialties && !s.specialties.includes(d.specialty ?? '')) return false;
      if (s.who === 'child' && !p.isMinor) return false;
      if (s.who === 'adult' && p.isMinor) return false;
      if (s.who === 'female-adult' && (p.isMinor || p.gender !== 'female')) return false;
      return true;
    });
    if (!ok.length) return null;
    const total = ok.reduce((n, s) => n + (s.weight ?? 1), 0);
    let r = this.ctx.rng.next() * total;
    for (const s of ok) {
      r -= s.weight ?? 1;
      if (r <= 0) return s;
    }
    return ok[ok.length - 1];
  }

  // ── Turning a planned visit into events ─────────────────────────────

  /** `earliest`: nothing may happen before this (start of the history). */
  schedule(locKey: string, ymd: string, v: PlannedVisit, earliest: Date): void {
    const { rng } = this.ctx;
    const clinic = this.clinic;
    const t = tenant(clinic, locKey);
    const desk = deskUserId(clinic, locKey);
    const docUser = v.doctor.userId!;
    const slot = this.at(locKey, ymd, v.hhmm);
    const reason = v.plan ? `${v.plan.name} — next session` : v.scenario!.complaint;
    const st: VisitState = { clinic, locKey, ymd, v, dead: false, appointmentId: null };
    const kill = () => {
      st.dead = true;
      this.reserved.delete(v.patient.id);
      if (v.plan) v.plan.nextOn = addDays(ymd, 7);
    };
    const firstVisit = v.patient.registeredOn === ymd;
    const registered = new Date(v.patient.registeredAt);

    // 1. Booking — days ahead, or the same day.
    if (!v.walkIn) {
      const lead = firstVisit ? 0 : rng.pick([0, 1, 1, 2, 3]);
      let bookedAt =
        lead === 0
          ? new Date(slot.getTime() - rng.int(45, 150) * 60_000)
          : this.at(locKey, addDays(ymd, -lead), `1${rng.int(0, 7)}:${rng.pick(['05', '20', '40'])}`);
      if (bookedAt < earliest) bookedAt = new Date(slot.getTime() - 60 * 60_000);
      if (firstVisit && bookedAt <= registered) bookedAt = new Date(registered.getTime() + 5 * 60_000);
      this.on(bookedAt, async () => {
        const appt = await this.appts.create(
          t,
          {
            patientId: v.patient.id,
            doctorId: v.doctor.employeeId,
            startTime: slot.toISOString(),
            duration: SLOT_MIN,
            type: (v.plan ? 'treatment' : v.scenario!.type ?? 'consultation') as any,
            reasonForVisit: reason,
            isEmergency: v.scenario?.type === 'emergency',
          },
          desk,
        );
        st.appointmentId = appt.id;
      }, st);

      if (v.outcome === 'cancel') {
        const cancelAt = new Date(Math.max(bookedAt.getTime() + 30 * 60_000, slot.getTime() - 20 * 3600_000));
        this.on(cancelAt, async () => {
          await this.appts.cancel(
            st.appointmentId!, t,
            { reasonCode: 'other', reason: rng.pick(['Patient travelling', 'Feeling better', 'Will reschedule', 'Family emergency']) } as any,
            desk,
          );
          this.counts.cancelled++;
          kill();
        }, st);
        return;
      }
      const confirmAt = this.at(locKey, addDays(ymd, -1), '18:30');
      if (lead > 0 && confirmAt > bookedAt && rng.chance(0.6)) {
        this.on(confirmAt, () => this.appts.confirm(st.appointmentId!, t, desk).then(() => undefined), st);
      }
      if (v.outcome === 'no_show') {
        this.on(new Date(slot.getTime() + 75 * 60_000), async () => {
          await this.appts.noShow(st.appointmentId!, t, desk);
          this.counts.noShow++;
          kill();
        }, st);
        return;
      }
    }

    // 2. Arrival: token in the doctor's queue; vitals while waiting.
    let arrive = new Date(slot.getTime() - rng.int(3, 15) * 60_000);
    if (firstVisit && arrive <= registered) arrive = new Date(registered.getTime() + 10 * 60_000);
    this.on(arrive, async () => {
      const deskActor = await this.actor(desk, locKey);
      const arrival: any = st.appointmentId
        ? await this.queue.checkInAppointment(t, deskActor, st.appointmentId, {} as any, null)
        : await this.queue.registerWalkIn(t, deskActor, { doctorId: v.doctor.employeeId, patientId: v.patient.id, reasonForVisit: reason } as any, null);
      if (!st.appointmentId) this.counts.walkIns++;
      st.entryId = arrival.entry.id;
      const sessionId: string = arrival.sessionId;
      if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, { locKey, ymd, doctor: v.doctor });

      const nurse = staffByRole(clinic, 'assistant', locKey)[0];
      if (clinic.kind === 'general' || rng.chance(0.15)) {
        const by = nurse?.userId ?? desk;
        await this.patients.createVitals(v.patient.id, t, vitals(this.ctx, v, by, st.appointmentId), clinicActor(by));
      }
    }, st);

    // 3. Doctor (starts the queue with the first patient), calls, consults.
    const called = new Date(Math.max(slot.getTime() + rng.int(0, 4) * 60_000, arrive.getTime() + 2 * 60_000));
    this.on(called, async () => {
      const docActor = await this.actor(docUser, locKey);
      const session = [...this.sessions.entries()].find(([, s]) => s.doctor === v.doctor && s.ymd === ymd && s.locKey === locKey);
      if (session && !(session[1] as any).started) {
        await this.queue.startSession(t, docActor, session[0], null);
        (session[1] as any).started = true;
      }
      await this.queue.selectPatient(t, docActor, st.entryId!, undefined, undefined, null);
      travelTo(new Date(called.getTime() + 60_000));
      const started: any = await this.queue.startConsultation(t, docActor, st.entryId!, undefined, null);
      st.encounterId = started.encounterId;
      await this.consult(st, await this.access(docUser, locKey));
    }, st);

    // 4. Done (charges are created here), sometimes feedback later.
    const finished = new Date(called.getTime() + rng.int(12, 20) * 60_000);
    this.on(finished, async () => {
      await this.queue.complete(t, await this.actor(docUser, locKey), st.entryId!, undefined, null);
      this.counts.visits++;
      this.reserved.delete(v.patient.id);
      const key = `${locKey}|${ymd}`;
      if (!this.done.has(key)) this.done.set(key, []);
      this.done.get(key)!.push({
        clinicKey: clinic.key,
        locationKey: locKey,
        ymd,
        patientId: v.patient.id,
        doctor: v.doctor,
        appointmentId: st.appointmentId,
        queueEntryId: st.entryId!,
        encounterId: st.encounterId!,
      });
    }, st);

    if (rng.chance(0.15)) {
      this.on(new Date(finished.getTime() + 40 * 60_000), async () => {
        await this.patients.createFeedback(
          v.patient.id,
          t,
          {
            rating: rng.pick([5, 5, 4, 4, 3]),
            category: rng.pick(['doctor', 'service', 'waiting_time', 'facility']),
            feedbackText: rng.pick(['Very satisfied, doctor explained everything', 'Staff was polite', 'Had to wait a bit long', 'بہت اچھا تجربہ رہا', 'Clean clinic']),
            appointmentId: st.appointmentId ?? undefined,
            dentistId: docUser,
          } as any,
          clinicActor(desk),
        );
      }, st);
    }
  }

  /** End of a location's day: doctors close their queues, hooks, notifications. */
  scheduleDayEnd(locKey: string, ymd: string): void {
    this.on(this.at(locKey, ymd, '21:30'), () => this.dayEnd(locKey, ymd, true));
  }

  async dayEnd(locKey: string, ymd: string, closeQueues: boolean): Promise<void> {
    const t = tenant(this.clinic, locKey);
    if (closeQueues) {
      for (const [id, s] of this.sessions) {
        if (s.closed || s.locKey !== locKey || s.ymd !== ymd || !(s as any).started) continue;
        await this.queue.closeSession(t, await this.actor(s.doctor.userId!, locKey), id, { decisions: [] } as any, null);
        s.closed = true;
      }
    }
    const dayVisits = this.done.get(`${locKey}|${ymd}`) ?? [];
    for (const hook of this.ctx.hooks.endOfDay) await hook(this.clinic, locKey, ymd, dayVisits);
    // What the notification relay would have sent during the day (in-app
    // bell; email is only logged — the seed has no SMTP).
    await this.ctx.app.get(NotificationDispatcher).drain();
  }

  // ── The consultation itself ─────────────────────────────────────────

  private async consult(st: VisitState, docAccess: AccessContext): Promise<void> {
    const { rng } = this.ctx;
    const { clinic, locKey, ymd, v } = st;
    const encounterId = st.encounterId!;
    const t = tenant(clinic, locKey);
    const docUser = v.doctor.userId!;
    const actor = clinicActor(docUser);

    // Plan session visit: one session of the next open step.
    if (v.plan) {
      const op = v.plan;
      const item = op.items.find((i) => i.left > 0)!;
      await this.encounters.updateNotes(
        encounterId,
        t,
        {
          chiefComplaint: `Scheduled session: ${item.label}`,
          examination: 'Healing satisfactory, no complaints',
          diagnosis: op.name,
          advice: 'Continue as advised. Next session as booked.',
        } as any,
        docUser,
      );
      await this.plans.session(v.patient.id, op.planId, item.id, t, { encounterId, notes: 'Session done' }, actor);
      item.left--;
      if (op.items.every((i) => i.left <= 0)) this.openPlans.delete(v.patient.id);
      else op.nextOn = addDays(ymd, rng.int(5, 14));
      return;
    }

    const sc = v.scenario!;
    await this.encounters.updateNotes(
      encounterId,
      t,
      {
        chiefComplaint: sc.complaint,
        examination: sc.examination,
        diagnosis: sc.diagnosis,
        advice: sc.advice,
        followUpDate: rng.chance(0.3) ? addDays(ymd, rng.pick([7, 14, 30])) : undefined,
      } as any,
      docUser,
    );

    // Only PROCEDURE services can be recorded as treatments.
    const procedures = new Set(servicesFor(clinic.kind).filter((x) => x.kind === 'PROCEDURE').map((x) => x.code));
    for (const code of sc.today) {
      if (!procedures.has(code)) continue; // e.g. a certificate: billed by the desk, not a treatment
      const serviceId = clinic.services[code];
      await this.treatments.createForEncounter(t, encounterId, serviceId ? { serviceId } : { treatmentName: code }, docUser);
    }

    if (clinic.kind === 'dental' && sc.chart) {
      await this.patients.createTeethChart(
        v.patient.id,
        t,
        {
          dentistId: docUser,
          appointmentId: st.appointmentId ?? undefined,
          chartData: sc.chart,
          notes: sc.diagnosis,
          isInitialChart: !this.charted.has(v.patient.id),
        },
        actor,
      );
      this.charted.add(v.patient.id);
    }

    // Treatment plan (needs the billing catalog for prices).
    if (sc.plan && sc.plan.lines.every((l) => clinic.services[l.code])) {
      const plan: any = await this.plans.create(
        v.patient.id,
        t,
        docAccess,
        {
          planName: sc.plan.name,
          encounterId,
          dentistId: v.doctor.employeeId,
          items: sc.plan.lines.map((l) => ({
            serviceId: clinic.services[l.code],
            toothNumber: l.tooth ?? null,
            estimatedSessions: l.sessions,
          })),
        },
        actor,
      );
      this.counts.plans++;
      // Most patients go ahead; the rest keep the plan as a proposal.
      if (rng.chance(0.75)) {
        await this.plans.accept(v.patient.id, plan.id, t, actor);
        const items = [...(plan.items ?? [])].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.openPlans.set(v.patient.id, {
          planId: plan.id,
          patientId: v.patient.id,
          doctorKey: v.doctor.key,
          locationKey: locKey,
          name: sc.plan.name,
          // Long plans (braces) only get a few sessions inside the history.
          items: items.map((i: any) => ({
            id: i.id,
            left: Math.min(i.estimatedSessions, 3),
            label: i.toothNumber ? `${i.procedureName} #${i.toothNumber}` : i.procedureName,
          })),
          nextOn: addDays(ymd, rng.int(3, 10)),
        });
      }
    }

    if (sc.meds?.length) {
      const rx = await this.rx.create(
        t,
        {
          patientId: v.patient.id,
          appointmentId: st.appointmentId ?? undefined,
          encounterId,
          doctorId: v.doctor.employeeId,
          diagnosis: sc.diagnosis,
          chiefComplaint: sc.complaint,
          furtherPlan: sc.advice,
          instructionsEnglish: sc.advice,
          instructionsUrdu: sc.instructionsUrdu,
          medicines: sc.meds.map(medDto),
        } as any,
        v.doctor.employeeId,
        docAccess,
      );
      // Most are signed off; a few stay as drafts.
      if (rng.chance(0.9)) await this.rx.finalize(rx.id, clinic.orgId, {}, v.doctor.employeeId);
      this.counts.rx++;
    }
  }

  /** Bookings for coming days (made "now"). */
  async bookAhead(locKey: string, ymd: string, pv: PlannedVisit): Promise<void> {
    const t = tenant(this.clinic, locKey);
    const desk = deskUserId(this.clinic, locKey);
    const appt = await this.appts.create(
      t,
      {
        patientId: pv.patient.id,
        doctorId: pv.doctor.employeeId,
        startTime: this.at(locKey, ymd, pv.hhmm).toISOString(),
        duration: SLOT_MIN,
        type: (pv.plan ? 'treatment' : pv.scenario?.type ?? 'consultation') as any,
        reasonForVisit: pv.plan ? `${pv.plan.name} — next session` : pv.scenario?.complaint,
      },
      desk,
    );
    if (this.ctx.rng.chance(0.4)) await this.appts.confirm(appt.id, t, desk);
  }

  summary(): string {
    const c = this.counts;
    return `${c.visits} visits (${c.walkIns} walk-ins), ${c.noShow} no-shows, ${c.cancelled} cancelled, ${c.plans} plans, ${c.rx} prescriptions`;
  }
}

/** `clinicKeys`: only these clinics (one child process per clinic, see run.ts). */
export async function seedVisits(ctx: SeedContext, clinicKeys?: string[]): Promise<void> {
  ctx.visits = [];
  for (const clinic of ctx.clinics.filter((c) => !clinicKeys || clinicKeys.includes(c.key))) {
    ctx.visits.push(...(await clinicVisits(ctx, clinic)));
  }
  ctx.visits.sort((a, b) => a.ymd.localeCompare(b.ymd));
}

async function clinicVisits(ctx: SeedContext, clinic: SeedClinic): Promise<SeedVisit[]> {
  const sim = new VisitSim(ctx, clinic);
  const first = addDays(ctx.today, -ctx.historyDays);
  const earliest = sim.at(clinic.locations[0].key, first, '08:00');
  const now = realNow();

  // Plan every clinic day up to today; a day's bookings are made up to
  // LOOKAHEAD days earlier, so each day is planned that much ahead.
  const planDay = (ymd: string) => {
    if (dayOfWeek(ymd) === 0) return; // closed on Sunday
    const recent = ymd >= addDays(ctx.today, -14);
    for (const loc of clinic.locations) {
      // Busier lately (dashboards), quieter further back; today a bit more.
      const busy = ymd === ctx.today ? 5 : recent ? ctx.rng.int(2, 3) : ctx.rng.pick([0, 0, 1, 1, 2]);
      for (const pv of sim.plan(loc.key, ymd, busy)) sim.schedule(loc.key, ymd, pv, earliest);
      if (ymd < ctx.today) sim.scheduleDayEnd(loc.key, ymd);
    }
  };

  for (let i = 0; i < LOOKAHEAD && addDays(first, i) <= ctx.today; i++) planDay(addDays(first, i));
  for (let ymd = first; ymd <= ctx.today; ymd = addDays(ymd, 1)) {
    const ahead = addDays(ymd, LOOKAHEAD);
    if (ahead <= ctx.today) planDay(ahead);
    if (ymd === ctx.today) {
      // Today: only what has happened by now.
      await sim.runUntil(now);
      break;
    }
    await sim.runUntil(sim.at(clinic.locations[0].key, addDays(ymd, 1), '00:00'));
    if (dayOfWeek(ymd) === 6) log(`up to ${ymd}: ${sim.summary()}`);
  }
  sim.dropPending(); // later today: those patients are still booked / waiting

  // Today's money so far (no queue closing — the day is still running).
  travelHome();
  for (const loc of clinic.locations) {
    if ((sim.done.get(`${loc.key}|${ctx.today}`) ?? []).length) await sim.dayEnd(loc.key, ctx.today, false);
  }

  // The next two weeks: bookings made now.
  travelHome();
  for (let i = 1; i <= FUTURE_DAYS; i++) {
    const ymd = addDays(ctx.today, i);
    if (dayOfWeek(ymd) === 0) continue;
    for (const loc of clinic.locations) {
      for (const pv of sim.plan(loc.key, ymd, ctx.rng.int(1, 3))) {
        if (!pv.walkIn) await sim.bookAhead(loc.key, ymd, pv);
      }
    }
  }
  travelHome();
  log(`${clinic.name}: ${sim.summary()}`);
  return [...sim.done.values()].flat();
}

// ── Small helpers ─────────────────────────────────────────────────────

function slots(start: string, end: string): string[] {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(start); m + SLOT_MIN <= toMin(end); m += SLOT_MIN) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/** HH:MM on the clinic clock (all seeded clinics are in Asia/Karachi, UTC+5). */
function localHHMM(d: Date): string {
  const k = new Date(d.getTime() + 5 * 3600_000);
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

function medDto(m: Med, i: number) {
  return {
    medicineName: m.name,
    medicineNameUrdu: m.urdu,
    type: m.type,
    dosage: m.dosage,
    frequency: m.frequency,
    frequencyTiming: m.timing ?? [],
    mealRelation: m.meal ?? 'NONE',
    duration: m.duration,
    specialInstructions: m.note,
    specialInstructionsUrdu: m.noteUrdu,
    sortOrder: i,
  };
}

function vitals(ctx: SeedContext, v: PlannedVisit, by: string, appointmentId: string | null) {
  const { rng } = ctx;
  const child = v.patient.isMinor;
  const htn = v.scenario?.key === 'htn';
  return {
    recordedBy: by,
    appointmentId: appointmentId ?? undefined,
    bpSystolic: child ? undefined : htn ? rng.int(145, 165) : rng.int(108, 135),
    bpDiastolic: child ? undefined : htn ? rng.int(90, 102) : rng.int(70, 88),
    pulseRate: rng.int(68, 98),
    temperature: v.scenario?.key === 'urti' ? 38.4 : Number((36.6 + rng.next() * 0.6).toFixed(1)),
    oxygenSaturation: v.scenario?.key === 'asthma' ? 94 : rng.int(96, 99),
    weightKg: child ? rng.int(10, 30) : rng.int(52, 92),
    heightCm: child ? rng.int(80, 135) : rng.int(152, 182),
    isDiabetic: v.scenario?.key === 'dm',
    isHypertensive: htn,
    isPregnant: v.scenario?.key === 'anc',
  } as any;
}
