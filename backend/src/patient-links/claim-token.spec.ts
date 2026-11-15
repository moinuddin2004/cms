import {
  ageBand,
  CLAIM_TOKEN_PATTERN,
  generateClaimToken,
  hashClaimToken,
  maskEmail,
  maskName,
} from './claim-token';

describe('claim token helpers', () => {
  it('generates unique url-safe 256-bit tokens and hashes them to 64 hex chars', () => {
    const a = generateClaimToken();
    const b = generateClaimToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(CLAIM_TOKEN_PATTERN);
    expect(hashClaimToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashClaimToken(a)).toBe(hashClaimToken(a));
    expect(hashClaimToken(a)).not.toContain(a);
  });

  it('masks emails', () => {
    expect(maskEmail('ali@example.com')).toBe('a***@example.com');
    expect(maskEmail('weird')).toBe('***');
  });

  it('masks names to first name + initials', () => {
    expect(maskName('Ali Raza Khan')).toBe('Ali R. K.');
    expect(maskName('Ali')).toBe('A***');
    expect(maskName('  ')).toBe('***');
  });

  it('bands ages without exposing the exact age', () => {
    const now = new Date('2026-11-15T10:00:00Z');
    expect(ageBand(null, now)).toBeNull();
    expect(ageBand('2020-01-01', now)).toBe('0-12');
    expect(ageBand('2013-11-16', now)).toBe('0-12'); // turns 13 tomorrow
    expect(ageBand('2013-11-15', now)).toBe('13-17');
    expect(ageBand('1990-05-05', now)).toBe('18-39');
    expect(ageBand('1975-05-05', now)).toBe('40-59');
    expect(ageBand('1950-05-05', now)).toBe('60+');
    expect(ageBand('2030-01-01', now)).toBeNull();
  });
});
