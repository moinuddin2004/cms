/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */
import { UnauthorizedException } from '@nestjs/common';
import { LoginCodeService, MAX_CODE_ATTEMPTS } from './login-code.service';
import { readPatientLimits } from './patient-config';
import type { PatientLoginCode } from './entities/patient-login-code.entity';

class FakeCodes {
  rows: PatientLoginCode[] = [];
  create(v: Partial<PatientLoginCode>) {
    return { ...v } as PatientLoginCode;
  }
  async save(v: PatientLoginCode) {
    const row = { ...v, id: `c${this.rows.length}`, createdAt: new Date() };
    this.rows.push(row as PatientLoginCode);
    return row;
  }
  async findOne({ where }: { where: { email: string } }) {
    const now = Date.now();
    const rows = this.rows
      .filter(
        (r) =>
          r.email === where.email && !r.usedAt && r.expiresAt.getTime() > now,
      )
      .reverse();
    return rows[0] ?? null;
  }
  async count({ where }: { where: { createdAt: { value: Date } } }) {
    return this.rows.filter((r) => r.createdAt > where.createdAt.value).length;
  }
  async sum(
    _col: string,
    where: { email: string; createdAt: { value: Date } },
  ) {
    const hit = this.rows.filter(
      (r) => r.email === where.email && r.createdAt > where.createdAt.value,
    );
    return hit.length ? hit.reduce((n, r) => n + r.attempts, 0) : null;
  }
  claimZero = false;
  createQueryBuilder() {
    let id = '';
    const qb = {
      update: () => qb,
      set: () => qb,
      where: (_s: string, p: { id: string; max: number }) => {
        id = p.id;
        return qb;
      },
      returning: () => qb,
      execute: async () => {
        const r = this.rows.find((x) => x.id === id);
        const now = Date.now();
        if (
          this.claimZero ||
          !r ||
          r.attempts >= 5 ||
          r.usedAt ||
          r.expiresAt.getTime() <= now
        )
          return { raw: [] };
        r.attempts += 1;
        return { raw: [{ id }] };
      },
    };
    return qb;
  }
  async update(
    where: { id?: string; email?: string },
    patch: Partial<PatientLoginCode>,
  ) {
    const hit = this.rows.filter(
      (x) =>
        !x.usedAt &&
        (where.id === undefined || x.id === where.id) &&
        (where.email === undefined || x.email === where.email),
    );
    hit.forEach((r) => Object.assign(r, patch));
    return { affected: hit.length };
  }
}

async function codeError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(UnauthorizedException);
    return (e as UnauthorizedException).getResponse()['code'] as string;
  }
  return 'OK';
}

