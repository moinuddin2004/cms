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

const target = (startTime = START) => ({
  id: 'appt-1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  patientId: 'pat-1',
  startTime,
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
    { manager: { query } } as never,
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
  return { service, notify, notifications, patientDevices, finalize: (n: OutgoingNotification) => finalizer(n) };
}

/** What `notify` was asked to enqueue (the factory is run by the fake). */
async function enqueued(s: ReturnType<typeof setup>, startTime = START) {
  let captured: unknown;
  s.notify.mockImplementation(async (input: unknown) => {
    captured = typeof input === 'function' ? await (input as () => Promise<unknown>)() : input;
  });
  s.service.schedule(target(startTime));
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
      },
      recipients: [{ id: 'pat-1', type: 'patient', audience: 'patient' }],
    });
    expect((input!.scheduledFor as Date).getTime()).toBe(
      START.getTime() - REMINDER_LEAD_MS,
    );
    // A phone registered between booking and the reminder still gets it.
    expect(s.patientDevices.patientsWithDevices.mock.calls[0][3]).toBe(false);
  });

  it('queues nothing when the appointment is less than a day away', async () => {
    const s = setup();
    s.service.schedule(target(new Date(NOW.getTime() + 60 * 60_000)));
    expect(s.notify).not.toHaveBeenCalled();
  });

  it('queues nothing for a patient who does not use the app', async () => {
    const s = setup({ reachable: [] });
    expect(await enqueued(s)).toBeNull();
  });
});

describe('AppointmentReminderService send-time check', () => {
  const reminder = (startAt = START.toISOString()): OutgoingNotification =>
    ({
      entityId: 'appt-1',
      payload: { variables: { start_at: startAt } },
    }) as never;

  it('lets a still-booked reminder through unchanged', async () => {
    const s = setup({ row: { status: 'confirmed', start_time: START } });
    const n = reminder();
    await expect(s.finalize(n)).resolves.toBe(n.payload);
  });

  it.each([
    ['cancelled', { status: 'cancelled', start_time: START }],
    ['checked in already', { status: 'checked_in', start_time: START }],
    ['moved to another time', { status: 'scheduled', start_time: new Date(START.getTime() + 3_600_000) }],
    ['deleted', null],
  ])('drops a reminder for an appointment that was %s', async (_label, row) => {
    const s = setup({ row });
    const err = await s.finalize(reminder()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SkipSendError);
    expect((err as SkipSendError).status).toBe(OutboxStatus.SKIPPED_DISABLED);
  });
});
