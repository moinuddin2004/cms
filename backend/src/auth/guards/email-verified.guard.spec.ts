import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  EmailVerificationService,
  gateFor,
  VerificationGate,
} from 'src/user/email-verification.service';
import { EmailVerifiedGuard } from './email-verified.guard';

const ctx = (req: Record<string, unknown>): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

function guardWith(state: VerificationGate) {
  const verification = { gate: jest.fn().mockResolvedValue(state) };
  return {
    guard: new EmailVerifiedGuard(
      verification as unknown as EmailVerificationService,
    ),
    verification,
  };
}

const user = { uuid: 'u1', globalRole: null, authMethod: 'password' };

describe('gateFor', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  it('is grace before the due date and blocked from it on', () => {
    expect(gateFor(new Date('2026-11-12T10:00:00Z'), now).state).toBe('grace');
    expect(gateFor(now, now).state).toBe('blocked');
    expect(gateFor(new Date('2026-11-01T00:00:00Z'), now).state).toBe(
      'blocked',
    );
  });
});

describe('EmailVerifiedGuard', () => {
  it('refuses a blocked password account with EMAIL_NOT_VERIFIED', async () => {
    const { guard } = guardWith({ state: 'blocked' });
    await expect(
      guard.canActivate(ctx({ user, url: '/patients' })),
    ).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
    await expect(
      guard.canActivate(ctx({ user, url: '/patients' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets grace and verified accounts through', async () => {
    for (const state of [
      { state: 'verified' } as const,
      { state: 'grace', dueAt: new Date(Date.now() + 1000) } as const,
    ]) {
      const { guard } = guardWith(state);
      await expect(
        guard.canActivate(ctx({ user, url: '/patients' })),
      ).resolves.toBe(true);
    }
  });

  it('never blocks /auth/*, so verify / resend / logout keep working', async () => {
    const { guard, verification } = guardWith({ state: 'blocked' });
    for (const url of [
      '/auth/resend-verification',
      '/auth/logout',
      '/auth/refresh?x=1',
    ]) {
      await expect(guard.canActivate(ctx({ user, url }))).resolves.toBe(true);
    }
    expect(verification.gate).not.toHaveBeenCalled();
  });

  it('skips public requests, super admins and Google sessions', async () => {
    const { guard, verification } = guardWith({ state: 'blocked' });
    await expect(guard.canActivate(ctx({ url: '/x' }))).resolves.toBe(true);
    await expect(
      guard.canActivate(
        ctx({ user: { ...user, globalRole: 'super_admin' }, url: '/x' }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        ctx({ user: { ...user, authMethod: 'google' }, url: '/x' }),
      ),
    ).resolves.toBe(true);
    expect(verification.gate).not.toHaveBeenCalled();
  });
});