describe('LoginCodeService', () => {
  let codes: FakeCodes;
  let mail: { sendLoginCode: jest.Mock };
  let svc: LoginCodeService;
  const sentCode = () => mail.sendLoginCode.mock.calls.at(-1)![1] as string;

  beforeEach(() => {
    codes = new FakeCodes();
    mail = { sendLoginCode: jest.fn().mockResolvedValue(true) };
    svc = new LoginCodeService(codes as never, mail as never, 'pepper');
  });
  afterEach(() => jest.useRealTimers());

  it('start: lower-cases the email, mails a 6-digit code and stores only its hash', async () => {
    await svc.start('  Alice@Example.COM ');
    expect(mail.sendLoginCode).toHaveBeenCalledWith(
      'alice@example.com',
      expect.stringMatching(/^\d{6}$/),
    );
    const row = codes.rows[0];
    expect(row.email).toBe('alice@example.com');
    expect(row.codeHash).toBe(svc.hash(sentCode()));
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeHash).not.toContain(sentCode());
    const mins = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(9.9);
    expect(mins).toBeLessThanOrEqual(10);
  });

  it('hash depends on the pepper', () => {
    const other = new LoginCodeService(codes as never, mail as never, 'other');
    expect(other.hash('123456')).not.toBe(svc.hash('123456'));
  });

  it('verify: right code works once, second use is CODE_INVALID', async () => {
    await svc.start('a@b.co');
    const code = sentCode();
    expect(await codeError(svc.verify('A@B.co', code))).toBe('OK');
    expect(await codeError(svc.verify('a@b.co', code))).toBe('CODE_INVALID');
  });

  it('verify: wrong code, unknown email and no code all give the same CODE_INVALID', async () => {
    await svc.start('a@b.co');
    expect(await codeError(svc.verify('a@b.co', '000000x'))).toBe(
      'CODE_INVALID',
    );
    expect(await codeError(svc.verify('nobody@b.co', '123456'))).toBe(
      'CODE_INVALID',
    );
  });

  it('verify: expired code is rejected', async () => {
    jest.useFakeTimers();
    await svc.start('a@b.co');
    const code = sentCode();
    jest.setSystemTime(Date.now() + 10 * 60_000 + 1000);
    expect(await codeError(svc.verify('a@b.co', code))).toBe('CODE_INVALID');
  });

  it(`verify: locks after ${MAX_CODE_ATTEMPTS} wrong attempts, even with the right code`, async () => {
    await svc.start('a@b.co');
    const code = sentCode();
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++)
      expect(await codeError(svc.verify('a@b.co', wrong))).toBe('CODE_INVALID');
    expect(codes.rows[0].attempts).toBe(MAX_CODE_ATTEMPTS);
    expect(await codeError(svc.verify('a@b.co', code))).toBe('CODE_INVALID');
  });

  it('verify: only the latest code of the email counts', async () => {
    await svc.start('a@b.co');
    const first = sentCode();
    await svc.start('a@b.co');
    const second = sentCode();
    if (first !== second)
      expect(await codeError(svc.verify('a@b.co', first))).toBe('CODE_INVALID');
    expect(await codeError(svc.verify('a@b.co', second))).toBe('OK');
  });

  it('verify: a lost attempt claim (update returns 0 rows) is CODE_INVALID, even with the right code', async () => {
    await svc.start('a@b.co');
    const code = sentCode();
    codes.claimZero = true;
    expect(await codeError(svc.verify('a@b.co', code))).toBe('CODE_INVALID');
    expect(codes.rows[0].usedAt).toBeNull();
  });

  it('start closes earlier open codes; success closes all open codes of the email', async () => {
    await svc.start('a@b.co');
    await svc.start('a@b.co');
    expect(codes.rows[0].usedAt).not.toBeNull();
    // simulate an older still-open code appearing
    codes.rows.unshift({
      ...codes.rows[0],
      id: 'old',
      usedAt: null,
      codeHash: svc.hash('999999'),
    } as PatientLoginCode);
    expect(await codeError(svc.verify('a@b.co', sentCode()))).toBe('OK');
    expect(codes.rows.every((r) => r.usedAt)).toBe(true);
    expect(await codeError(svc.verify('a@b.co', '999999'))).toBe(
      'CODE_INVALID',
    );
  });

  describe('abuse limits', () => {
    const limited = (env: Record<string, string>) =>
      new LoginCodeService(
        codes as never,
        mail as never,
        'pepper',
        readPatientLimits(env),
      );

    const oldFailures = (age: number, n: number) => {
      for (let i = 0; i < n; i++) {
        codes.rows.push({
          email: 'a@b.co',
          attempts: 5,
          createdAt: new Date(Date.now() - age),
          expiresAt: new Date(0),
          usedAt: new Date(),
        } as PatientLoginCode);
      }
    };

    it('M7: refuses further guesses for an email after >20 failures in 24 h, right code included', async () => {
      const s = limited({});
      await s.start('a@b.co');
      const code = sentCode();
      oldFailures(60_000, 5); // 25 failed attempts spread over earlier codes
      expect(await codeError(s.verify('a@b.co', code))).toBe('CODE_INVALID');
      expect(codes.rows[0].usedAt).toBeNull(); // refused before touching the code
      await s.start('c@d.co');
      expect(await codeError(s.verify('c@d.co', sentCode()))).toBe('OK'); // another email unaffected
    });

    it('M7: failures older than 24 h do not count', async () => {
      const s = limited({});
      await s.start('a@b.co');
      const code = sentCode();
      oldFailures(25 * 3600_000, 6);
      expect(await codeError(s.verify('a@b.co', code))).toBe('OK');
    });

    it('M8: the platform-wide hourly cap stops sending (no row, no email)', async () => {
      const s = limited({ PATIENT_LOGIN_CODES_PER_HOUR: '2' });
      await s.start('a@b.co', '1.1.1.1');
      await s.start('b@b.co', '1.1.1.2');
      await s.start('c@b.co', '1.1.1.3');
      expect(mail.sendLoginCode).toHaveBeenCalledTimes(2);
      expect(codes.rows).toHaveLength(2);
    });

    it('M8: the daily cap stops sending', async () => {
      const s = limited({ PATIENT_LOGIN_CODES_PER_DAY: '1' });
      await s.start('a@b.co');
      await s.start('b@b.co');
      expect(mail.sendLoginCode).toHaveBeenCalledTimes(1);
    });

    it('M8: one IP is limited per day, others are not', async () => {
      const s = limited({ PATIENT_LOGIN_CODES_PER_IP_PER_DAY: '2' });
      await s.start('a@b.co', '9.9.9.9');
      await s.start('b@b.co', '9.9.9.9');
      await s.start('c@b.co', '9.9.9.9');
      await s.start('d@b.co', '8.8.8.8');
      expect(
        (mail.sendLoginCode.mock.calls as string[][]).map((c) => c[0]),
      ).toEqual([
        'a@b.co',
        'b@b.co',
        'd@b.co',
      ]);
    });
  });
});
