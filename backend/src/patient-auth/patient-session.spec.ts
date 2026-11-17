/* eslint-disable @typescript-eslint/require-await */
import { UnauthorizedException } from '@nestjs/common';
import { PatientSessionService } from './patient-session.service';
import type { PatientSession } from './entities/patient-session.entity';

/** Minimal in-memory stand-in for the repository calls the service makes. */
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
  async update(
    crit: Partial<PatientSession> & { id: string },
    patch: Partial<PatientSession>,
  ) {
    const r = this.rows.get(crit.id);
    if (!r) return { affected: 0 };
    if (
      crit.refreshTokenHash !== undefined &&
      r.refreshTokenHash !== crit.refreshTokenHash
    )
      return { affected: 0 };
    Object.assign(r, patch);
    return { affected: 1 };
  }
  async count() {
    return 0;
  }
}

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

async function expectInvalid(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(UnauthorizedException);
  await p.catch((e: UnauthorizedException) =>
    expect((e.getResponse() as { code: string }).code).toBe('SESSION_INVALID'),
  );
}

describe('PatientSessionService', () => {
  let repo: FakeRepo;
  let svc: PatientSessionService;
  beforeEach(() => {
    repo = new FakeRepo();
    svc = new PatientSessionService(repo as never);
  });

  it('create stores only a sha256 hash and a 60-day expiry', async () => {
    const { session, refreshToken } = await svc.create(ACCOUNT, {
      ip: '1.2.3.4',
    });
    const [id, part] = refreshToken.split(':');
    expect(id).toBe(session.id);
    expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session.refreshTokenHash).not.toContain(part);
    const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(59.9);
    expect(days).toBeLessThanOrEqual(60);
  });

  it('rotates: new token works, the old hash moves to previous_token_hash', async () => {
    const first = await svc.create(ACCOUNT);
    const second = await svc.rotate(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.refreshToken.split(':')[0]).toBe(first.session.id);
    expect(repo.rows.get(first.session.id)!.previousTokenHash).toBe(
      first.session.refreshTokenHash,
    );
    const third = await svc.rotate(second.refreshToken);
    expect(third.refreshToken).not.toBe(second.refreshToken);
  });

  it('reuse of a rotated token revokes the whole session', async () => {
    const first = await svc.create(ACCOUNT);
    const second = await svc.rotate(first.refreshToken);
    await expectInvalid(svc.rotate(first.refreshToken)); // theft signal
    expect(repo.rows.get(first.session.id)!.revokedAt).toBeInstanceOf(Date);
    await expectInvalid(svc.rotate(second.refreshToken)); // even the newest is dead
  });

  it('rejects garbage, unknown ids, wrong secrets, expired and revoked sessions', async () => {
    await expectInvalid(svc.rotate(undefined));
    await expectInvalid(svc.rotate('nocolon'));
    await expectInvalid(svc.rotate('not-a-uuid:abc'));
    await expectInvalid(svc.rotate('33333333-3333-4333-8333-333333333333:abc'));
    const s = await svc.create(ACCOUNT);
    await expectInvalid(svc.rotate(`${s.session.id}:wrong-part`));

    repo.rows.get(s.session.id)!.expiresAt = new Date(Date.now() - 1000);
    await expectInvalid(svc.rotate(s.refreshToken));

    const r = await svc.create(ACCOUNT);
    await svc.revokeByToken(r.refreshToken);
    expect(repo.rows.get(r.session.id)!.revokedAt).toBeInstanceOf(Date);
    await expectInvalid(svc.rotate(r.refreshToken));
  });

  it('logout with a wrong secret does not revoke', async () => {
    const s = await svc.create(ACCOUNT);
    await svc.revokeByToken(`${s.session.id}:wrong`);
    expect(repo.rows.get(s.session.id)!.revokedAt).toBeNull();
  });

  it('M9: a logout nulls the IP and device label', async () => {
    const s = await svc.create(ACCOUNT, {
      ip: '1.2.3.4',
      deviceLabel: 'Pixel',
    });
    await svc.revokeByToken(s.refreshToken);
    const row = repo.rows.get(s.session.id)!;
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(row.ip).toBeNull();
    expect(row.deviceLabel).toBeNull();
  });

  it('M9: reuse detection also nulls IP and device label', async () => {
    const first = await svc.create(ACCOUNT, {
      ip: '1.2.3.4',
      deviceLabel: 'Pixel',
    });
    await svc.rotate(first.refreshToken);
    await expectInvalid(svc.rotate(first.refreshToken));
    const row = repo.rows.get(first.session.id)!;
    expect(row.ip).toBeNull();
    expect(row.deviceLabel).toBeNull();
  });

  it('L6: rotation never extends a session past 180 days from creation', async () => {
    const s = await svc.create(ACCOUNT);
    const row = repo.rows.get(s.session.id)!;
    row.createdAt = new Date(Date.now() - 170 * 86_400_000);
    const rotated = await svc.rotate(s.refreshToken);
    const days =
      (rotated.session.expiresAt.getTime() - row.createdAt.getTime()) /
      86_400_000;
    expect(days).toBeLessThanOrEqual(180.01);
    expect(days).toBeGreaterThan(179);
  });

  it('L6: a session past its absolute lifetime cannot be rotated', async () => {
    const s = await svc.create(ACCOUNT);
    repo.rows.get(s.session.id)!.createdAt = new Date(
      Date.now() - 181 * 86_400_000,
    );
    await expectInvalid(svc.rotate(s.refreshToken));
  });

  it('L5: losing the compare-and-swap to a holder of the same token revokes the session', async () => {
    const s = await svc.create(ACCOUNT, { ip: '1.2.3.4' });
    const row = repo.rows.get(s.session.id)!;
    const realUpdate = repo.update.bind(repo);
    let first = true;
    repo.update = async (crit: never, patch: never) => {
      if (first) {
        // someone else rotated between our read and our write
        first = false;
        row.previousTokenHash = row.refreshTokenHash;
        row.refreshTokenHash = 'f'.repeat(64);
        return { affected: 0 };
      }
      return realUpdate(crit, patch);
    };
    await expectInvalid(svc.rotate(s.refreshToken));
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(row.ip).toBeNull();
  });
});
