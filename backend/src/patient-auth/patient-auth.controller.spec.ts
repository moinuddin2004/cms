/* eslint-disable @typescript-eslint/unbound-method */
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RATE_LIMIT_KEY } from 'src/auth/guards/rate-limiter.guard';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import {
  IS_PATIENT_API,
  IS_PATIENT_AUTH,
} from 'src/patient-app/decorators/patient-api.decorator';
import { PatientMeController } from 'src/patient-app/me.controller';
import { PatientAuthController } from './patient-auth.controller';

const handlers = (c: { prototype: object }) =>
  Object.getOwnPropertyNames(c.prototype)
    .filter((n) => n !== 'constructor')
    .map((n) => (c.prototype as Record<string, unknown>)[n] as object)
    .filter((fn) => Reflect.getMetadata(METHOD_METADATA, fn) !== undefined);

describe('patient controllers: decorators', () => {
  it('/patient-auth: every handler is public, fenced and rate limited', () => {
    const fns = handlers(PatientAuthController);
    expect(fns).toHaveLength(4);
    for (const fn of fns) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, fn)).toBe(true);
      expect(Reflect.getMetadata(IS_PATIENT_AUTH, fn)).toBe(true);
      expect(Reflect.getMetadata(RATE_LIMIT_KEY, fn)).toBeDefined();
    }
    expect(Reflect.getMetadata(PATH_METADATA, PatientAuthController)).toBe(
      'patient-auth',
    );
  });

  it('email/start limits per email (5) and per IP (20) per 15 min', () => {
    const start = PatientAuthController.prototype.start;
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, start)).toMatchObject({
      maxAttempts: 20,
      windowSeconds: 900,
      perAccountField: 'email',
      perAccountMax: 5,
    });
  });

  it('/patient-api/me carries @PatientApi() and no auth-route marker', () => {
    expect(Reflect.getMetadata(IS_PATIENT_API, PatientMeController)).toBe(true);
    expect(
      Reflect.getMetadata(IS_PATIENT_AUTH, PatientMeController),
    ).toBeUndefined();
    expect(Reflect.getMetadata(PATH_METADATA, PatientMeController)).toBe(
      'patient-api/me',
    );
    expect(handlers(PatientMeController)).toHaveLength(2);
  });
});
