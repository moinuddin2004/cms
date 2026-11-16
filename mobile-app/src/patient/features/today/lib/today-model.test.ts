import type { DoseEvent, MedicationSchedule } from '@/patient/features/medications';
import type { PatientAppointment } from '@/patient/features/records';

import { buildTodayDoses, groupDoses, groupOf, splitAppointments } from './today-model';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

const schedule = (o: Partial<MedicationSchedule> = {}): MedicationSchedule => ({
  id: 's1',
  profileId: 'p1',
  source: 'prescription',
  clinic: null,
  prescriptionId: 'rx1',
  prescriptionMedicineId: 'm1',
  name: 'Amoxicillin',
  nameUrdu: null,
  doseText: '500 mg',
  mealRelation: 'AFTER_MEAL',
  times: ['08:00', '20:00'],
  startDate: '2026-11-01',
  endDate: null,
  endDateSource: 'unknown',
  status: 'active',
  instructions: null,
  instructionsUrdu: null,
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...o,
});

const event = (scheduleId: string, dueMs: number, action: 'taken' | 'skipped' = 'taken'): DoseEvent => ({
  scheduleId,
  dueAt: new Date(dueMs).toISOString(),
  action,
  actedAt: new Date(dueMs).toISOString(),
});

const NOW = at(2026, 11, 16, 9, 0);

describe('groupOf', () => {
  it.each([
    ['04:59', 'night'],
    ['05:00', 'morning'],
    ['11:59', 'morning'],
    ['12:00', 'afternoon'],
    ['16:59', 'afternoon'],
    ['17:00', 'evening'],
    ['20:59', 'evening'],
    ['21:00', 'night'],
    ['00:30', 'night'],
  ] as const)('%s → %s', (time, group) => expect(groupOf(time)).toBe(group));
});

describe('buildTodayDoses', () => {
  it("lists only the phone's calendar day, in time order, with states", () => {
    const doses = buildTodayDoses(
      [schedule({ times: ['08:00', '14:00', '22:00'] })],
      [event('s1', at(2026, 11, 16, 8)), event('s1', at(2026, 11, 16, 14), 'skipped')],
      NOW,
    );
    expect(doses.map((d) => [d.time, d.state])).toEqual([
      ['08:00', 'taken'],
      ['14:00', 'skipped'],
      ['22:00', 'pending'],
    ]);
  });

  it('keeps a past, unacted dose visible as pending', () => {
    expect(buildTodayDoses([schedule({ times: ['06:00'] })], [], NOW)[0].state).toBe('pending');
  });

  it('excludes paused schedules and finished courses', () => {
    expect(buildTodayDoses([schedule({ status: 'paused' }), schedule({ id: 'x', endDate: '2026-11-15' })], [], NOW)).toEqual([]);
  });

  it('flags the last days of a course', () => {
    const [d] = buildTodayDoses([schedule({ times: ['08:00'], endDate: '2026-11-18' })], [], NOW);
    expect(d.courseEndsInDays).toBe(2);
    expect(buildTodayDoses([schedule({ times: ['08:00'], endDate: '2026-11-25' })], [], NOW)[0].courseEndsInDays).toBeNull();
    expect(buildTodayDoses([schedule({ times: ['08:00'], endDate: '2026-11-16' })], [], NOW)[0].courseEndsInDays).toBe(0);
  });

  it('groups into non-empty sections in day order', () => {
    const sections = groupDoses(buildTodayDoses([schedule({ times: ['22:00', '08:00'] })], [], NOW));
    expect(sections.map((s) => s.group)).toEqual(['morning', 'night']);
  });
});

const appt = (id: string, startIso: string, status = 'scheduled', timezone = 'UTC'): PatientAppointment =>
  ({
    id,
    profileId: 'p1',
    clinic: { organizationId: 'o', name: 'C', logoUrl: null, brandColor: null, clinicStatus: 'active' },
    location: { id: 'l', name: 'L', timezone, phone: null, whatsapp: null, address: null },
    doctorName: null,
    startTime: startIso,
    endTime: startIso,
    status,
    type: 'consultation',
    patientConfirmedAt: null,
    canConfirm: false,
  }) as PatientAppointment;

describe('splitAppointments', () => {
  const now = Date.parse('2026-11-16T10:00:00.000Z');

  it('splits today and the next 3 days on the appointment clinic clock', () => {
    const out = splitAppointments(
      [
        appt('later', '2026-11-16T15:00:00.000Z'),
        appt('tomorrow', '2026-11-17T09:00:00.000Z'),
        appt('far', '2026-11-25T09:00:00.000Z'),
        appt('cancelled', '2026-11-16T15:00:00.000Z', 'cancelled'),
        appt('done', '2026-11-16T12:00:00.000Z', 'completed'),
      ],
      now,
    );
    expect(out.today.map((a) => a.id)).toEqual(['later']);
    expect(out.comingUp.map((a) => a.id)).toEqual(['tomorrow']);
  });

  it("uses the location's zone for 'today'", () => {
    // 23:30 UTC on the 16th is already the 17th in Karachi (UTC+5)
    const a = appt('k', '2026-11-16T23:30:00.000Z', 'scheduled', 'Asia/Karachi');
    const out = splitAppointments([a], now);
    expect(out.today).toEqual([]);
    expect(out.comingUp.map((x) => x.id)).toEqual(['k']);
  });
});
