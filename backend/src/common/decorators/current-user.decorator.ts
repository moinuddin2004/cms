import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRequest } from '../types/app-request';

/** The signed-in user's id (`request.user.uuid`), or undefined on public routes. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<AppRequest>().user?.uuid,
);
