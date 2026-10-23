import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTES } from 'src/auth/constants/public-routes';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_SUPER_ADMIN_KEY } from 'src/common/decorators/require-super-admin.decorator';
import { CAN_KEY } from 'src/access/decorators/access.decorators';
import { ThemeController } from './theme.controller';

const reflector = new Reflector();
const meta = (key: string, handler: keyof ThemeController) =>
  reflector.get<unknown>(key, ThemeController.prototype[handler]);

/** Same matching as JwtAuthGuard. */
const isPublicPath = (method: string, path: string) =>
  PUBLIC_ROUTES.some(
    (r) =>
      r.method === method &&
      new RegExp(
        '^' + r.path.replace(/\*\*/g, '[^\\s/]+').replace(/\//g, '\\/') + '$',
      ).test(path),
  );

describe('ThemeController access', () => {
  it('only the login-page theme is public', () => {
    expect(meta(IS_PUBLIC_KEY, 'publicTheme')).toBe(true);
    expect(
      isPublicPath('GET', '/public/theme/7c0f5a3e-1d2b-4c5e-8f90-123456789abc'),
    ).toBe(true);
    for (const h of [
      'current',
      'orgTheme',
      'updateOrgTheme',
      'platformTheme',
    ] as const) {
      expect(meta(IS_PUBLIC_KEY, h)).toBeUndefined();
    }
    expect(isPublicPath('GET', '/theme')).toBe(false);
    expect(isPublicPath('GET', '/admin/theme')).toBe(false);
  });

  it('admin.theme.manage edits the org theme; super admin the platform one', () => {
    for (const h of [
      'orgTheme',
      'updateOrgTheme',
      'locationTheme',
      'updateLocationTheme',
    ] as const) {
      expect(meta(CAN_KEY, h)).toEqual(['admin.theme.manage']);
    }
    expect(meta(REQUIRE_SUPER_ADMIN_KEY, 'platformTheme')).toBe(true);
    expect(meta(REQUIRE_SUPER_ADMIN_KEY, 'updatePlatformTheme')).toBe(true);
  });
});
