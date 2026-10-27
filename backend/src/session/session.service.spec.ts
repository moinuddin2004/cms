import { Repository } from 'typeorm';
import { Request } from 'express';
import { SessionService } from './session.service';
import { UserSession } from './entities/user-session.entity';
import {
  DAY_MS,
  REMEMBERED_SESSION_MS,
  SHORT_SESSION_MS,
} from './session-lifetime';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-refresh-token'),
}));

const req = {
  headers: { 'user-agent': 'jest-agent' },
  socket: { remoteAddress: '127.0.0.1' },
} as unknown as Request;

function makeService(overrides: Partial<Repository<UserSession>> = {}) {
  const repository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: Partial<UserSession>) => value),
    save: jest.fn((value: UserSession) => Promise.resolve(value)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  } as unknown as Repository<UserSession>;

  return { service: new SessionService(repository), repository };
}

/** Allows for the few milliseconds a test takes while creating the session. */
function expectCloseTo(actual: Date, expectedMs: number, now: number) {
  expect(actual.getTime() - now).toBeGreaterThanOrEqual(expectedMs - 1000);
  expect(actual.getTime() - now).toBeLessThanOrEqual(expectedMs + 1000);
}

describe('SessionService session lifetime', () => {
  it('creates a one-day session by default', async () => {
    const { service } = makeService();
    const before = Date.now();

    const { session } = await service.createSession('user-1', req);

    expectCloseTo(session.expiresAt, SHORT_SESSION_MS, before);
    expect(SHORT_SESSION_MS).toBe(DAY_MS);
  });

  it('creates a thirty-day session when remembered', async () => {
    const { service } = makeService();
    const before = Date.now();

    const { session } = await service.createSession('user-1', req, true);

    expectCloseTo(session.expiresAt, REMEMBERED_SESSION_MS, before);
  });

  it('rotates the token without moving the absolute expiry', async () => {
    const expiresAt = new Date(Date.now() + 10 * DAY_MS);
    const existing = {
      uuid: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'old-hash',
      expiresAt,
      isRevoked: false,
      lastActiveAt: new Date(0),
    } as UserSession;

    const { service } = makeService({
      findOne: jest.fn().mockResolvedValue(existing),
    } as unknown as Partial<Repository<UserSession>>);

    const rotated = await service.rotateRefreshToken('session-1');

    expect(rotated).not.toBeNull();
    expect(rotated?.session.expiresAt).toBe(expiresAt);
    expect(rotated?.session.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(rotated?.session.refreshTokenHash).not.toBe('old-hash');
    expect(rotated?.session.lastActiveAt.getTime()).toBeGreaterThan(0);
  });

  it('refuses to rotate an expired session', async () => {
    const { service } = makeService({
      findOne: jest.fn().mockResolvedValue({
        uuid: 'session-1',
        expiresAt: new Date(Date.now() - 1),
        isRevoked: false,
      }),
    } as unknown as Partial<Repository<UserSession>>);

    await expect(service.rotateRefreshToken('session-1')).resolves.toBeNull();
  });
});
