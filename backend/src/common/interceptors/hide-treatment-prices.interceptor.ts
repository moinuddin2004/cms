import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { AccessContext } from 'src/access/access-context';

/**
 * Prices are only for holders of `patients.price.view` (doctors never see
 * them by default — billing plan 10.4). Consultation and treatment endpoints
 * are shared with reception and return plain objects (which `@VisibleIf`
 * cannot see), so this strips the legacy `cost` of every treatment-shaped
 * object in the response. No AccessContext on the request → stripped
 * (fail-closed).
 */
@Injectable()
export class HideTreatmentPricesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ access?: AccessContext }>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (!mayViewPrices(req.access)) stripTreatmentPrices(body);
        return body;
      }),
    );
  }
}

export function mayViewPrices(access: AccessContext | undefined): boolean {
  return access?.can('patients.price.view') ?? false;
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
