import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

const config = {
  get: () => 'test-access-secret',
} as unknown as ConfigService;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'user-1',
    email: 'doctor@example.com',
    globalRole: 'user',
    sessionId: 'session-1',
    amr: 'password',
    hd: null,
    ...overrides,
  };
}

describe('JwtStrategy — staff audience', () => {
  const strategy = new JwtStrategy(config);

  it('accepts a token with aud "staff"', async () => {
    await expect(
      strategy.validate(payload({ aud: 'staff' })),
    ).resolves.toMatchObject({ uuid: 'user-1', sessionId: 'session-1' });
  });

  it('accepts a legacy token with no aud (transition window)', async () => {
    await expect(strategy.validate(payload())).resolves.toMatchObject({
      uuid: 'user-1',
    });
  });

  it('rejects a patient token even when the signature is valid', async () => {
    await expect(
      strategy.validate(payload({ aud: 'patient' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects any other audience', async () => {
    await expect(
      strategy.validate(payload({ aud: 'lab' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
