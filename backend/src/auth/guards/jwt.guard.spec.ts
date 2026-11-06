import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt.guard';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function mockContext(handlerMeta?: boolean, classMeta?: boolean): ExecutionContext {
    const handler = () => {};
    class TestController {}

    if (handlerMeta !== undefined) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, handlerMeta, handler);
    }
    if (classMeta !== undefined) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, classMeta, TestController);
    }

    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('returns true when handler is decorated with @Public()', () => {
      const context = mockContext(true, undefined);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('returns true when controller class is decorated with @Public()', () => {
      const context = mockContext(undefined, true);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('delegates to super.canActivate when route is not public', () => {
      const context = mockContext(undefined, undefined);
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true as any);

      expect(guard.canActivate(context)).toBe(true);
      expect(superSpy).toHaveBeenCalledWith(context);
      superSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;

    it('returns the user when authenticated', () => {
      const mockUser = { uuid: 'user-123', email: 'test@example.com' };
      expect(guard.handleRequest(null, mockUser, null, context)).toBe(mockUser);
    });

    it('throws UnauthorizedException when no authorization header is provided', () => {
      expect(() => guard.handleRequest(null, null, null, context)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.handleRequest(null, null, null, context)).toThrow(
        /No token provided/,
      );
    });

    it('throws UnauthorizedException when token is expired (info object)', () => {
      const expiredContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer expired.token.here' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() =>
        guard.handleRequest(
          null,
          null,
          { name: 'TokenExpiredError', message: 'jwt expired' },
          expiredContext,
        ),
      ).toThrow(/Token has expired/);
    });

    it('throws UnauthorizedException when token is invalid', () => {
      const invalidContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer invalid.token.here' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() =>
        guard.handleRequest(
          null,
          null,
          { name: 'JsonWebTokenError', message: 'invalid signature' },
          invalidContext,
        ),
      ).toThrow(/Invalid token/);
    });
  });
});
