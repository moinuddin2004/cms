import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  IS_PATIENT_API,
  IS_PATIENT_AUTH,
} from '../decorators/patient-api.decorator';

const PATIENT_API_PREFIX = '/patient-api/';
const PATIENT_AUTH_PREFIX = '/patient-auth/';

/**
 * The patient-space fence — registered as the FIRST global guard.
 *
 * Path and decorator must agree:
 * - a `/patient-api/*` path needs `@PatientApi()`;
 * - a `/patient-auth/*` path needs `@PatientAuthRoute()`;
 * - neither decorator may be used on any other path.
 *
 * A mismatch is a programming error, so every request to such a route is
 * refused with `403 { code: 'PATIENT_FENCE' }` — even a staff request. It runs
 * before RateLimiterGuard on purpose: it is the cheapest check and a fence
 * error must never be masked by a 401/429.
 */
@Injectable()
export class PatientFenceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path || request.url?.split('?')[0] || '';
    const targets = [context.getHandler(), context.getClass()];
    const isPatientApi =
      this.reflector.getAllAndOverride<boolean>(IS_PATIENT_API, targets) ===
      true;
    const isPatientAuth =
      this.reflector.getAllAndOverride<boolean>(IS_PATIENT_AUTH, targets) ===
      true;
    const underPatientApi = path.startsWith(PATIENT_API_PREFIX);
    const underPatientAuth = path.startsWith(PATIENT_AUTH_PREFIX);

    if (underPatientApi === isPatientApi && underPatientAuth === isPatientAuth)
      return true;

    throw new ForbiddenException({
      code: 'PATIENT_FENCE',
      message: 'This route is not available for this client',
    });
  }
}
