import { policyBlock, SignInPolicy } from './clinic-gate.service';

const base: SignInPolicy = {
  googleEnabled: true,
  requireGoogle: false,
  googleDomains: [],
  joinRequestsEnabled: false,
};
const password = { method: 'password' };
const gmail = { method: 'google', domain: null };
const workspace = { method: 'google', domain: 'clinic.com' };

describe('policyBlock', () => {
  it('lets password and Google sign-ins in by default', () => {
    expect(policyBlock(base, password)).toBeNull();
    expect(policyBlock(base, gmail)).toBeNull();
  });

  it('blocks password sign-ins when Google is required', () => {
    const p = { ...base, requireGoogle: true };
    expect(policyBlock(p, password)?.code).toBe('GOOGLE_SIGN_IN_REQUIRED');
    expect(policyBlock(p, gmail)).toBeNull();
  });

  it('blocks Google sign-ins when Google is off', () => {
    const p = { ...base, googleEnabled: false };
    expect(policyBlock(p, gmail)?.code).toBe('GOOGLE_SIGN_IN_DISABLED');
    expect(policyBlock(p, password)).toBeNull();
  });

  it('does not require Google while Google is off', () => {
    const p = { ...base, googleEnabled: false, requireGoogle: true };
    expect(policyBlock(p, password)).toBeNull();
  });

  it('allows only listed Workspace domains for Google sign-ins', () => {
    const p = { ...base, googleDomains: ['clinic.com'] };
    expect(policyBlock(p, workspace)).toBeNull();
    expect(
      policyBlock(p, { method: 'google', domain: 'CLINIC.COM' }),
    ).toBeNull();
    expect(policyBlock(p, gmail)?.code).toBe('GOOGLE_DOMAIN_NOT_ALLOWED');
    expect(
      policyBlock(p, { method: 'google', domain: 'other.com' })?.code,
    ).toBe('GOOGLE_DOMAIN_NOT_ALLOWED');
    // Domains restrict Google only; passwords still work unless required.
    expect(policyBlock(p, password)).toBeNull();
  });
});
