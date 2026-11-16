/**
 * Guard + config for the store-review demo seed (M4-03,
 * `database/seed/demo-store-review.ts`). Pure functions: no I/O, so the rules
 * are unit-tested (demo-seed-guard.spec.ts) without a database.
 *
 * The seed is never run by the app or on startup — only by hand:
 *   npm run seed:demo -- --allow-demo-seed
 */

export const FLAG_ALLOW = '--allow-demo-seed';
export const FLAG_ALLOW_PRODUCTION = '--allow-demo-seed-in-production';
export const ENV_ALLOW = 'ALLOW_DEMO_SEED';
export const ENV_ALLOW_PRODUCTION = 'ALLOW_DEMO_SEED_IN_PRODUCTION';

/** Shared password of the dev/QA seed — never accepted for the store-review accounts. */
const KNOWN_WEAK = new Set(['Seed@12345', 'moin1234']);
const MIN_PASSWORD_LENGTH = 12;
const DEFAULT_DOMAIN = 'demo-clinic.example';

export interface DemoSeedConfig {
  /** Password shared by the demo staff logins (from DEMO_STAFF_PASSWORD). */
  staffPassword: string;
  /** Mailbox that receives the patient's sign-in code (from DEMO_PATIENT_EMAIL). */
  patientEmail: string;
  /** Domain of the staff emails (`owner@`, `doctor@`, `reception@`). */
  domain: string;
  production: boolean;
}

const truthy = (v: string | undefined) => v === '1' || v === 'true';

export function assertDemoSeedAllowed(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): DemoSeedConfig {
  if (!argv.includes(FLAG_ALLOW) && !truthy(env[ENV_ALLOW])) {
    throw new Error(
      `Refusing to seed the demo clinic: pass ${FLAG_ALLOW} (or set ${ENV_ALLOW}=1).`,
    );
  }
  const production = env.NODE_ENV === 'production';
  if (
    production &&
    !argv.includes(FLAG_ALLOW_PRODUCTION) &&
    !truthy(env[ENV_ALLOW_PRODUCTION])
  ) {
    throw new Error(
      `NODE_ENV=production: refusing unless ${FLAG_ALLOW_PRODUCTION} (or ${ENV_ALLOW_PRODUCTION}=1) is also given.`,
    );
  }

  const staffPassword = env.DEMO_STAFF_PASSWORD ?? '';
  if (staffPassword.length < MIN_PASSWORD_LENGTH || KNOWN_WEAK.has(staffPassword)) {
    throw new Error(
      `DEMO_STAFF_PASSWORD must be set (at least ${MIN_PASSWORD_LENGTH} characters, not a known seed password).`,
    );
  }

  const patientEmail = (env.DEMO_PATIENT_EMAIL ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
    throw new Error(
      'DEMO_PATIENT_EMAIL must be set to a mailbox you control (it receives the patient sign-in code).',
    );
  }

  const domain = (env.DEMO_STAFF_EMAIL_DOMAIN ?? DEFAULT_DOMAIN).trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error('DEMO_STAFF_EMAIL_DOMAIN is not a valid domain.');
  }
  return { staffPassword, patientEmail, domain, production };
}
