import { SkipSendError } from 'src/notifications/delivery/channel-provider';
import type { OutgoingNotification } from 'src/notifications/delivery/channel-provider';
import { OutboxStatus } from 'src/notifications/notifications.enums';
import {
  APPOINTMENT_REMINDER_EVENT,
  AppointmentReminderService,
  REMINDER_LEAD_MS,
} from './appointment-reminders.service';

const NOW = new Date('2026-11-16T10:00:00Z');
const START = new Date(NOW.getTime() + 3 * 24 * 60 * 60_000);
const END = new Date(START.getTime() + 30 * 60_000);

const booked = (over: Record<string, unknown> = {}) => ({
  organization_id: 'org-1',
  location_id: 'loc-1',
  patient_id: 'pat-1',
  start_time: START,
  end_time: END,
  status: 'confirmed',
  ...over,
});

const target = () => ({
  id: 'appt-1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  patientId: 'stale-patient', // the service must trust the database, not this
  startTime: new Date(0),
  endTime: new Date(0),
});

function setup(opts: { reachable?: string[]; row?: Record<string, unknown> | null } = {}) {
  let finalizer: (n: OutgoingNotification) => Promise<unknown> = () =>
    Promise.reject(new Error('no finalizer'));
  const row = opts.row === undefined ? booked() : opts.row;
  const sqlLog: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    sqlLog.push({ sql, params });
    if (sql.includes('FROM appointments')) return Promise.resolve(row ? [row] : []);
    return Promise.resolve([]);
  });
  const manager = { query };
  const transaction = jest.fn((fn: (m: unknown) => Promise<void>) => fn(manager));
  const enqueueSafely = jest.fn().mockResolvedValue(undefined);
  const notifications = {
    enqueueSafely,
    clinicTime: jest.fn().mockResolvedValue('19 Nov 2026, 15:00'),
  };
  const patientDevices = {
    patientsWithDevices: jest.fn((_m, _o, ids: string[], _req: boolean) =>
      Promise.resolve(opts.reachable ?? ids),
    ),
  };
  const service = new AppointmentReminderService(
    { manager, transaction } as never,
    notifications as never,
    patientDevices as never,
    { now: () => NOW } as never,
    {
      register: (code: string, fn: typeof finalizer) => {
        expect(code).toBe(APPOINTMENT_REMINDER_EVENT);
        finalizer = fn;
      },
    } as never,
  );
  const flush = () => new Promise((r) => setImmediate(r));
  return {
    service,
    query,
    sqlLog,
    transaction,
    enqueueSafely,
    patientDevices,
    flush,
    finalize: (n: OutgoingNotification) => finalizer(n),
  };
}

