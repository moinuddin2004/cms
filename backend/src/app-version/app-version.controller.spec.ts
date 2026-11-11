import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

describe('AppVersionController', () => {
  const controller = new AppVersionController({
    getMinVersion: () => ({ android: '1.0.0', ios: '1.2.0' }),
  } as AppVersionService);

  it('is a public GET app/min-version route', () => {
    const handler = AppVersionController.prototype.minVersion;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('min-version');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(PATH_METADATA, AppVersionController)).toBe(
      'app',
    );
  });

  it('wraps the floors in the standard success envelope', () => {
    const res = controller.minVersion();

    expect(res.isSuccess).toBe(true);
    expect(res.data).toEqual({ android: '1.0.0', ios: '1.2.0' });
  });
});
