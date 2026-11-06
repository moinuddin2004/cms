import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppLogger } from '../../common/services/logger.service';

/**
 * Rate limiting for the whole API — registered as the FIRST global guard
 * (`app.module.ts`), so it also runs before authentication.
 *
 * 1. Every HTTP request counts against a per-IP ceiling
 *    (`RATE_LIMIT_GLOBAL_PER_MINUTE`, default 3000 — generous: a whole clinic
 *    shares one IP behind its router). Stops floods and scraping.
 * 2. Routes with `@RateLimit({...})` get their own, stricter limit per IP
 *    (and optionally per account, e.g. per email on login).
 *
 * The IP is `request.ip`: Express's view, which honours `TRUST_PROXY`
 * (set in `bootstrap/http.ts`). The raw `X-Forwarded-For` header is never
 * read directly — a client can put anything in it.
 *
 * Counters live in memory, which fits the single `all` process this app
 * runs as. They reset on restart.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxAttempts: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /**
   * Also limit per account: the body field holding it (e.g. 'email').
   * Counted on its own key, so rotating IPs doesn't help either.
   */
  perAccountField?: string;
  /** Limit for the per-account key (default: maxAttempts). */
  perAccountMax?: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit =
  (config: RateLimitConfig): MethodDecorator =>
  (_target, _key, descriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor.value as object);
  };

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (unref: never keeps the process alive).
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}, 60000).unref();

/** Test hook: forget every counter. */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly globalPerMinute = parseInt(
    process.env.RATE_LIMIT_GLOBAL_PER_MINUTE || '3000',
    10,
  );

  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';

    if (this.globalPerMinute > 0) {
      this.hit(`global:${ip}`, this.globalPerMinute, 60);
    }

    const config = this.reflector.get<RateLimitConfig | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!config) return true;

    const route = `${request.method}:${request.route?.path || request.path}`;
    this.hit(`route:${ip}:${route}`, config.maxAttempts, config.windowSeconds);

    if (config.perAccountField) {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const raw = body[config.perAccountField];
      if (typeof raw === 'string' && raw.trim()) {
        this.hit(
          `account:${route}:${raw.trim().toLowerCase()}`,
          config.perAccountMax ?? config.maxAttempts,
          config.windowSeconds,
        );
      }
    }
    return true;
  }

  private hit(key: string, max: number, windowSeconds: number): void {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return;
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      // Log the kind of limit only — keys can contain emails.
      if (entry.count === max + 1) {
        this.logger.warn(
          `Rate limit exceeded (${key.split(':')[0]})`,
          RateLimiterGuard.name,
        );
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
