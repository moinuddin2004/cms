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

const target = (startTime = START, patientId = 'pat-1', minutes = 30) => ({
  id: 'appt-1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  patientId,
  startTime,
  endTime: new Date(startTime.getTime() + minutes * 60_000),
});

function setup(opts: { reachable?: string[]; row?: Record<string, unknown> | null } = {}) {
  let finalizer: (n: OutgoingNotification) => Promise<unknown> = () =>
    Promise.reject(new Error('no finalizer'));
  const notify = jest.fn(async (input: unknown) => {
    if (typeof input === 'function') await (input as () => Promise<unknown>)();
  });
  const notifications = {
    notify,
    clinicTime: jest.fn().mockResolvedValue('19 Nov 2026, 15:00'),
  };
  const patientDevices = {
    patientsWithDevices: jest.fn((_m, _o, ids: string[], _req: boolean) =>
      Promise.resolve(opts.reachable ?? ids),
    ),
  };
  const query = jest
    .fn()
    .mockResolvedValue(opts.row === undefined ? [] : opts.row ? [opts.row] : []);
  const service = new AppointmentReminderService(
    { manager: { query }, query } as never,
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
  return { service, query, notify, notifications, patientDevices, finalize: (n: OutgoingNotification) => finalizer(n) };
}

/** What `notify` was asked to enqueue (the factory is run by the fake). */
async function enqueued(s: ReturnType<typeof setup>, startTime = START, patientId = 'pat-1') {
  let captured: unknown;
  s.notify.mockImplementation(async (input: unknown) => {
    captured = typeof input === 'function' ? await (input as () => Promise<unknown>)() : input;
  });
  s.service.schedule(target(startTime, patientId));
  await new Promise((r) => setImmediate(r));
  return captured as Record<string, unknown> | null;
}

describe('AppointmentReminderService.schedule', () => {
  it('schedules the push 24 h before the start, clinic name + time only', async () => {
    const s = setup();
    const input = await enqueued(s);
    expect(input).toMatchObject({
      eventCode: 'appointment.reminder',
      organizationId: 'org-1',
      locationId: 'loc-1',
      link: '/appointments/appt-1',
      entity: { type: 'appointment', id: 'appt-1' },
      variables: {
        appointment_time: '19 Nov 2026, 15:00',
        start_at: START.toISOString(),
        end_at: new Date(START.getTime() + 30 * 60_000).toISOString(),
      },
      recipients: [{ id: 'pat-1', type: 'patient', audience: 'patient' }],
    });
    expect((input!.scheduledFor as Date).getTime()).toBe(
      START.getTime() - REMINDER_LEAD_MS,
    );
    // A phone registered between booking and the reminder still gets it.
    expect(s.patientDevices.patientsWithDevices.mock.calls[0][3]).toBe(false);
  });

  it('drops the pending reminders first, then queues a fresh one', async () => {
    const s = setup();
    await enqueued(s);
    const [sql, params] = s.query.mock.calls[0];
    expect(String(sql)).toContain('UPDATE notification_outbox');
    expect(String(sql)).toContain("status IN ('queued', 'held_quiet_hours')");
    expect(params).toEqual(['appointment.reminder', 'appt-1']);
  });

  it('a move to under a day away drops the old reminder and queues no new one', async () => {
    const s = setup();
    const input = await enqueued(s, new Date(NOW.getTime() + 60 * 60_000));
    expect(input).toBeNull();
    expect(s.query).toHaveBeenCalledTimes(1); // the skip still ran
  });

  it('a change of patient re-targets: new recipient, old row dropped', async () => {
    const s = setup();
    const input = await enqueued(s, START, 'pat-2');
    expect(input).toMatchObject({ recipients: [{ id: 'pat-2' }] });
    expect(s.query).toHaveBeenCalledTimes(1);
  });

  it('a duration-only change gets a new end_at', async () => {
    const s = setup();
    let captured: unknown;
    s.notify.mockImplementation(async (i: unknown) => {
      captured = await (i as () => Promise<unknown>)();
    });
    s.service.schedule(target(START, 'pat-1', 60));
    await new Promise((r) => setImmediate(r));
    expect((captured as { variables: { end_at: string } }).variables.end_at).toBe(
      new Date(START.getTime() + 60 * 60_000).toISOString(),
    );
  });

  it('cancel drops every pending reminder and never throws', async () => {
    const s = setup();
    s.query.mockRejectedValueOnce(new Error('db down'));
    s.service.cancel('appt-1');
    await new Promise((r) => setImmediate(r));
    expect(s.query.mock.calls[0][1]).toEqual(['appointment.reminder', 'appt-1']);
  });

  it('queues nothing for a patient who does not use the app', async () => {
    const s = setup({ reachable: [] });
    expect(await enqueued(s)).toBeNull();
  });
});

describe('AppointmentReminderService send-time check', () => {
  const END = new Date(START.getTime() + 30 * 60_000);
  const reminder = (startAt = START.toISOString(), endAt = END.toISOString()): OutgoingNotification =>
    ({
      entityId: 'appt-1',
      recipientId: 'pat-1',
      payload: { variables: { start_at: startAt, end_at: endAt } },
    }) as never;
  const booked = (over: Record<string, unknown> = {}) => ({
    status: 'confirmed',
    start_time: START,
    end_time: END,
    patient_id: 'pat-1',
    ...over,
  });

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

describe('move back to the original time', () => {
  it('cannot revive the old row: a reminder made for a time the booking left is dropped even if the time returned with another patient', async () => {
    const s = setup({ row: { status: 'scheduled', start_time: START, end_time: new Date(START.getTime() + 30 * 60_000), patient_id: 'pat-2' } });
    const n = { entityId: 'appt-1', recipientId: 'pat-1', payload: { variables: { start_at: START.toISOString(), end_at: new Date(START.getTime() + 30 * 60_000).toISOString() } } } as never;
    await expect(s.finalize(n)).rejects.toBeInstanceOf(SkipSendError);
  });
});
