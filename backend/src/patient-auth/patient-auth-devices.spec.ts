import { PatientAuthController } from './patient-auth.controller';

describe('POST /patient-auth/devices/unregister (offline sign-out cleanup)', () => {
  it('removes the token and answers ok whether or not it was known', async () => {
    const removeTokens = jest.fn().mockResolvedValue(0);
    const controller = new PatientAuthController({} as never, { removeTokens } as never);
    const res = await controller.unregisterDevice({ expoPushToken: 'ExponentPushToken[x]' });
    expect(removeTokens).toHaveBeenCalledWith(['ExponentPushToken[x]']);
    expect(res.data).toEqual({ ok: true });
  });
});
