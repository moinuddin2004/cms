import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/** Requests per client IP per window on the public `/lab-link/*` routes. */
const LIMIT = Number(process.env.LAB_LINK_RATE_LIMIT ?? 120);
const WINDOW_MS = 60_000;

/**
 * Small fixed-window throttle for the no-login magic-link routes (Sprint 11
 * hardening). Tokens are 256-bit, so guessing is already infeasible; this
 * only caps scraping and noisy retries from one address. In-memory per API
 * instance — enough for one node; a shared store can replace it later.
 */
@Injectable()
export class MagicLinkThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, { start: number; n: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();
    const hit = this.hits.get(key);
    if (!hit || now - hit.start >= WINDOW_MS) {
      if (this.hits.size > 10_000) this.sweep(now);
      this.hits.set(key, { start: now, n: 1 });
      return true;
    }
    hit.n += 1;
    if (hit.n > LIMIT)
      throw new HttpException(
        {
          message: 'Too many requests — try again in a minute',
          code: 'MAGIC_LINK_RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }

  private sweep(now: number): void {
    for (const [k, v] of this.hits)
      if (now - v.start >= WINDOW_MS) this.hits.delete(k);
  }
}
