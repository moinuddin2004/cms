import { ConfigService } from '@nestjs/config';
import { AppVersionService } from './app-version.service';

function service(env: Record<string, string | undefined>) {
  return new AppVersionService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('AppVersionService', () => {
  it('defaults both platforms to 0.0.0 when nothing is configured', () => {
    expect(service({}).getMinVersion()).toEqual({
      android: '0.0.0',
      ios: '0.0.0',
    });
  });

  it('reads the per-platform floors from env', () => {
    expect(
      service({
        MOBILE_MIN_VERSION_ANDROID: '2.1.0',
        MOBILE_MIN_VERSION_IOS: '2.0.3',
      }).getMinVersion(),
    ).toEqual({ android: '2.1.0', ios: '2.0.3' });
  });

  it('omits an empty message and trims a present one', () => {
    expect(
      service({ MOBILE_MIN_VERSION_MESSAGE: '  ' }).getMinVersion(),
    ).not.toHaveProperty('message');

    expect(
      service({
        MOBILE_MIN_VERSION_MESSAGE: ' Please update ',
      }).getMinVersion(),
    ).toEqual({ android: '0.0.0', ios: '0.0.0', message: 'Please update' });
  });
});
