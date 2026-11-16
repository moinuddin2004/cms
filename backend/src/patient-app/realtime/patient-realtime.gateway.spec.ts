import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { PatientSessionService } from 'src/patient-auth/patient-session.service';
import { PatientTokenService } from 'src/patient-auth/patient-token.service';
import { QueueGateway } from 'src/queue/realtime/queue.gateway';
import { PatientQueueService } from '../queue/patient-queue.service';
import { PatientRealtimeGateway } from './patient-realtime.gateway';

const STAFF_SECRET = 'staff-secret-aaaaaaaaaaaaaaaaaaaaaaaa';
const PATIENT_SECRET = 'patient-secret-bbbbbbbbbbbbbbbbbbbbbbb';
const E1 = '11111111-1111-4111-8111-111111111111';
const E2 = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';

function fakeSocket(token?: string) {
  const rooms = new Set<string>();
  return {
    handshake: { auth: token ? { token } : {} },
    data: {} as Record<string, unknown>,
    rooms,
    join: jest.fn(async (r: string) => void rooms.add(r)),
    leave: jest.fn(async (r: string) => void rooms.delete(r)),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('socket auth — both directions', () => {
  const jwt = new JwtService({});
  const patientTokens = new PatientTokenService(jwt, PATIENT_SECRET);
  const sessions = { isAlive: jest.fn().mockResolvedValue(true) };
  const patientGateway = new PatientRealtimeGateway(
    patientTokens,
    sessions as unknown as PatientSessionService,
    {} as PatientQueueService,
  );
  const staffGateway = new QueueGateway(
    jwt,
    { get: () => STAFF_SECRET } as unknown as ConfigService,
    {} as AuthorizationService,
    {} as DataSource,
  );
  const staffToken = () =>
    jwt.signAsync(
      { sub: 'user-1' },
      { secret: STAFF_SECRET, audience: 'staff', expiresIn: '5m' },
    );

  beforeEach(() => sessions.isAlive.mockResolvedValue(true));

  it('patient token on /patient-realtime: joins patient:<account>', async () => {
    const s = fakeSocket(await patientTokens.sign('acct-1', 'sess-1'));
    await patientGateway.handleConnection(s as never);
    expect(s.join).toHaveBeenCalledWith('patient:acct-1');
    expect(s.disconnect).not.toHaveBeenCalled();
  });

  it('staff token on /patient-realtime: refused, no room', async () => {
    const s = fakeSocket(await staffToken());
    await patientGateway.handleConnection(s as never);
    expect(s.join).not.toHaveBeenCalled();
    expect(s.emit).toHaveBeenCalledWith('auth_error', expect.anything());
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('patient token on /realtime: refused, no user room', async () => {
    const s = fakeSocket(await patientTokens.sign('acct-1', 'sess-1'));
    await staffGateway.handleConnection(s as never);
    expect(s.join).not.toHaveBeenCalled();
    expect(s.emit).toHaveBeenCalledWith('auth_error', expect.anything());
  });

  it('staff token on /realtime still works', async () => {
    const s = fakeSocket(await staffToken());
    await staffGateway.handleConnection(s as never);
    expect(s.join).toHaveBeenCalledWith('user:user-1');
  });

  it('refuses no token, a revoked session and an unavailable instance', async () => {
    const none = fakeSocket();
    await patientGateway.handleConnection(none as never);
    expect(none.disconnect).toHaveBeenCalled();

    sessions.isAlive.mockResolvedValue(false);
    const revoked = fakeSocket(await patientTokens.sign('acct-1', 'sess-1'));
    await patientGateway.handleConnection(revoked as never);
    expect(revoked.join).not.toHaveBeenCalled();

    sessions.isAlive.mockResolvedValue(true);
    patientGateway.setAvailable(false);
    const down = fakeSocket(await patientTokens.sign('acct-1', 'sess-1'));
    await patientGateway.handleConnection(down as never);
    expect(down.join).not.toHaveBeenCalled();
    patientGateway.setAvailable(true);
  });
});

describe('PatientRealtimeGateway — rooms and fan-out', () => {
  let queue: { subscribableSession: jest.Mock };
  let gateway: PatientRealtimeGateway;
  let emitted: { room: string; event: string; payload: unknown }[];
  let roomSizes: Map<string, Set<string>>;
  let remoteSockets: ReturnType<typeof fakeSocket>[];

  beforeEach(() => {
    queue = { subscribableSession: jest.fn() };
    gateway = new PatientRealtimeGateway(
      {} as PatientTokenService,
      {} as PatientSessionService,
      queue as unknown as PatientQueueService,
    );
    emitted = [];
    roomSizes = new Map();
    remoteSockets = [];
    (gateway as unknown as { server: unknown }).server = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) =>
          emitted.push({ room, event, payload }),
      }),
      in: () => ({ fetchSockets: async () => remoteSockets }),
      adapter: { rooms: roomSizes },
    };
  });

  const authed = (accountId = 'acct-1') => {
    const s = fakeSocket();
    s.data.accountId = accountId;
    return s;
  };

  it('subscribes only to entries of the accounts live links', async () => {
    queue.subscribableSession.mockResolvedValueOnce(SESSION);
    const s = authed();
    expect(
      await gateway.subscribe(s as never, { room: `entry:${E1}` }),
    ).toEqual({ ok: true, room: `entry:${E1}` });
    expect(queue.subscribableSession).toHaveBeenCalledWith('acct-1', E1);
    expect(s.rooms.has(`entry:${E1}`)).toBe(true);

    queue.subscribableSession.mockResolvedValueOnce(null);
    expect(
      await gateway.subscribe(s as never, { room: `entry:${E2}` }),
    ).toEqual({ ok: false, room: `entry:${E2}`, error: 'NOT_FOUND' });
    expect(s.rooms.has(`entry:${E2}`)).toBe(false);
  });

  it('refuses other room shapes (patient:, session:, staff rooms) and unauthenticated sockets', async () => {
    const s = authed();
    for (const room of [
      'patient:acct-2',
      `session:${SESSION}`,
      `org:${E1}`,
      'entry:x',
      '',
    ]) {
      const r = await gateway.subscribe(s as never, { room });
      expect(r).toMatchObject({ ok: false, error: 'NOT_FOUND' });
    }
    const anon = fakeSocket();
    expect(
      await gateway.subscribe(anon as never, { room: `entry:${E1}` }),
    ).toMatchObject({ ok: false });
    expect(queue.subscribableSession).not.toHaveBeenCalled();
    expect(s.join).not.toHaveBeenCalled();
  });

  it('turns a session queue.event into visit.event for subscribed entries only', async () => {
    queue.subscribableSession.mockResolvedValue(SESSION);
    await gateway.subscribe(authed() as never, { room: `entry:${E1}` });
    roomSizes.set(`entry:${E1}`, new Set(['sock']));

    gateway.publish(`session:${SESSION}`, {
      type: 'queue.event',
      seq: 7,
      entryId: E2,
      sessionId: SESSION,
    });
    expect(emitted).toEqual([
      {
        room: `entry:${E1}`,
        event: 'visit.event',
        payload: { entryId: E1, seq: 7 },
      },
    ]);

    // other sessions, boards, displays and non-queue events produce nothing
    emitted.length = 0;
    gateway.publish('session:other', { type: 'queue.event', seq: 1 });
    gateway.publish(`location:${E1}:board`, { type: 'queue.event', seq: 1 });
    gateway.publish(`location:${E1}:display`, {
      type: 'display.event',
      seq: 1,
    });
    gateway.publish(`user:${E1}`, { type: 'notification.new' });
    expect(emitted).toEqual([]);
  });

  it('visit.event payload is minimal (no names, no other entries)', async () => {
    queue.subscribableSession.mockResolvedValue(SESSION);
    await gateway.subscribe(authed() as never, { room: `entry:${E1}` });
    roomSizes.set(`entry:${E1}`, new Set(['sock']));
    gateway.publish(`session:${SESSION}`, {
      type: 'queue.event',
      seq: 3,
      entryId: E2,
      fromStatus: 'waiting',
      toStatus: 'called',
      sessionId: SESSION,
    });
    expect(Object.keys(emitted[0].payload as object).sort()).toEqual([
      'entryId',
      'seq',
    ]);
  });

  it('forgets entries nobody listens to any more', async () => {
    queue.subscribableSession.mockResolvedValue(SESSION);
    await gateway.subscribe(authed() as never, { room: `entry:${E1}` });
    gateway.publish(`session:${SESSION}`, { type: 'queue.event', seq: 1 });
    expect(emitted).toEqual([]);
    roomSizes.set(`entry:${E1}`, new Set(['sock']));
    gateway.publish(`session:${SESSION}`, { type: 'queue.event', seq: 2 });
    expect(emitted).toEqual([]); // already dropped from the map
  });

  it('delivers patient:<account> feed events to that room only', () => {
    gateway.publish('patient:acct-1', {
      type: 'feed.changed',
      kinds: ['medications'],
    });
    expect(emitted).toEqual([
      {
        room: 'patient:acct-1',
        event: 'feed.changed',
        payload: { type: 'feed.changed', kinds: ['medications'] },
      },
    ]);
  });

  it('a links change makes the sockets leave entries that are no longer linked', async () => {
    const s = authed();
    s.rooms.add('patient:acct-1');
    s.rooms.add(`entry:${E1}`);
    s.rooms.add(`entry:${E2}`);
    remoteSockets = [s];
    queue.subscribableSession.mockImplementation(
      async (_a: string, e: string) => (e === E1 ? SESSION : null),
    );
    await gateway.revalidate('acct-1');
    expect(s.leave).toHaveBeenCalledWith(`entry:${E2}`);
    expect(s.leave).not.toHaveBeenCalledWith(`entry:${E1}`);
  });

  it('feed.changed with kinds links triggers the re-check', () => {
    const spy = jest.spyOn(gateway, 'revalidate').mockResolvedValue();
    gateway.publish('patient:acct-1', {
      type: 'feed.changed',
      kinds: ['links'],
    });
    expect(spy).toHaveBeenCalledWith('acct-1');
  });
});
