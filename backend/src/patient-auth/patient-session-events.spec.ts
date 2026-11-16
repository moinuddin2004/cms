/* eslint-disable @typescript-eslint/require-await */
import { PatientSessionEvents } from './patient-session-events';
import { PatientSessionService } from './patient-session.service';
import type { PatientSession } from './entities/patient-session.entity';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

class FakeRepo {
  rows = new Map<string, PatientSession>();
  create(v: Partial<PatientSession>) {
    return { ...v } as PatientSession;
  }
  async save(v: PatientSession) {
    this.rows.set(v.id, { ...v });
    return v;
  }
  async findOne({ where }: { where: { id: string } }) {
    const r = this.rows.get(where.id);
    return r ? { ...r } : null;
  }
  async update(crit: { id: string }, patch: Partial<PatientSession>) {
    const r = this.rows.get(crit.id);
    if (!r) return { affected: 0 };
    Object.assign(r, patch);
    return { affected: 1 };
  }
}

describe('patient session revocation events', () => {
  let svc: PatientSessionService;
  let events: PatientSessionEvents;
  let seen: { accountId: string; sessionId?: string }[];

  beforeEach(() => {
    events = new PatientSessionEvents();
    seen = [];
    events.onRevoked((e) => seen.push(e));
    svc = new PatientSessionService(new FakeRepo() as never, events);
  });

  it('logout announces the revoked session', async () => {
    const { session, refreshToken } = await svc.create(ACCOUNT);
    await svc.revokeByToken(refreshToken);
    expect(seen).toEqual([{ accountId: ACCOUNT, sessionId: session.id }]);
  });

  it('a wrong token revokes nothing and announces nothing', async () => {
    const { session } = await svc.create(ACCOUNT);
    await svc.revokeByToken(`${session.id}:wrong`);
    expect(seen).toEqual([]);
  });

  it('reuse of a rotated token (theft signal) announces the revoked session', async () => {
    const first = await svc.create(ACCOUNT);
    await svc.rotate(first.refreshToken);
    await expect(svc.rotate(first.refreshToken)).rejects.toBeDefined();
    expect(seen).toEqual([{ accountId: ACCOUNT, sessionId: first.session.id }]);
  });

  it('a throwing listener never breaks the revocation', async () => {
    events.onRevoked(() => {
      throw new Error('boom');
    });
    const { refreshToken } = await svc.create(ACCOUNT);
    await expect(svc.revokeByToken(refreshToken)).resolves.toBeUndefined();
  });
});
