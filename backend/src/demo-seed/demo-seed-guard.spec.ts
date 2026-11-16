import {
  assertDemoSeedAllowed,
  FLAG_ALLOW,
  FLAG_ALLOW_PRODUCTION,
} from './demo-seed-guard';

const ENV = {
  DEMO_STAFF_PASSWORD: 'a-long-demo-passphrase',
  DEMO_PATIENT_EMAIL: 'Reviewer@Example.com',
};

describe('assertDemoSeedAllowed', () => {
  it('refuses without the explicit flag', () => {
    expect(() => assertDemoSeedAllowed([], ENV)).toThrow(/--allow-demo-seed/);
  });

  it('accepts the flag or the env var, and normalises the patient email', () => {
    const a = assertDemoSeedAllowed([FLAG_ALLOW], ENV);
    expect(a.patientEmail).toBe('reviewer@example.com');
    expect(a.production).toBe(false);
    expect(a.domain).toBe('demo-clinic.example');
    expect(() =>
      assertDemoSeedAllowed([], { ...ENV, ALLOW_DEMO_SEED: '1' }),
    ).not.toThrow();
  });

  it('refuses in production with only the first flag', () => {
    const env = { ...ENV, NODE_ENV: 'production' };
    expect(() => assertDemoSeedAllowed([FLAG_ALLOW], env)).toThrow(/production/);
    expect(() =>
      assertDemoSeedAllowed([FLAG_ALLOW, FLAG_ALLOW_PRODUCTION], env),
    ).not.toThrow();
    expect(() =>
      assertDemoSeedAllowed([FLAG_ALLOW], { ...env, ALLOW_DEMO_SEED_IN_PRODUCTION: '1' }),
    ).not.toThrow();
  });

  it('the production flag alone is not enough', () => {
    expect(() =>
      assertDemoSeedAllowed([FLAG_ALLOW_PRODUCTION], { ...ENV, NODE_ENV: 'production' }),
    ).toThrow(/--allow-demo-seed/);
  });

  it('requires a strong password from env, never a default', () => {
    const run = (p?: string) =>
      assertDemoSeedAllowed([FLAG_ALLOW], { ...ENV, DEMO_STAFF_PASSWORD: p });
    expect(() => run(undefined)).toThrow(/DEMO_STAFF_PASSWORD/);
    expect(() => run('short')).toThrow(/DEMO_STAFF_PASSWORD/);
    expect(() => run('Seed@12345')).toThrow(/DEMO_STAFF_PASSWORD/);
  });

  it('requires a valid patient mailbox and domain', () => {
    expect(() =>
      assertDemoSeedAllowed([FLAG_ALLOW], { ...ENV, DEMO_PATIENT_EMAIL: 'nope' }),
    ).toThrow(/DEMO_PATIENT_EMAIL/);
    expect(() =>
      assertDemoSeedAllowed([FLAG_ALLOW], { ...ENV, DEMO_STAFF_EMAIL_DOMAIN: 'bad domain' }),
    ).toThrow(/DOMAIN/);
  });

  it('never echoes secrets in error messages', () => {
    try {
      assertDemoSeedAllowed([FLAG_ALLOW], { ...ENV, DEMO_STAFF_PASSWORD: 'short' });
    } catch (e) {
      expect(String(e)).not.toContain('short');
    }
  });
});
