import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_SUPER_ADMIN_KEY } from 'src/common/decorators/require-super-admin.decorator';
import { CAN_KEY } from 'src/access/decorators/access.decorators';
import { ThemeController } from './theme.controller';

const reflector = new Reflector();
const meta = (key: string, handler: keyof ThemeController) =>
  reflector.get<unknown>(key, ThemeController.prototype[handler]);

describe('ThemeController access', () => {
  it('only the login-page theme is public', () => {
    expect(meta(IS_PUBLIC_KEY, 'publicTheme')).toBe(true);
    for (const h of [
      'current',
      'orgTheme',
      'updateOrgTheme',
      'platformTheme',
    ] as const) {
      expect(meta(IS_PUBLIC_KEY, h)).toBeUndefined();
    }
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
