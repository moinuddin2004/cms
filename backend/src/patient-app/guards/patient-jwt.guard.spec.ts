import { ExecutionContext } from '@nestjs/common';
import * as passport from 'passport';
import { Strategy } from 'passport-strategy';
import { PATIENT_AUTH_PROPERTY, PatientJwtGuard } from './patient-jwt.guard';

class FakePatientStrategy extends Strategy {
  name = 'patient-jwt';
  authenticate() {
    this.success({ accountId: 'acc-1', sessionId: 'sid-1' });
  }
}

describe('PatientJwtGuard', () => {
  beforeAll(() => {
    passport.use(new FakePatientStrategy());
  });
  afterAll(() => {
    passport.unuse('patient-jwt');
  });

  it('puts the identity on request.patientAuth and leaves request.user unset', async () => {
    const request: Record<string, unknown> = {
      headers: {},
      logIn: jest.fn(),
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;

    const ok = await new PatientJwtGuard().canActivate(ctx);

    expect(ok).toBe(true);
    expect(PATIENT_AUTH_PROPERTY).toBe('patientAuth');
    expect(request[PATIENT_AUTH_PROPERTY]).toEqual({
      accountId: 'acc-1',
      sessionId: 'sid-1',
    });
    expect(request.user).toBeUndefined();
  });
});
