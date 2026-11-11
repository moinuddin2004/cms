import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { sign } from 'jsonwebtoken';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import {
  assertPatientSecret,
  PATIENT_AUDIENCE,
  resolveCodePepper,
} from './patient-config';
import { PatientTokenService } from './patient-token.service';
import { PatientJwtStrategy } from './strategies/patient-jwt.strategy';

const PATIENT_SECRET = 'patient-secret-for-tests';
const STAFF_SECRET = 'staff-secret-for-tests';
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

const config = (env: Record<string, string | undefined>) => ({
  get: (k: string) => env[k],
});

describe('patient secret boot check', () => {
  it('throws when the patient secret is missing', () => {
    expect(() =>
      assertPatientSecret(config({ JWT_ACCESS_SECRET: STAFF_SECRET })),
    ).toThrow(/JWT_PATIENT_ACCESS_SECRET is required/);
    expect(() =>
      assertPatientSecret(
        config({
          JWT_ACCESS_SECRET: STAFF_SECRET,
          JWT_PATIENT_ACCESS_SECRET: '  ',
        }),
      ),
    ).toThrow(/required/);
  });

  it('throws when it equals the staff secret', () => {
    expect(() =>
      assertPatientSecret(
        config({
          JWT_ACCESS_SECRET: STAFF_SECRET,
          JWT_PATIENT_ACCESS_SECRET: STAFF_SECRET,
        }),
      ),
    ).toThrow(/must differ/);
  });

  it('returns a distinct secret and derives the pepper from it', () => {
    const c = config({
      JWT_ACCESS_SECRET: STAFF_SECRET,
      JWT_PATIENT_ACCESS_SECRET: PATIENT_SECRET,
    });
    expect(assertPatientSecret(c)).toBe(PATIENT_SECRET);
    expect(resolveCodePepper(c, PATIENT_SECRET)).toMatch(/^[0-9a-f]{64}$/);
    expect(
      resolveCodePepper(config({ PATIENT_CODE_PEPPER: 'pep' }), PATIENT_SECRET),
    ).toBe('pep');
  });
});

describe('PatientTokenService', () => {
  const svc = new PatientTokenService(new JwtService({}), PATIENT_SECRET);

  it('signs aud=patient with sub/sid and 15 min expiry', async () => {
    const payload = (await svc.verify(await svc.sign(ACCOUNT, SESSION))) as {
      sub: string;
      sid: string;
      aud: string;
      iat: number;
      exp: number;
    };
    expect(payload.sub).toBe(ACCOUNT);
    expect(payload.sid).toBe(SESSION);
    expect(payload.aud).toBe(PATIENT_AUDIENCE);
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = sign({ sub: ACCOUNT, sid: SESSION }, STAFF_SECRET, {
      audience: 'patient',
    });
    await expect(svc.verify(forged)).rejects.toThrow();
  });

  it('rejects a wrong audience and an expired token', async () => {
    const staffAud = sign({ sub: ACCOUNT, sid: SESSION }, PATIENT_SECRET, {
      audience: 'staff',
    });
    await expect(svc.verify(staffAud)).rejects.toThrow();
    const expired = sign({ sub: ACCOUNT, sid: SESSION }, PATIENT_SECRET, {
      audience: 'patient',
      expiresIn: -10,
    });
    await expect(svc.verify(expired)).rejects.toThrow();
  });
});

/** Run a real passport-jwt strategy against a bearer token and report the outcome. */
function authenticate(
  strategy: object,
  token: string,
): Promise<'success' | 'fail' | 'error'> {
  return new Promise((resolve) => {
    const s = strategy as Record<string, unknown> & {
      authenticate: (req: unknown) => void;
    };
    s.success = () => resolve('success');
    s.fail = () => resolve('fail');
    s.error = () => resolve('error');
    s.authenticate({ headers: { authorization: `Bearer ${token}` } });
  });
}

describe('patient strategy vs staff strategy (both directions)', () => {
  const sessions = { isAlive: jest.fn().mockResolvedValue(true) };
  const accounts = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: ACCOUNT, status: 'active', deletedAt: null }),
  };
  const patientStrategy = new PatientJwtStrategy(
    PATIENT_SECRET,
    sessions as never,
    accounts as never,
  );
  const staffStrategy = new JwtStrategy(
    config({ JWT_ACCESS_SECRET: STAFF_SECRET }) as never,
  );

  const patientToken = () =>
    sign({ sub: ACCOUNT, sid: SESSION }, PATIENT_SECRET, {
      audience: 'patient',
      expiresIn: 900,
    });
  const staffToken = (aud?: string) =>
    sign({ sub: ACCOUNT, email: 'a@b.c', sessionId: SESSION }, STAFF_SECRET, {
      ...(aud ? { audience: aud } : {}),
      expiresIn: 900,
    });

  beforeEach(() => {
    sessions.isAlive.mockResolvedValue(true);
    accounts.findOne.mockResolvedValue({
      id: ACCOUNT,
      status: 'active',
      deletedAt: null,
    });
  });

  it('patient strategy accepts a valid patient token', async () => {
    expect(await authenticate(patientStrategy, patientToken())).toBe('success');
  });

  it('patient strategy rejects a staff token (staff secret), with or without aud', async () => {
    expect(await authenticate(patientStrategy, staffToken('staff'))).toBe(
      'fail',
    );
    expect(await authenticate(patientStrategy, staffToken())).toBe('fail');
  });

  it('patient strategy rejects aud=staff even when signed with the patient secret', async () => {
    const t = sign({ sub: ACCOUNT, sid: SESSION }, PATIENT_SECRET, {
      audience: 'staff',
    });
    expect(await authenticate(patientStrategy, t)).toBe('fail');
  });

  it('patient strategy rejects a revoked session and a disabled account', async () => {
    sessions.isAlive.mockResolvedValueOnce(false);
    expect(await authenticate(patientStrategy, patientToken())).toBe('error');
    accounts.findOne.mockResolvedValueOnce({
      id: ACCOUNT,
      status: 'disabled',
      deletedAt: null,
    });
    expect(await authenticate(patientStrategy, patientToken())).toBe('error');
  });

  it('staff strategy rejects a patient token (patient secret)', async () => {
    expect(await authenticate(staffStrategy, patientToken())).toBe('fail');
  });

  it('staff strategy rejects aud=patient even if signed with the staff secret', async () => {
    expect(await authenticate(staffStrategy, staffToken('patient'))).toBe(
      'error',
    );
    await expect(
      staffStrategy.validate({ sub: ACCOUNT, aud: 'patient' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
