/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { randomUUID } from 'crypto';
import type { Response } from 'supertest';
import { localHHMM } from 'src/common/clock/tz.util';
import { EffectRegistry } from 'src/engine/runtime/effect-registry';
import type { EffectContext } from 'src/engine/runtime/effect-registry';
import { DevLogChannelProvider } from 'src/notifications/delivery/dev-log.provider';
import { PermanentSendError } from 'src/notifications/delivery/channel-provider';
import { NotificationDispatcher } from 'src/notifications/delivery/notification-dispatcher.service';
import { NotificationRecipientsRegistry } from 'src/notifications/effects/notification-recipients.registry';
import { NotificationOutbox } from 'src/notifications/entities/notification-outbox.entity';
import { UserNotification } from 'src/notifications/entities/user-notification.entity';
import {
  NotificationAudience as A,
  NotificationChannel as C,
  OutboxStatus as S,
  RecipientType as R,
} from 'src/notifications/notifications.enums';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { NotificationSeedService } from 'src/notifications/seeds/notification-seed.service';
import {
  EnqueueInput,
  NotificationService,
} from 'src/notifications/services/notification.service';
import { Patient } from 'src/patients/entities/patient.entity';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

/**
 * Notifications infrastructure (lab ERD §7, §16, §17): the decision order
 * against real settings rows, the outbox written in the caller's
 * transaction (and gone on rollback), the worker, the `notify` effect, and
 * the clinic-admin + in-app APIs.
 */
