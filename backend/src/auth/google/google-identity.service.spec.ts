const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleIdentityService } from './google-identity.service';

const payload = {
  sub: 'google-sub',
  email: 'person@example.com',
  email_verified: true,
  name: 'Patient Person',
  iss: 'https://accounts.google.com',
};

describe('GoogleIdentityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
  });

  it('keeps staff verification restricted to the existing web client audience', async () => {
    const config = new ConfigService({
      GOOGLE_CLIENT_ID: 'staff-web-client',
      GOOGLE_ANDROID_CLIENT_ID: 'patient-android-client',
      GOOGLE_IOS_CLIENT_ID: 'patient-ios-client',
    });
    const identity = new GoogleIdentityService(config);

    await identity.verify('staff-credential');

    expect(OAuth2Client).toHaveBeenCalledWith();
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'staff-credential',
      audience: 'staff-web-client',
    });
  });

  it('accepts the configured client audience array for patient verification', async () => {
    const config = new ConfigService({
      GOOGLE_CLIENT_ID: 'web-client',
      GOOGLE_ANDROID_CLIENT_ID: 'android-client',
      GOOGLE_IOS_CLIENT_ID: '',
    });
    const identity = new GoogleIdentityService(config);
    const audiences = identity.patientAudiences;

    await identity.verify('patient-credential', audiences);

    expect(audiences).toEqual(['web-client', 'android-client']);
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'patient-credential',
      audience: ['web-client', 'android-client'],
    });
  });

  it('exposes the web, Android and iOS client ids as the native audience list', () => {
    const identity = new GoogleIdentityService(
      new ConfigService({
        GOOGLE_CLIENT_ID: ' web ',
        GOOGLE_ANDROID_CLIENT_ID: 'android',
        GOOGLE_IOS_CLIENT_ID: 'ios',
      }),
    );
    expect(identity.clientAudiences).toEqual(['web', 'android', 'ios']);
    expect(identity.patientAudiences).toEqual(identity.clientAudiences);
  });

  it('exposes rawName only when Google sent a name claim', async () => {
    const identity = new GoogleIdentityService(
      new ConfigService({ GOOGLE_CLIENT_ID: 'web' }),
    );
    await expect(identity.verify('c')).resolves.toMatchObject({
      rawName: 'Patient Person',
    });
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...payload, name: undefined }),
    });
    await expect(identity.verify('c')).resolves.toMatchObject({
      rawName: null,
      name: 'person',
    });
  });
});
