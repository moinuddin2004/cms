import { DataSource, EntityManager, Repository } from 'typeorm';
import { GoogleIdentityService } from 'src/auth/google/google-identity.service';
import { PatientAccountConsent } from 'src/patient-app/entities/patient-account-consent.entity';
import { PatientAccountIdentity } from './entities/patient-account-identity.entity';
import { PatientAccount } from './entities/patient-account.entity';
import { LoginCodeService } from './login-code.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientSessionService } from './patient-session.service';
import { PatientTokenService } from './patient-token.service';

const googleIdentity = {
  sub: 'google-sub',
  email: 'person@example.com',
  name: 'Patient Person',
  picture: null,
  hd: null,
};

const input = {
  idToken: 'verified-google-token',
  termsVersion: 'terms-1',
  privacyVersion: 'privacy-1',
};

function createHarness() {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const accountRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((value: Partial<PatientAccount>) => value),
    save: jest.fn((value: Partial<PatientAccount>) => Promise.resolve({
      id: value.id ?? 'new-account-id',
      email: value.email ?? googleIdentity.email,
      fullName: value.fullName ?? null,
      emailVerifiedAt: value.emailVerifiedAt ?? null,
      status: value.status ?? 'active',
      phone: null,
      phoneVerifiedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...value,
    })),
  };
  const identityRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: Partial<PatientAccountIdentity>) => value),
    save: jest.fn(),
  };
  const consentRepository = {
    exist: jest.fn().mockResolvedValue(false),
    create: jest.fn((value: Partial<PatientAccountConsent>) => value),
    save: jest.fn(),
  };
  const repositories = new Map<unknown, unknown>([
    [PatientAccount, accountRepository],
    [PatientAccountIdentity, identityRepository],
    [PatientAccountConsent, consentRepository],
  ]);
  const manager = {
    getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
  };
  const dataSource = {
    transaction: jest.fn((work: (em: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  const google = {
    patientAudiences: ['web-client', 'android-client'],
    verify: jest.fn().mockResolvedValue(googleIdentity),
  };
  const sessions = {
    create: jest.fn().mockResolvedValue({
      session: { id: 'session-id' },
      refreshToken: 'session-id:refresh-token',
    }),
  };
  const tokens = { sign: jest.fn().mockResolvedValue('patient-access-token') };
  const service = new PatientAuthService(
    dataSource as unknown as DataSource,
    {} as LoginCodeService,
    sessions as unknown as PatientSessionService,
    tokens as unknown as PatientTokenService,
    google as unknown as GoogleIdentityService,
    accountRepository as unknown as Repository<PatientAccount>,
  );

  return {
    service,
    accountRepository,
    identityRepository,
    consentRepository,
    queryBuilder,
    google,
    sessions,
    tokens,
  };
}

describe('PatientAuthService Google sign-in', () => {
  it('creates a patient account, links the verified identity, records consent and issues a session', async () => {
    const harness = createHarness();
    const result = await harness.service.signInWithGoogle(input, {
      ip: '192.0.2.1',
      deviceLabel: 'Phone',
    });

    expect(harness.google.verify).toHaveBeenCalledWith(input.idToken, [
      'web-client',
      'android-client',
    ]);
    expect(harness.accountRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: googleIdentity.email,
        fullName: googleIdentity.name,
        status: 'active',
      }),
    );
    expect(harness.identityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'new-account-id',
        provider: 'google',
        subject: googleIdentity.sub,
      }),
    );
    expect(harness.consentRepository.save).toHaveBeenCalledTimes(2);
    expect(harness.sessions.create).toHaveBeenCalledWith(
      'new-account-id',
      expect.objectContaining({ ip: '192.0.2.1', deviceLabel: 'Phone' }),
    );
    expect(result).toMatchObject({
      account: {
        id: 'new-account-id',
        email: googleIdentity.email,
        fullName: googleIdentity.name,
      },
      accessToken: 'patient-access-token',
      refreshToken: 'session-id:refresh-token',
      isNewAccount: true,
      needsName: false,
    });
  });

  it('adds the Google identity to an existing account found by verified email', async () => {
    const harness = createHarness();
    harness.queryBuilder.getOne.mockResolvedValue({
      id: 'existing-account-id',
      email: googleIdentity.email,
      fullName: null,
      emailVerifiedAt: null,
      status: 'active',
      deletedAt: null,
    });

    const result = await harness.service.signInWithGoogle(input, {});

    expect(harness.accountRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-account-id',
        fullName: googleIdentity.name,
        emailVerifiedAt: expect.any(Date) as Date,
      }),
    );
    expect(harness.identityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'existing-account-id' }),
    );
    expect(result.isNewAccount).toBe(false);
    expect(result.needsName).toBe(false);
  });

  it('uses the account already linked to the Google subject', async () => {
    const harness = createHarness();
    harness.identityRepository.findOne.mockResolvedValue({
      accountId: 'linked-account-id',
    });
    harness.accountRepository.findOne.mockResolvedValue({
      id: 'linked-account-id',
      email: 'different@example.com',
      fullName: 'Existing Name',
      emailVerifiedAt: new Date(),
      status: 'active',
      deletedAt: null,
    });

    const result = await harness.service.signInWithGoogle(input, {});

    expect(harness.accountRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(harness.identityRepository.save).not.toHaveBeenCalled();
    expect(result.account.id).toBe('linked-account-id');
    expect(result.isNewAccount).toBe(false);
  });

  it('maps every Google verifier failure to GOOGLE_TOKEN_INVALID', async () => {
    const harness = createHarness();
    harness.google.verify.mockRejectedValue(new Error('invalid token'));

    await expect(
      harness.service.signInWithGoogle(input, {}),
    ).rejects.toMatchObject({
      response: {
        code: 'GOOGLE_TOKEN_INVALID',
      },
      status: 401,
    });
    expect(harness.sessions.create).not.toHaveBeenCalled();
  });
});