describe('Notifications integration', () => {
  let fx: LabsFixture;
  let notifications: NotificationService;
  let dispatcher: NotificationDispatcher;
  let devLog: DevLogChannelProvider;
  let patientA: string;
  let patientB: string;

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_notif_core', {
      imports: [NotificationsModule],
    });
    notifications = fx.app.get(NotificationService);
    dispatcher = fx.app.get(NotificationDispatcher);
    devLog = fx.app.get(DevLogChannelProvider);
    patientA = await newPatient(fx.clinicA.organizationId, 'Ali Khan');
    patientB = await newPatient(fx.clinicB.organizationId, 'Sara B');
    // Schema sync on the shared dev DB is slow while other suites run.
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  afterEach(() => jest.restoreAllMocks());

  async function newPatient(organizationId: string, fullName: string) {
    const p = await fx.dataSource.getRepository(Patient).save({
      organizationId,
      fullName,
      patientNumber: `P${randomUUID().slice(0, 8)}`,
      phone: `0300${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
    } as Partial<Patient>);
    return p.id;
  }

  const enqueue = (input: EnqueueInput) =>
    fx.dataSource.transaction((m) => notifications.enqueue(m, input));

  const outbox = (ids: string[]) =>
    fx.dataSource
      .getRepository(NotificationOutbox)
      .createQueryBuilder('o')
      .where('o.id IN (:...ids)', { ids })
      .getMany();

  const byChannel = (rows: { channel: C; status: S }[]) =>
    Object.fromEntries(rows.map((r) => [r.channel, r.status]));

  const settings = (
    method: 'get' | 'patch' | 'put' | 'delete',
    url: string,
    body?: object,
  ) =>
    fx.clinic(
      method,
      `/notification-settings${url}`,
      fx.clinicA,
      fx.clinicA.admin,
      body,
    );

  it('seeds the catalog and default templates once', async () => {
    expect(await fx.app.get(NotificationSeedService).seed()).toBe(0);
    const res = await settings('get', '');
    expect(res.status).toBe(200);
    const codes = res.body.data.events.map((e: { code: string }) => e.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'order.submitted',
        'item.ready',
        'payment.receipt',
      ]),
    );
    expect(fx.app.get(EffectRegistry).get('notify')).toBeDefined();
  });

  it('§19: patient notifications OFF → skipped_disabled rows and nothing is sent', async () => {
    const send = jest.spyOn(devLog, 'send');
    const rows = await enqueue({
      organizationId: fx.clinicA.organizationId,
      locationId: fx.clinicA.locationId,
      eventCode: 'item.ready',
      recipients: [{ audience: A.PATIENT, type: R.PATIENT, id: patientA }],
      variables: { order_no: 'LAB-0001', item_name: 'Crown' },
    });
    expect(byChannel(rows)).toEqual({
      [C.WHATSAPP]: S.SKIPPED_DISABLED,
      [C.SMS]: S.SKIPPED_DISABLED,
    });
    await dispatcher.drain();
    const saved = await outbox(rows.map((r) => r.id));
    expect(
      saved.every((o) => o.status === S.SKIPPED_DISABLED && o.attempts === 0),
    ).toBe(true);
    expect(saved[0].payload.reason).toBe('audience_disabled');
    // The log still shows what would have gone.
    expect(saved[0].payload.body).toContain('Ali Khan');
    expect(saved[0].payload.body).toContain('Crown');
    expect(send).not.toHaveBeenCalled();
  });

  it('internal defaults: in-app queued and delivered to the bell; external channels off', async () => {
    const rows = await enqueue({
      organizationId: fx.clinicA.organizationId,
      eventCode: 'order.accepted',
      recipients: [{ audience: A.DOCTOR, type: R.USER, id: fx.clinicA.doctor }],
      variables: {
        order_no: 'LAB-0002',
        lab_name: 'Precision',
        expected_on: '2026-10-25',
      },
      link: '/labs/orders/x',
      entity: { type: 'order', id: randomUUID() },
    });
    expect(byChannel(rows)).toEqual({
      [C.IN_APP]: S.QUEUED,
      [C.WHATSAPP]: S.SKIPPED_DISABLED,
      [C.EMAIL]: S.SKIPPED_DISABLED,
    });
    await dispatcher.drain();
    const inApp = rows.find((r) => r.channel === C.IN_APP)!;
    const [sent] = await outbox([inApp.id]);
    expect(sent.status).toBe(S.SENT);
    expect(sent.attempts).toBe(1);
    const copy = await fx.dataSource
      .getRepository(UserNotification)
      .findOneByOrFail({ outboxId: inApp.id });
    expect(copy).toMatchObject({
      userId: fx.clinicA.doctor,
      title: 'Order LAB-0002 accepted',
      link: '/labs/orders/x',
      readAt: null,
    });
  });

  it('1. mandatory internal in-app is sent even with the audience switched off', async () => {
    const off = await settings('patch', '/audiences/lab', { isEnabled: false });
    expect(off.status).toBe(200);
    const labUser = (await fx.newUser('lab-user')).id;
    const rows = await enqueue({
      organizationId: fx.clinicA.organizationId,
      eventCode: 'order.submitted',
      recipients: [{ audience: A.LAB, type: R.USER, id: labUser }],
      variables: { order_no: 'LAB-0003' },
    });
    expect(byChannel(rows)).toEqual({
      [C.IN_APP]: S.QUEUED,
      [C.WHATSAPP]: S.SKIPPED_DISABLED,
      [C.EMAIL]: S.SKIPPED_DISABLED,
    });
    expect(rows.find((r) => r.channel === C.IN_APP)!.reason).toBe(
      'mandatory_internal',
    );
    expect(rows.find((r) => r.channel === C.EMAIL)!.reason).toBe(
      'audience_disabled',
    );
    await settings('patch', '/audiences/lab', { isEnabled: true });
  });

  it('a mandatory in-app rule cannot be switched off', async () => {
    const res = await settings('put', '/rules', {
      rules: [
        {
          eventCode: 'order.submitted',
          audience: 'lab',
          channel: 'in_app',
          isEnabled: false,
        },
      ],
    });
    expect(res.status).toBe(422);
    expect(code(res)).toBe('NOTIFICATION_RULE_LOCKED');
  });

  it('3 + 4: enabled patient rules, opt-out, and the worker sends the rest', async () => {
    expect(
      (await settings('patch', '/audiences/patient', { isEnabled: true }))
        .status,
    ).toBe(200);
    const rules = await settings('put', '/rules', {
      rules: [
        {
          eventCode: 'payment.receipt',
          audience: 'patient',
          channel: 'whatsapp',
          isEnabled: true,
        },
        {
          eventCode: 'payment.receipt',
          audience: 'patient',
          channel: 'sms',
          isEnabled: true,
        },
      ],
    });
    expect(rules.body.data).toEqual({ changed: 2 });
    const prefs = await settings('put', `/patients/${patientA}/prefs`, {
      whatsappOptOut: true,
    });
    expect(prefs.status).toBe(200);
    expect(prefs.body.data.optedOutAt).not.toBeNull();

    const send = jest.spyOn(devLog, 'send');
    const rows = await enqueue({
      organizationId: fx.clinicA.organizationId,
      eventCode: 'payment.receipt',
      recipients: [{ audience: A.PATIENT, type: R.PATIENT, id: patientA }],
      variables: { receipt_no: 'RCP-0001', amount: 'Rs 5,000' },
    });
    expect(byChannel(rows)).toEqual({
      [C.WHATSAPP]: S.SKIPPED_OPT_OUT,
      [C.SMS]: S.QUEUED,
    });
    await dispatcher.drain();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].channel).toBe(C.SMS);
    const [sms] = await outbox([rows.find((r) => r.channel === C.SMS)!.id]);
    expect(sms.status).toBe(S.SENT);
    expect(sms.providerMessageId).toMatch(/^devlog-/);

    // Rule off again → 3. skipped_disabled
    await settings('put', '/rules', {
      rules: [
        {
          eventCode: 'payment.receipt',
          audience: 'patient',
          channel: 'sms',
          isEnabled: false,
        },
      ],
    });
    const again = await enqueue({
      organizationId: fx.clinicA.organizationId,
      eventCode: 'payment.receipt',
      recipients: [{ audience: A.PATIENT, type: R.PATIENT, id: patientA }],
    });
    expect(again.find((r) => r.channel === C.SMS)).toMatchObject({
      status: S.SKIPPED_DISABLED,
      reason: 'rule_disabled',
    });
    await settings('put', `/patients/${patientA}/prefs`, {
      whatsappOptOut: false,
    });
  });

  it('5. inside quiet hours → held until they end, and the worker leaves it alone', async () => {
    const now = new Date();
    const tz = 'Asia/Karachi';
    const start = localHHMM(tz, new Date(now.getTime() - 60 * 60_000));
    const end = localHHMM(tz, new Date(now.getTime() + 60 * 60_000));
    const res = await settings('patch', '/audiences/patient', {
      quietStart: start,
      quietEnd: end,
      timezone: tz,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quietStart: start, quietEnd: end });

    const send = jest.spyOn(devLog, 'send');
    const rows = await enqueue({
      organizationId: fx.clinicA.organizationId,
      eventCode: 'payment.receipt',
      recipients: [{ audience: A.PATIENT, type: R.PATIENT, id: patientA }],
    });
    const wa = rows.find((r) => r.channel === C.WHATSAPP)!;
    expect(wa.status).toBe(S.HELD_QUIET_HOURS);
    const lag = wa.scheduledFor.getTime() - now.getTime();
    expect(lag).toBeGreaterThan(55 * 60_000);
    expect(lag).toBeLessThanOrEqual(61 * 60_000);
    await dispatcher.drain();
    expect(send).not.toHaveBeenCalled();
    expect((await outbox([wa.id]))[0].status).toBe(S.HELD_QUIET_HOURS);

    // When the time comes the worker sends it.
    await fx.dataSource.query(
      `UPDATE notification_outbox SET scheduled_for = now() - interval '1 second' WHERE id = $1`,
      [wa.id],
    );
    await dispatcher.drain();
    expect((await outbox([wa.id]))[0].status).toBe(S.SENT);
    await settings('patch', '/audiences/patient', {
      quietStart: null,
      quietEnd: null,
    });
  });

  it('outbox rows roll back with the surrounding transaction', async () => {
    const marker = randomUUID();
    await expect(
      fx.dataSource.transaction(async (m) => {
        const rows = await notifications.enqueue(m, {
          organizationId: fx.clinicA.organizationId,
          eventCode: 'order.accepted',
          recipients: [
            { audience: A.DOCTOR, type: R.USER, id: fx.clinicA.doctor },
          ],
          entity: { type: 'order', id: marker },
        });
        expect(rows.length).toBe(3);
        const [{ n }] = await m.query(
          `SELECT count(*)::int AS n FROM notification_outbox WHERE entity_id = $1`,
          [marker],
        );
        expect(n).toBe(3);
        throw new Error('change failed');
      }),
    ).rejects.toThrow('change failed');
    const [{ n }] = await fx.dataSource.query(
      `SELECT count(*)::int AS n FROM notification_outbox WHERE entity_id = $1`,
      [marker],
    );
    expect(n).toBe(0);
  });

  it("never messages another clinic's patient", async () => {
    await expect(
      enqueue({
        organizationId: fx.clinicA.organizationId,
        eventCode: 'payment.receipt',
        recipients: [{ audience: A.PATIENT, type: R.PATIENT, id: patientB }],
      }),
    ).rejects.toMatchObject({ code: 'PATIENT_NOT_FOUND' });
    await expect(
      enqueue({
        organizationId: fx.clinicA.organizationId,
        eventCode: 'nope.nothing',
        recipients: [],
      }),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_EVENT_UNKNOWN' });
  });

  it('retries a failed send with backoff, and fails permanently on a PermanentSendError', async () => {
    await settings('put', '/rules', {
      rules: [
        {
          eventCode: 'order.accepted',
          audience: 'doctor',
          channel: 'email',
          isEnabled: true,
        },
      ],
    });
    const rows = await enqueue({
      organizationId: fx.clinicA.organizationId,
      eventCode: 'order.accepted',
      recipients: [{ audience: A.DOCTOR, type: R.USER, id: fx.clinicA.doctor }],
    });
    const email = rows.find((r) => r.channel === C.EMAIL)!;
    expect(email.status).toBe(S.QUEUED);

    jest.spyOn(devLog, 'send').mockRejectedValueOnce(new Error('SMTP timeout'));
    await dispatcher.drain();
    let [row] = await outbox([email.id]);
    expect(row).toMatchObject({
      status: S.QUEUED,
      attempts: 1,
      lastError: 'SMTP timeout',
    });
    expect(row.scheduledFor.getTime()).toBeGreaterThan(Date.now() + 20_000);

    await fx.dataSource.query(
      `UPDATE notification_outbox SET scheduled_for = now() WHERE id = $1`,
      [email.id],
    );
    jest
      .spyOn(devLog, 'send')
      .mockRejectedValueOnce(new PermanentSendError('Mailbox does not exist'));
    await dispatcher.drain();
    [row] = await outbox([email.id]);
    expect(row).toMatchObject({
      status: S.FAILED,
      attempts: 2,
      lastError: 'Mailbox does not exist',
    });
  });

  it('the notify effect enqueues in the transition transaction via the registered resolver', async () => {
    const effect = fx.app.get(EffectRegistry).get('notify')!;
    const entityId = randomUUID();
    fx.app
      .get(NotificationRecipientsRegistry)
      .override('it_notif_order', ({ eventCode }) =>
        Promise.resolve({
          recipients: [
            { audience: A.DOCTOR, type: R.USER, id: fx.clinicA.doctor },
            { audience: A.COORDINATOR, type: R.USER, id: fx.clinicA.admin },
          ],
          variables: { order_no: `N-${eventCode}` },
        }),
      );
    const ctx = (m: EffectContext['m'], params: Record<string, unknown>) =>
      ({
        m,
        actor: { userId: null, side: 'system', roles: [] },
        subject: {
          id: entityId,
          organizationId: fx.clinicA.organizationId,
          workflowVersionId: randomUUID(),
          state: 'accepted',
          version: 2,
        },
        adapter: {} as EffectContext['adapter'],
        transition: {} as EffectContext['transition'],
        request: { entityType: 'it_notif_order' } as EffectContext['request'],
        params,
      }) as EffectContext;

    await fx.dataSource.transaction((m) =>
      effect.run(ctx(m, { event: 'order.accepted', audiences: ['doctor'] })),
    );
    const rows = await fx.dataSource
      .getRepository(NotificationOutbox)
      .findBy({ entityId });
    expect(rows.map((r) => `${r.recipientId}:${r.channel}`).sort()).toEqual(
      [C.EMAIL, C.IN_APP, C.WHATSAPP]
        .map((c) => `${fx.clinicA.doctor}:${c}`)
        .sort(),
    );
    expect(rows[0]).toMatchObject({
      entityType: 'it_notif_order',
      eventCode: 'order.accepted',
    });

    await expect(
      fx.dataSource.transaction((m) =>
        effect.run(ctx(m, { event: 'order.nope' })),
      ),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_EVENT_UNKNOWN' });
    await expect(
      fx.dataSource.transaction((m) => effect.run(ctx(m, {}))),
    ).rejects.toMatchObject({ code: 'WORKFLOW_MISCONFIGURED' });
  });

  describe('settings API', () => {
    it('is clinic-admin only', async () => {
      const res = await fx.clinic(
        'get',
        '/notification-settings',
        fx.clinicA,
        fx.clinicA.doctor,
      );
      expect(res.status).toBe(403);
    });

    it('new clinics see patient OFF by default and locked mandatory rules', async () => {
      const res = await fx.clinic(
        'get',
        '/notification-settings',
        fx.clinicB,
        fx.clinicB.admin,
      );
      const patient = res.body.data.audiences.find(
        (a: { audience: string }) => a.audience === 'patient',
      );
      expect(patient).toMatchObject({ isEnabled: false, isDefault: true });
      const submitted = res.body.data.events.find(
        (e: { code: string }) => e.code === 'order.submitted',
      );
      expect(submitted.rules).toContainEqual(
        expect.objectContaining({
          audience: 'lab',
          channel: 'in_app',
          isEnabled: true,
          locked: true,
        }),
      );
      const ready = res.body.data.events.find(
        (e: { code: string }) => e.code === 'item.ready',
      );
      expect(
        ready.rules
          .filter((r: { audience: string }) => r.audience === 'patient')
          .every((r: { isEnabled: boolean }) => !r.isEnabled),
      ).toBe(true);
    });

    it('validates quiet hours', async () => {
      const half = await settings('patch', '/audiences/doctor', {
        quietStart: '22:00',
      });
      expect(half.status).toBe(422);
      expect(code(half)).toBe('NOTIFICATION_QUIET_HOURS_INVALID');
      const bad = await settings('patch', '/audiences/doctor', {
        quietStart: '25:00',
        quietEnd: '07:00',
      });
      expect(bad.status).toBe(400);
    });

    it('template overrides: validated, used by enqueue, and reset to default', async () => {
      const bad = await settings('put', '/templates', {
        eventCode: 'order.accepted',
        channel: 'in_app',
        language: 'en',
        subject: 'Hi {doctor_nickname}',
        body: 'x',
      });
      expect(bad.status).toBe(422);
      expect(code(bad)).toBe('NOTIFICATION_TEMPLATE_INVALID');

      const saved = await settings('put', '/templates', {
        eventCode: 'order.accepted',
        channel: 'in_app',
        language: 'en',
        subject: '{lab_name} ne {order_no} accept kar liya',
        body: 'Expected {expected_on}',
      });
      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject({
        isOverride: true,
        variables: ['lab_name', 'order_no', 'expected_on'],
      });

      const rows = await enqueue({
        organizationId: fx.clinicA.organizationId,
        eventCode: 'order.accepted',
        recipients: [
          { audience: A.DOCTOR, type: R.USER, id: fx.clinicA.doctor },
        ],
        variables: {
          lab_name: 'Precision',
          order_no: 'LAB-9',
          expected_on: 'Fri',
        },
      });
      const [inApp] = await outbox([
        rows.find((r) => r.channel === C.IN_APP)!.id,
      ]);
      expect(inApp.payload.title).toBe('Precision ne LAB-9 accept kar liya');

      const list = await settings('get', '/templates?eventCode=order.accepted');
      expect(
        list.body.data.filter((t: { isOverride: boolean }) => t.isOverride),
      ).toHaveLength(1);
      const reset = await settings(
        'delete',
        `/templates/${saved.body.data.id}`,
      );
      expect(reset.status).toBe(200);
      const after = await settings(
        'get',
        '/templates?eventCode=order.accepted',
      );
      expect(
        after.body.data.some((t: { isOverride: boolean }) => t.isOverride),
      ).toBe(false);
    });

    it("lists the clinic's message log with filters", async () => {
      const res = await settings('get', '/log?status=skipped_opt_out');
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.data.every(
          (r: { status: string }) => r.status === 'skipped_opt_out',
        ),
      ).toBe(true);
      const named = await settings('get', '/log?search=ali%20kh');
      expect(named.body.data.total).toBeGreaterThanOrEqual(1);
      expect(
        named.body.data.data.every(
          (r: { recipientName: string }) => r.recipientName === 'Ali Khan',
        ),
      ).toBe(true);
      const other = await fx.clinic(
        'get',
        '/notification-settings/log',
        fx.clinicB,
        fx.clinicB.admin,
      );
      expect(other.body.data.total).toBe(0);
    });
  });

  describe('my notifications API', () => {
    const me = (method: 'get' | 'post', url: string, as: string) =>
      fx.platform(method, `/me/notifications${url}`, as);

    it('lists, counts, and marks read — only the caller’s own', async () => {
      await dispatcher.drain();
      const doctor = fx.clinicA.doctor;
      const count = await me('get', '/unread-count', doctor);
      expect(count.status).toBe(200);
      expect(count.body.data.count).toBeGreaterThanOrEqual(1);

      const list = await me('get', '?unreadOnly=true&limit=5', doctor);
      expect(list.body.data.data.length).toBeGreaterThanOrEqual(1);
      const first = list.body.data.data[0];

      const stranger = (await fx.newUser('stranger')).id;
      expect((await me('post', `/${first.id}/read`, stranger)).status).toBe(
        404,
      );

      const read = await me('post', `/${first.id}/read`, doctor);
      expect(read.status).toBe(200);
      expect(read.body.data.readAt).not.toBeNull();
      const after = await me('get', '/unread-count', doctor);
      expect(after.body.data.count).toBe(count.body.data.count - 1);

      const all = await me('post', '/read-all', doctor);
      expect(all.status).toBe(200);
      expect((await me('get', '/unread-count', doctor)).body.data.count).toBe(
        0,
      );
    });
  });
});
