import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { AccessContext } from '../access-context';
import type { Permission } from '../catalog/permissions';

/** A class (constructor function). */
type Ctor = abstract new (...args: never[]) => unknown;

/** constructor → (property → permission needed to see it) */
const FIELDS = new Map<object, Map<string | symbol, Permission>>();
/** Resolved rules per class incl. inherited ones (reset when a rule is added). */
const RESOLVED = new Map<object, Map<string | symbol, Permission>>();

/**
 * Response field shown only to holders of `perm` (generalizes
 * HideTreatmentPricesInterceptor):
 *
 *   class TreatmentDto { @VisibleIf('patients.price.view') price: number }
 *
 * The global VisibleIfInterceptor deletes the field from every instance of
 * the class (and subclasses) in the response when the caller lacks `perm`.
 * Only class instances are recognised: return `plainToInstance(Dto, …)` /
 * entities, not object literals.
 */
export function VisibleIf(perm: Permission): PropertyDecorator {
  return (target, property) => {
    const ctor = target.constructor;
    const fields = FIELDS.get(ctor) ?? new Map<string | symbol, Permission>();
    fields.set(property, perm);
    FIELDS.set(ctor, fields);
    RESOLVED.clear();
  };
}

/** Hidden-field rules for a class, including inherited ones. */
export function visibleIfFields(ctor: Ctor): Map<string | symbol, Permission> {
  const cached = RESOLVED.get(ctor);
  if (cached) return cached;
  const out = new Map<string | symbol, Permission>();
  const chain: object[] = [];
  for (
    let c: object | null = ctor;
    c && c !== Object && c !== Function.prototype;
    c = Object.getPrototypeOf(c) as object | null
  ) {
    chain.unshift(c);
  }
  for (const c of chain)
    FIELDS.get(c)?.forEach((perm, prop) => out.set(prop, perm));
  RESOLVED.set(ctor, out);
  return out;
}

const hasRules = () => FIELDS.size > 0;

function isOpaque(value: object): boolean {
  return (
    value instanceof Date ||
    value instanceof StreamableFile ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof RegExp ||
    Buffer.isBuffer(value) ||
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer ||
    typeof (value as { pipe?: unknown }).pipe === 'function'
  );
}

/** Deletes, in place, every @VisibleIf field whose permission `can` refuses. */
export function stripHiddenFields(
  value: unknown,
  can: (perm: Permission) => boolean,
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value) || isOpaque(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) stripHiddenFields(item, can, seen);
    return;
  }

  const record = value as Record<string | symbol, unknown>;
  const proto = Object.getPrototypeOf(value) as {
    constructor?: unknown;
  } | null;
  const ctor = proto?.constructor;
  if (typeof ctor === 'function' && ctor !== Object) {
    visibleIfFields(ctor as Ctor).forEach((perm, prop) => {
      if (!can(perm)) delete record[prop];
    });
  }
  for (const child of Object.values(record))
    stripHiddenFields(child, can, seen);
}

/**
 * Global: strips @VisibleIf fields from every HTTP response. Without an
 * AccessContext on the request every guarded field is hidden (fail-closed).
 */
@Injectable()
export class VisibleIfInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<{ access?: AccessContext }>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (!hasRules()) return body;
        const access = req.access;
        stripHiddenFields(body, (p) => access?.can(p) ?? false);
        return body;
      }),
    );
  }
}
