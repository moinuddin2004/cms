import { ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleAuthService } from './google-auth.service';

const identityClaims = {
  sub: 'google-sub',
  email: 'staff@clinic.test',
  name: 'Staff Person',
  rawName: 'Staff Person',
  picture: null,
  hd: 'clinic.test',
};

function harness(
  opts: { linkedUserId?: string; clientId?: string | null } = {},
) {
  const user = {
    uuid: 'user-1',
    email: identityClaims.email,
    globalRole: null,
  };
  const links = {
    findOneBy: jest
      .fn()
      .mockResolvedValue(
        opts.linkedUserId ? { userId: opts.linkedUserId } : null,
      ),
  };
  const users = {
    findOneBy: jest.fn().mockResolvedValue(user),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };
  const dataSource = {
    getRepository: jest.fn((entity: { name: string }) =>
      entity.name === 'OAuthProvider' ? links : users,
    ),
  };
  const identity = {
    clientId: opts.clientId === undefined ? 'web' : opts.clientId,
    clientAudiences: ['web', 'android', 'ios'],
    verify: jest.fn().mockResolvedValue(identityClaims),
  };
  const authService = {
    issueLogin: jest.fn().mockResolvedValue({ accessToken: 'a' }),
  };
  const gate = {
    joinableClinics: jest
      .fn()
      .mockResolvedValue([{ id: 'o1', name: 'Clinic' }]),
  };
  const service = new GoogleAuthService(
    dataSource as never,
    identity as never,
    authService as never,
    {} as never,
    gate as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, identity, authService, gate, user };
}

const req = {} as Request;
const res = {} as Response;

describe('GoogleAuthService.signIn (staff, web + native)', () => {
  it('verifies the token against the web, Android and iOS client ids', async () => {
    const h = harness({ linkedUserId: 'user-1' });
    await h.service.signIn({ credential: 'tok' }, req, res);
    expect(h.identity.verify).toHaveBeenCalledWith('tok', [
      'web',
      'android',
      'ios',
    ]);
  });

  it('refuses with 503 when the web client id (the on/off switch) is unset, even with native ids', async () => {
    const h = harness({ linkedUserId: 'user-1', clientId: null });
    await expect(
      h.service.signIn({ credential: 'tok' }, req, res),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(h.identity.verify).not.toHaveBeenCalled();
  });

  it('signs a linked account in through the shared login path', async () => {
    const h = harness({ linkedUserId: 'user-1' });
    const result = await h.service.signIn(
      { credential: 'tok', rememberMe: false },
      req,
      res,
    );
    expect(result).toEqual({
      outcome: 'signed_in',
      session: { accessToken: 'a' },
    });
    expect(h.authService.issueLogin).toHaveBeenCalledWith(
      h.user,
      req,
      res,
      false,
      { method: 'google', domain: 'clinic.test' },
    );
  });

  it('returns no_account (never creates a user) for an unknown Google account', async () => {
    const h = harness();
    const result = await h.service.signIn({ credential: 'tok' }, req, res);
    expect(result.outcome).toBe('no_account');
    expect(h.gate.joinableClinics).toHaveBeenCalledWith('clinic.test');
    expect(h.authService.issueLogin).not.toHaveBeenCalled();
  });
});

describe('GoogleAuthService — every flow accepts native client ids (audit L11)', () => {
  it.each([
    [
      'register',
      (s: GoogleAuthService) =>
        s.register({ credential: 'tok' } as never, req, res),
    ],
    [
      'requestToJoin',
      (s: GoogleAuthService) =>
        s.requestToJoin({ credential: 'tok' } as never, req, res),
    ],
    [
      'createDesktopHandoff',
      (s: GoogleAuthService) => s.createDesktopHandoff('tok', 'st', req),
    ],
  ])('%s verifies against web + Android + iOS', async (_name, call) => {
    const h = harness({ linkedUserId: 'user-1' });
    await call(h.service).catch(() => undefined); // only the verify call matters here
    expect(h.identity.verify).toHaveBeenCalledWith('tok', [
      'web',
      'android',
      'ios',
    ]);
  });
});