describe('AppointmentReminderService.schedule', () => {
  it('schedules the push 24 h before the start from the CURRENT booking, clinic + time only', async () => {
    const s = setup();
    s.service.schedule(target());
    await s.flush();
    expect(s.enqueueSafely).toHaveBeenCalledTimes(1);
    const input = s.enqueueSafely.mock.calls[0][1] as Record<string, unknown>;
    expect(input).toMatchObject({
      eventCode: 'appointment.reminder',
      organizationId: 'org-1',
      locationId: 'loc-1',
      link: '/appointments/appt-1',
      entity: { type: 'appointment', id: 'appt-1' },
      variables: {
        appointment_time: '19 Nov 2026, 15:00',
        start_at: START.toISOString(),
        end_at: END.toISOString(),
      },
      recipients: [{ id: 'pat-1', type: 'patient', audience: 'patient' }],
    });
    expect((input.scheduledFor as Date).getTime()).toBe(START.getTime() - REMINDER_LEAD_MS);
    // A phone registered between booking and the reminder still gets it.
    expect(s.patientDevices.patientsWithDevices.mock.calls[0][3]).toBe(false);
  });

  it('skip + insert run in ONE transaction under a per-appointment advisory lock', async () => {
    const s = setup();
    s.service.schedule(target());
    await s.flush();
    expect(s.transaction).toHaveBeenCalledTimes(1);
    const sqls = s.sqlLog.map((l) => l.sql);
    expect(sqls[0]).toContain('pg_advisory_xact_lock(hashtext($1))');
    expect(s.sqlLog[0].params).toEqual(['appointment-reminder:appt-1']);
    expect(sqls[1]).toContain('UPDATE notification_outbox');
    expect(sqls[2]).toContain('FROM appointments');
    // the insert goes through the SAME manager
    expect(s.enqueueSafely.mock.calls[0][0]).toEqual({ query: s.query });
  });

  it('the skip filters on entity_type first (index-friendly) and only unsent rows', async () => {
    const s = setup();
    s.service.schedule(target());
    await s.flush();
    const { sql, params } = s.sqlLog[1];
    expect(sql).toContain("entity_type = 'appointment'");
    expect(sql).toContain("status IN ('queued', 'held_quiet_hours')");
    expect(params).toEqual(['appointment.reminder', 'appt-1']);
  });

  it('a booking that is no longer scheduled/confirmed only drops the old reminder', async () => {
    const s = setup({ row: booked({ status: 'cancelled' }) });
    s.service.schedule(target());
    await s.flush();
    expect(s.sqlLog[1].sql).toContain('UPDATE notification_outbox');
    expect(s.enqueueSafely).not.toHaveBeenCalled();
  });

  it('queues nothing when the appointment is less than a day away (the skip still ran)', async () => {
    const s = setup({ row: booked({ start_time: new Date(NOW.getTime() + 3_600_000) }) });
    s.service.schedule(target());
    await s.flush();
    expect(s.enqueueSafely).not.toHaveBeenCalled();
    expect(s.sqlLog[1].sql).toContain('UPDATE notification_outbox');
  });

  it('a patient change re-targets: the recipient is the CURRENT patient', async () => {
    const s = setup({ row: booked({ patient_id: 'pat-2' }) });
    s.service.schedule(target());
    await s.flush();
    expect(s.enqueueSafely.mock.calls[0][1]).toMatchObject({ recipients: [{ id: 'pat-2' }] });
  });

  it('a duration-only change gets the new end_at', async () => {
    const longer = new Date(START.getTime() + 60 * 60_000);
    const s = setup({ row: booked({ end_time: longer }) });
    s.service.schedule(target());
    await s.flush();
    expect(
      (s.enqueueSafely.mock.calls[0][1] as { variables: { end_at: string } }).variables.end_at,
    ).toBe(longer.toISOString());
  });

  it('queues nothing for a patient who does not use the app', async () => {
    const s = setup({ reachable: [] });
    s.service.schedule(target());
    await s.flush();
    expect(s.enqueueSafely).not.toHaveBeenCalled();
  });

  it('never throws into the booking when the transaction fails', async () => {
    const s = setup();
    s.transaction.mockRejectedValueOnce(new Error('db down'));
    expect(() => s.service.schedule(target())).not.toThrow();
    await s.flush();
  });
});

describe('AppointmentReminderService.cancel', () => {
  it('drops every pending reminder under the same lock', async () => {
    const s = setup();
    s.service.cancel('appt-1');
    await s.flush();
    expect(s.sqlLog[0].sql).toContain('pg_advisory_xact_lock');
    expect(s.sqlLog[1].params).toEqual(['appointment.reminder', 'appt-1']);
  });

  it('never throws', async () => {
    const s = setup();
    s.transaction.mockRejectedValueOnce(new Error('db down'));
    expect(() => s.service.cancel('appt-1')).not.toThrow();
    await s.flush();
  });
});

describe('AppointmentReminderService send-time check', () => {
  const reminder = (startAt = START.toISOString(), endAt = END.toISOString()): OutgoingNotification =>
    ({
      entityId: 'appt-1',
      recipientId: 'pat-1',
      payload: { variables: { start_at: startAt, end_at: endAt } },
    }) as never;

  it('lets a still-booked reminder through unchanged', async () => {
    const s = setup({ row: booked() });
    const n = reminder();
    await expect(s.finalize(n)).resolves.toBe(n.payload);
  });

  it.each([
    ['cancelled', booked({ status: 'cancelled' })],
    ['checked in already', booked({ status: 'checked_in' })],
    ['moved to another time', booked({ start_time: new Date(START.getTime() + 3_600_000) })],
    ['shortened or lengthened', booked({ end_time: new Date(END.getTime() + 600_000) })],
    ['reassigned to another patient', booked({ patient_id: 'pat-2' })],
    ['deleted', null],
  ])('drops a reminder for an appointment that was %s', async (_label, row) => {
    const s = setup({ row });
    const err = await s.finalize(reminder()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkipSendError);
    expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_DISABLED);
  });
});
