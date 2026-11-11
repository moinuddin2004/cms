import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Public } from 'src/common/decorators/publicDecorator';
import { PatientJwtGuard } from '../guards/patient-jwt.guard';
import { PatientLinkGuard } from '../guards/patient-link.guard';

/**
 * Marks a handler/controller as belonging to the patient API (`/patient-api/*`).
 * `PatientFenceGuard` (first global guard) refuses any path/decorator mismatch.
 */
export const IS_PATIENT_API = 'isPatientApi';

/**
 * Marks a pre-login patient auth route (`/patient-auth/*`). Those routes are
 * public but rate limited; they are checked by `PatientFenceGuard` too.
 */
export const IS_PATIENT_AUTH = 'isPatientAuth';

/**
 * A patient API route: public to the staff guard chain (`@Public()`), fenced by
 * `PatientFenceGuard`, then the patient guards (stubs until M2-02/M2-03).
 */
export const PatientApi = () =>
  applyDecorators(
    Public(),
    SetMetadata(IS_PATIENT_API, true),
    UseGuards(PatientJwtGuard, PatientLinkGuard),
  );

/** A pre-login patient auth route (`@Public()` + rate limit in M2-02). */
export const PatientAuthRoute = () =>
  applyDecorators(Public(), SetMetadata(IS_PATIENT_AUTH, true));
