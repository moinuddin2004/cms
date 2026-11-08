import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { SeedApp } from './seed-app';

/** Password of every seeded login (documented in database/seed/README.md). */
export const SEED_PASSWORD = 'Seed@12345';

/** Every seeded login lives on this reserved TLD: mail to it can never be delivered. */
export const SEED_EMAIL_DOMAIN = 'seed.test';

export type ClinicKind = 'dental' | 'general';
export type RoleKey = 'admin' | 'doctor' | 'receptionist' | 'assistant' | 'accountant';

export interface SeedLocation {
  key: string;
  id: string;
  name: string;
  timezone: string;
}

export interface SeedStaff {
  key: string;
  name: string;
  employeeId: string;
  /** Login (users.uuid); null for staff without portal access. */
  userId: string | null;
  email: string | null;
  role: RoleKey | null;
  designation: string;
  isDoctor: boolean;
  /** locationKey → assignment id */
  assignments: Record<string, string>;
  /** Doctor specialty label (dental: orthodontist, …; general: GP, …). */
  specialty?: string;
  /** Weekly hours per location key (doctors only). */
  schedule: Record<string, { days: number[]; start: string; end: string }>;
}

export interface SeedPatient {
  id: string;
  name: string;
  phone: string;
  gender: 'male' | 'female';
  locationKey: string;
  patientNumber: string;
  /** Clinic day of registration; the patient's visits start from here. */
  registeredOn: string;
  /** Instant of registration (ISO); a first visit comes after it. */
  registeredAt: string;
  isMinor: boolean;
}

export interface SeedClinic {
  key: string;
  kind: ClinicKind;
  orgId: string;
  name: string;
  ownerUserId: string;
  ownerEmail: string;
  locations: SeedLocation[];
  /** templateKey → employment_roles.id */
  roles: Record<string, string>;
  staff: SeedStaff[];
  patients: SeedPatient[];
  /** Billing service catalog: code (data/services.ts) → services.id. Filled by the billing step. */
  services: Record<string, string>;
}

export interface SeedLogin {
  who: string;
  email: string;
  role: string;
  clinic?: string;
}

export interface SeedContext {
  app: SeedApp;
  rng: Rng;
  superAdminId: string;
  clinics: SeedClinic[];
  logins: SeedLogin[];
  /** Real "today" when the seed started (YYYY-MM-DD, Asia/Karachi). */
  today: string;
  /** How many days of history to build. */
  historyDays: number;
  /** Completed visits (filled by the visits step, oldest first). */
  visits?: SeedVisit[];
  /**
   * State steps share with later steps / hooks. Plain JSON only: it is copied
   * into the visit child processes (see run.ts).
   */
  data: Record<string, any>;
  hooks: {
    /**
     * Run by the visits step after each simulated clinic day, per location,
     * with the clock at ~20:30 that day (e.g. billing collects the day's
     * charges and closes the cash drawer).
     */
    endOfDay: Array<(clinic: SeedClinic, locationKey: string, ymd: string, visits: SeedVisit[]) => Promise<void>>;
  };
}

export interface SeedVisit {
  clinicKey: string;
  locationKey: string;
  ymd: string;
  patientId: string;
  doctor: SeedStaff;
  appointmentId: string | null;
  queueEntryId: string;
  encounterId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function tenant(clinic: SeedClinic, locationKey?: string): TenantContext {
  const loc = locationKey
    ? clinic.locations.find((l) => l.key === locationKey)
    : clinic.locations[0];
  if (!loc) throw new Error(`Unknown location ${locationKey} in ${clinic.key}`);
  return { organizationId: clinic.orgId, locationId: loc.id };
}

export function clinicActor(userId: string | null): ActorRef {
  return { userId, side: ActorSide.CLINIC, ip: '127.0.0.1', requestId: 'seed' };
}

export function location(clinic: SeedClinic, key: string): SeedLocation {
  const l = clinic.locations.find((x) => x.key === key);
  if (!l) throw new Error(`Unknown location ${key}`);
  return l;
}

export function doctors(clinic: SeedClinic, locationKey?: string): SeedStaff[] {
  return clinic.staff.filter(
    (s) => s.isDoctor && (!locationKey || s.assignments[locationKey]),
  );
}

export function staffByRole(
  clinic: SeedClinic,
  role: RoleKey,
  locationKey?: string,
): SeedStaff[] {
  return clinic.staff.filter(
    (s) => s.role === role && (!locationKey || s.assignments[locationKey]),
  );
}

/** Front-desk user at a location (receptionist, else admin, else owner). */
export function deskUserId(clinic: SeedClinic, locationKey: string): string {
  const r =
    staffByRole(clinic, 'receptionist', locationKey)[0] ??
    staffByRole(clinic, 'admin')[0];
  return r?.userId ?? clinic.ownerUserId;
}

// ─── Deterministic random (same data on every run) ─────────────────────

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// ─── Calendar helpers (plain YYYY-MM-DD) ────────────────────────────────

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

export function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed] ${msg}`);
}
