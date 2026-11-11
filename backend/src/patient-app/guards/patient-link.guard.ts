import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Patient link guard — stub for M0-09.
 *
 * The real guard (M2-03) builds `request.patientContext` from the account's
 * active record links and refuses requests without one. Until then every
 * `@PatientApi()` route must fail closed.
 */
@Injectable()
export class PatientLinkGuard implements CanActivate {
  canActivate(): boolean {
    // TODO(M2-03): build request.patientContext from the account's links.
    throw new UnauthorizedException();
  }
}
