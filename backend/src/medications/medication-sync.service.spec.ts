import type { DataSource } from 'typeorm';
import type { ClockService } from 'src/common/clock/clock.service';
import type { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { PatientProfile } from 'src/patient-app/entities/patient-profile.entity';
import { PatientRecordLink } from 'src/patient-app/entities/patient-record-link.entity';
import { Prescription } from 'src/prescriptions/entities/prescription.entity';
import { PrescriptionStatus } from 'src/prescriptions/enums/prescription-status.enum';
import { MedicationSchedule } from './entities/medication-schedule.entity';
import { MedicationSyncService } from './medication-sync.service';

type Row = Record<string, any>;

interface World {
  prescription: Row | null;
  links: Row[];
  profiles: Row[];
  schedules: Row[];
  outbox: unknown[][];
  featureEnabled: boolean;
  featureCalls?: unknown[][];
}

function med(id: string, name: string, over: Row = {}): Row {
  return {
    id,
    medicineName: name,
    medicineNameUrdu: null,
    dosage: '500 mg',
    frequency: 'BD',
    frequencyTiming: [],
    mealRelation: 'AFTER_MEAL',
    duration: '5 days',
    specialInstructions: null,
    specialInstructionsUrdu: null,
    sortOrder: 0,
    ...over,
  };
}

function build(world: World) {
  let seq = 0;
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) => row[k] === v);

  const scheduleRepo = {
    find: async ({ where }: { where: Row }) =>
      world.schedules.filter((s) => matches(s, where)).map((s) => ({ ...s })),
    insert: async (row: Row) => {
      const hit = world.schedules.find(
        (s) =>
          s.profileId === row.profileId &&
          s.prescriptionMedicineId === row.prescriptionMedicineId,
      );
      if (hit) throw new Error('uq_medication_schedules_profile_rx_medicine');
      world.schedules.push({ id: `s${++seq}`, ...row });
    },
    save: async (row: Row) => {
      const i = world.schedules.findIndex((s) => s.id === row.id);
      world.schedules[i] = { ...row };
    },
  };
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === MedicationSchedule) return scheduleRepo;
      if (entity === PatientProfile) {
        return {
          findOne: async ({ where }: { where: Row }) =>
            world.profiles.find((p) => p.id === where.id) ?? null,
        };
      }
      throw new Error('unexpected repo');
    },
    query: async (...args: unknown[]) => {
      world.outbox.push(args);
      return [];
    },
  };
  const dataSource = {
    getRepository: (entity: unknown) => {
      if (entity === Prescription) {
        return { findOne: async () => world.prescription };
      }
      if (entity === PatientRecordLink) {
        return {
          find: async ({ where }: { where: Row }) =>
            world.links.filter((l) => matches(l, where)),
        };
      }
      throw new Error('unexpected repo');
    },
    transaction: async (cb: (m: unknown) => unknown) => cb(manager),
    query: async (sql: string, params: unknown[]) => {
      // stopForInactiveLinks
      if (!sql.includes("SET status = 'stopped'")) return [];
      const active = params[1] as string[];
      let n = 0;
      for (const s of world.schedules) {
        if (
          s.prescriptionId === params[0] &&
          ['active', 'paused'].includes(s.status) &&
          !active.includes(s.profileId)
        ) {
          s.status = 'stopped';
          n += 1;
        }
      }
      return [[], n];
    },
  } as unknown as DataSource;
  const clock = {
    timezoneFor: async () => 'Asia/Karachi',
    today: () => '2026-11-15',
  } as unknown as ClockService;
  const flags = {
    isFeatureEnabled: async (...args: unknown[]) => {
      (world.featureCalls ??= []).push(args);
      return world.featureEnabled;
    },
  } as unknown as FeatureFlagsService;
  return new MedicationSyncService(dataSource, clock, flags);
}

