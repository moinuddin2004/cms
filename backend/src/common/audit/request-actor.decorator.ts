import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { isIP } from 'net';
import type { AppRequest } from 'src/common/types/app-request';
import { ActorRef, ActorSide } from './audit.enums';

function firstHeader(v: string | string[] | undefined): string | null {
  const value = Array.isArray(v) ? v[0] : v;
  return value ? value.slice(0, 100) : null;
}

/**
 * The signed-in user as an audit `ActorRef` for the given side, with the
 * client IP and `x-request-id` (when the caller sends one):
 *
 *   @Post() create(@RequestActor(ActorSide.PLATFORM) actor: ActorRef) …
 */
export const RequestActor = createParamDecorator(
  (side: ActorSide, ctx: ExecutionContext): ActorRef => {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const ip = req.ip && isIP(req.ip) ? req.ip : null;
    return {
      userId: req.user?.uuid ?? null,
      side,
      ip,
      requestId: firstHeader(req.headers['x-request-id']),
    };
  },
);
