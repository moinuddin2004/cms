import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { AppRole } from '../enums/app-role.enum';
import type { AppRequest } from '../types/app-request';

/**
 * Doctors must never see prices (billing plan 10.4). Consultation and
 * treatment endpoints are shared with reception, so instead of forking each
 * one this strips the legacy `cost` of every treatment in the response unless
 * the caller holds the admin or receptionist role at the active location.
 */
@Injectable()
export class HideTreatmentPricesInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    return next.handle().pipe(
      switchMap((body) =>
        from(
          this.mayViewPrices(req).then((ok) => {
            if (!ok) stripTreatmentPrices(body);
            return body;
          }),
        ),
      ),
    );
  }

  private async mayViewPrices(req: AppRequest): Promise<boolean> {
    const roles = req.actor?.roles ?? (await this.resolveRoles(req));
    return (
      roles.includes(AppRole.CLINIC_ADMIN) ||
      roles.includes(AppRole.RECEPTIONIST)
    );
  }

  private async resolveRoles(req: AppRequest): Promise<AppRole[]> {
    const userId = req.user?.uuid;
    const tenant = req.tenantContext;
    // Without an identified user and clinic there is no right to prices.
    if (!userId || !tenant) return [];
    const authorization = this.moduleRef.get(AuthorizationService, {
      strict: false,
    });
    const actor = await authorization.resolveActor(
      userId,
      tenant.organizationId,
      tenant.locationId,
    );
    return actor.roles;
  }
}

/** Deletes `cost` from every treatment-shaped object anywhere in `value` (in place). */
export function stripTreatmentPrices(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(stripTreatmentPrices);
    return;
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return;
  const record = value as Record<string, unknown>;
  if ('treatmentName' in record) delete record.cost;
  Object.values(record).forEach(stripTreatmentPrices);
}