function newWorld(): World {
  return {
    prescription: {
      id: 'rx1',
      organizationId: 'org1',
      locationId: 'loc1',
      patientId: 'pat1',
      status: PrescriptionStatus.FINALIZED,
      version: 1,
      signedAt: new Date('2026-11-15T07:00:00Z'),
      medicines: [
        med('m1', 'Amoxicillin', {
          frequency: 'TDS',
          duration: '7 days',
          sortOrder: 0,
        }),
        med('m2', 'Panadol', {
          frequency: '',
          frequencyTiming: ['night'],
          duration: 'ongoing',
          sortOrder: 1,
        }),
      ],
    },
    links: [
      { id: 'l1', profileId: 'p1', organizationId: 'org1', patientId: 'pat1', status: 'active' },
    ],
    profiles: [{ id: 'p1', accountId: 'acc1' }],
    schedules: [],
    outbox: [],
    featureEnabled: true,
  };
}

describe('MedicationSyncService', () => {
  it('creates one schedule per medicine with parsed times and end dates', async () => {
    const world = newWorld();
    const result = await build(world).syncPrescription('rx1');

    expect(result).toEqual({ profiles: 1, created: 2, updated: 0, stopped: 0 });
    const [amox, pan] = world.schedules;
    expect(amox).toMatchObject({
      profileId: 'p1',
      source: 'prescription',
      organizationId: 'org1',
      prescriptionId: 'rx1',
      prescriptionMedicineId: 'm1',
      prescriptionVersion: 1,
      hidden: false,
      name: 'Amoxicillin',
      doseText: '500 mg',
      times: ['08:00', '14:00', '20:00'],
      startDate: '2026-11-15',
      endDate: '2026-11-21',
      endDateSource: 'parsed',
      status: 'active',
      patientEdited: false,
    });
    expect(pan).toMatchObject({
      times: ['22:00'],
      endDate: null,
      endDateSource: 'unknown',
    });
  });

  it('writes a medications feed hint to the account room', async () => {
    const world = newWorld();
    await build(world).syncPrescription('rx1');
    const insert = world.outbox.find((q) => String(q[0]).includes('INSERT INTO outbox'));
    expect(insert?.[1]).toEqual([
      'org1',
      'patient:acc1',
      JSON.stringify({ type: 'feed.changed', kinds: ['medications'] }),
    ]);
  });

  it('is idempotent: a second run updates in place and creates nothing', async () => {
    const world = newWorld();
    const svc = build(world);
    await svc.syncPrescription('rx1');
    const second = await svc.syncPrescription('rx1');
    expect(second).toMatchObject({ created: 0, updated: 2, stopped: 0 });
    expect(world.schedules).toHaveLength(2);
  });

  it('amendment re-creates medicine rows (new ids): matched by name, no duplicates', async () => {
    const world = newWorld();
    const svc = build(world);
    await svc.syncPrescription('rx1');

    world.prescription!.medicines = [
      med('m1b', 'amoxicillin ', { frequency: 'BD', duration: '10 days' }),
      med('m2b', 'Panadol', { frequencyTiming: ['night'], duration: 'ongoing', sortOrder: 1 }),
    ];
    const result = await svc.syncPrescription('rx1');

    expect(result).toMatchObject({ created: 0, updated: 2, stopped: 0 });
    expect(world.schedules).toHaveLength(2);
    const amox = world.schedules.find((s) => s.name === 'amoxicillin ' || s.name.trim().toLowerCase() === 'amoxicillin')!;
    expect(amox.prescriptionMedicineId).toBe('m1b');
    expect(amox.times).toEqual(['08:00', '20:00']);
    expect(amox.endDate).toBe('2026-11-24');
    expect(amox.startDate).toBe('2026-11-15');
  });

  it('adds new lines and stops removed ones on amendment', async () => {
    const world = newWorld();
    const svc = build(world);
    await svc.syncPrescription('rx1');

    world.prescription!.medicines = [
      med('m1b', 'Amoxicillin'),
      med('m3', 'Brufen', { sortOrder: 2 }),
    ];
    const result = await svc.syncPrescription('rx1');

    expect(result).toMatchObject({ created: 1, updated: 1, stopped: 1 });
    expect(world.schedules.find((s) => s.name === 'Panadol')!.status).toBe('stopped');
    expect(world.schedules.find((s) => s.name === 'Brufen')!.status).toBe('active');
  });

  it('keeps what the patient edited', async () => {
    const world = newWorld();
    const svc = build(world);
    await svc.syncPrescription('rx1');
    const s = world.schedules[0];
    Object.assign(s, {
      patientEdited: true,
      times: ['09:30'],
      endDate: '2026-12-31',
      endDateSource: 'patient',
      status: 'paused',
    });

    await svc.syncPrescription('rx1');
    expect(world.schedules[0]).toMatchObject({
      times: ['09:30'],
      endDate: '2026-12-31',
      endDateSource: 'patient',
      status: 'paused',
    });
  });

  it('creates nothing for revoked / frozen links', async () => {
    const world = newWorld();
    world.links = [];
    const result = await build(world).syncPrescription('rx1');
    expect(result.profiles).toBe(0);
    expect(world.schedules).toHaveLength(0);
  });

  it('creates nothing when the clinic has the patient app off', async () => {
    const world = newWorld();
    world.featureEnabled = false;
    await build(world).syncPrescription('rx1');
    expect(world.schedules).toHaveLength(0);
  });

  it('ignores prescriptions that are not finalized', async () => {
    const world = newWorld();
    world.prescription!.status = PrescriptionStatus.AMENDED;
    await build(world).syncPrescription('rx1');
    expect(world.schedules).toHaveLength(0);
    world.prescription = null;
    expect((await build(world).syncPrescription('rx1')).profiles).toBe(0);
  });

  it('creates one set per linked profile', async () => {
    const world = newWorld();
    world.links.push({ id: 'l2', profileId: 'p2', organizationId: 'org1', patientId: 'pat1', status: 'active' });
    world.profiles.push({ id: 'p2', accountId: 'acc2' });
    const result = await build(world).syncPrescription('rx1');
    expect(result).toMatchObject({ profiles: 2, created: 4 });
    expect(new Set(world.schedules.map((s) => s.profileId))).toEqual(new Set(['p1', 'p2']));
  });

  it('checks the patient_app feature at the prescription location (overrides)', async () => {
    const world = newWorld();
    await build(world).syncPrescription('rx1');
    expect(world.featureCalls?.[0]).toEqual(['org1', 'patient_app', 'loc1']);
  });

  it('stamps the prescription version (sweep marker), also after an amendment', async () => {
    const world = newWorld();
    const svc = build(world);
    await svc.syncPrescription('rx1');
    expect(world.schedules.every((s) => s.prescriptionVersion === 1)).toBe(true);
    world.prescription!.version = 2;
    await svc.syncPrescription('rx1');
    expect(world.schedules.every((s) => s.prescriptionVersion === 2)).toBe(true);
  });

  it('re-finalize stops schedules of a profile whose link is no longer active', async () => {
    const world = newWorld();
    world.links.push({ id: 'l2', profileId: 'p2', organizationId: 'org1', patientId: 'pat1', status: 'active' });
    world.profiles.push({ id: 'p2', accountId: 'acc2' });
    const svc = build(world);
    await svc.syncPrescription('rx1');
    world.links = world.links.filter((l) => l.profileId !== 'p2'); // p2 left
    const result = await svc.syncPrescription('rx1');
    expect(result.stopped).toBe(2);
    expect(world.schedules.filter((s) => s.profileId === 'p2').every((s) => s.status === 'stopped')).toBe(true);
    expect(world.schedules.filter((s) => s.profileId === 'p1').every((s) => s.status === 'active')).toBe(true);
  });

  it('with no active link at all, still stops what is left and creates nothing new', async () => {
    const world = newWorld();
    const svc = build(world);
    await svc.syncPrescription('rx1');
    world.links = [];
    const result = await svc.syncPrescription('rx1');
    expect(result).toMatchObject({ created: 0, stopped: 2, profiles: 0 });
  });

  it('serializes concurrent syncs with an advisory lock per prescription', async () => {
    const world = newWorld();
    await build(world).syncPrescription('rx1');
    expect(String(world.outbox[0][0])).toContain('pg_advisory_xact_lock');
    expect(world.outbox[0][1]).toEqual(['rx1']);
  });
});
