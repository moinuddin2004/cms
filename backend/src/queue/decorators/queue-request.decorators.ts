import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { createHash } from 'crypto';
import type { AppRequest } from 'src/common/types/app-request';
import { QueueErrors } from '../queue.errors';
import type { IdempotencyInput } from '../services/queue-orchestrator.service';

function firstHeader(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/**
 * `Idempotency-Key` header (required on queue mutations) plus a hash of the
 * request, so a reused key with a different body is rejected (422) and a
 * retried request gets the saved response instead of a second token.
 */
export const Idempotency = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IdempotencyInput => {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const key = firstHeader(req.headers['idempotency-key']).trim();
    if (!key || key.length > 200) throw QueueErrors.idempotencyKeyRequired();
    const body: unknown = req.body ?? {};
    const hash = createHash('sha256')
      .update(`${req.method} ${req.path}\n${JSON.stringify(body)}`)
      .digest('hex');
    return { key, hash };
  },
);

/**
 * `If-Match: <version>` — optional. When sent, the action only applies if the
 * entry is still at that version (409 VERSION_CONFLICT otherwise), so a stale
 * screen can't act on a patient someone else already moved.
 */
export const IfMatch = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | undefined => {
    const raw = firstHeader(
      ctx.switchToHttp().getRequest<AppRequest>().headers['if-match'],
    );
    if (!raw) return undefined;
    const n = Number(raw.replace(/^W\//, '').replace(/"/g, ''));
    return Number.isInteger(n) ? n : undefined;
  },
);
