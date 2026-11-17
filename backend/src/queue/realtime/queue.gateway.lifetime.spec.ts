import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StaffSessionEvents } from 'src/session/session-events';
import { QueueGateway } from './queue.gateway';

/** Audit M6: the staff socket follows the session — handshake, expiry, subscribe, revoke, access change. */
const SECRET = 'staff-secret-aaaaaaaaaaaaaaaaaaaaaaaa';
const ORG = '11111111-1111-4111-8111-111111111111';
const LOC = '22222222-2222-4222-8222-222222222222';

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

function setup(alive = true) {
  const jwt = new JwtService({});
  const query = jest.fn(() => Promise.resolve(alive ? [{}] : []));
  const authorization = {
    canAccessOrganization: jest.fn().mockResolvedValue(true),
    validateAccess: jest.fn().mockResolvedValue(true),
  };
  const events = new StaffSessionEvents();
  const gateway = new QueueGateway(
    jwt,
    { get: () => SECRET } as unknown as ConfigService,
    authorization as never,
    {
      query,
      getRepository: () => ({
        findOne: jest.fn().mockResolvedValue({ id: 's', locationId: LOC }),
      }),
    } as never,
    undefined,
    events,
  );
  const sign = (expiresIn: string | number = '5m') =>
    jwt.signAsync(
      { sub: 'user-1', sessionId: 'sess-1' },
      { secret: SECRET, audience: 'staff', expiresIn },
    );
  return { gateway, query, authorization, events, sign, jwt };
}

afterEach(() => jest.useRealTimers());

describe('staff realtime gateway lifetime', () => {
  it('a live session joins its user room and gets an expiry timer', async () => {
    const t = setup(true);
    const s = fakeSocket(await t.sign());
    await t.gateway.handleConnection(s as never);
    expect(s.join).toHaveBeenCalledWith('user:user-1');
    expect(s.data.sessionId).toBe('sess-1');
    expect(s.data.expiryTimer).toBeDefined();
    t.gateway.handleDisconnect(s as never);
  });

  it('a revoked session / deactivated user is refused AND disconnected at the handshake', async () => {
    const t = setup(false);
    const s = fakeSocket(await t.sign());
    await t.gateway.handleConnection(s as never);
    expect(s.join).not.toHaveBeenCalled();
    expect(s.emit).toHaveBeenCalledWith('auth_error', expect.anything());
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('a bad token is disconnected (it used to stay connected as an anonymous socket)', async () => {
    const t = setup();
    const s = fakeSocket('garbage');
    await t.gateway.handleConnection(s as never);
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('an anonymous display socket is untouched', async () => {
    const t = setup();
    const s = fakeSocket();
    await t.gateway.handleConnection(s as never);
    expect(s.disconnect).not.toHaveBeenCalled();
    const ack = await t.gateway.subscribe(s as never, { room: `location:${LOC}:display` });
    expect(ack).toMatchObject({ ok: true });
  });

  it('the socket closes when the access token expires', async () => {
    const t = setup();
    const token = await t.sign('60s'); // signed with real timers, exp 60 s ahead
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const s = fakeSocket(token);
    await t.gateway.handleConnection(s as never);
    expect(s.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(61_000);
    expect(s.emit).toHaveBeenCalledWith('auth_error', { message: 'Token expired' });
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('subscribe re-checks the session and drops a socket whose session ended', async () => {
    const t = setup(true);
    const s = fakeSocket(await t.sign());
    await t.gateway.handleConnection(s as never);
    t.query.mockResolvedValue([]); // revoked meanwhile
    const ack = await t.gateway.subscribe(s as never, { room: `org:${ORG}` });
    expect(ack).toMatchObject({ ok: false });
    expect(s.disconnect).toHaveBeenCalledWith(true);
    expect(s.join).not.toHaveBeenCalledWith(`org:${ORG}`);
  });

  it('logout / revoke of one session disconnects only its sockets', async () => {
    const t = setup();
    const mine = fakeSocket();
    mine.data.sessionId = 'sess-1';
    const other = fakeSocket();
    other.data.sessionId = 'sess-2';
    (t.gateway as unknown as { server: unknown }).server = {
      sockets: new Map([
        ['a', mine],
        ['b', other],
      ]),
    };
    t.gateway.onModuleInit();
    t.events.revoked({ sessionId: 'sess-1' });
    await new Promise((r) => setImmediate(r));
    expect(mine.disconnect).toHaveBeenCalledWith(true);
    expect(other.disconnect).not.toHaveBeenCalled();
  });

  it('revoke-all drops the user\'s sockets except the caller\'s session', async () => {
    const t = setup();
    const keep = fakeSocket();
    keep.data.sessionId = 'keep';
    const drop = fakeSocket();
    drop.data.sessionId = 'drop';
    (t.gateway as unknown as { server: unknown }).server = {
      in: () => ({ fetchSockets: () => Promise.resolve([keep, drop]) }),
    };
    t.gateway.onModuleInit();
    t.events.revoked({ userId: 'user-1', exceptSessionId: 'keep' });
    await new Promise((r) => setImmediate(r));
    expect(drop.disconnect).toHaveBeenCalledWith(true);
    expect(keep.disconnect).not.toHaveBeenCalled();
  });

  it('access.changed: drops sockets that lost the org, trims rooms they lost, keeps the rest', async () => {
    const t = setup();
    const gone = fakeSocket();
    gone.data.userId = 'u-gone';
    const trimmed = fakeSocket();
    trimmed.data.userId = 'u-trim';
    trimmed.rooms.add(`location:${LOC}:board`);
    trimmed.rooms.add(`org:${ORG}`);
    t.authorization.canAccessOrganization.mockImplementation((u: string) =>
      Promise.resolve(u !== 'u-gone'),
    );
    t.authorization.validateAccess.mockResolvedValue(false);
    (t.gateway as unknown as { server: unknown }).server = {
      in: () => ({ fetchSockets: () => Promise.resolve([gone, trimmed]) }),
    };
    await (
      t.gateway as unknown as { revalidateOrg: (o: string) => Promise<void> }
    ).revalidateOrg(ORG);
    expect(gone.disconnect).toHaveBeenCalledWith(true);
    expect(trimmed.disconnect).not.toHaveBeenCalled();
    expect(trimmed.leave).toHaveBeenCalledWith(`location:${LOC}:board`);
    expect(trimmed.leave).not.toHaveBeenCalledWith(`org:${ORG}`);
  });
});
