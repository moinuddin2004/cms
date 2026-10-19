import {
  applyDecorators,
  Controller,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { LabMemberRole } from '../enums/lab.enums';
import {
  LAB_ANY_KEY,
  LAB_PORTAL_PREFIX,
  LAB_ROLES_KEY,
} from './lab-portal.constants';
import type { LabActorContext, LabPortalRequest } from './lab-portal.constants';
import { LabPortalGuard } from './lab-portal.guard';

export type { LabActorContext } from './lab-portal.constants';

/**
 * A lab portal controller: `/lab-portal/<path>`, no clinic tenant context
 * (TenantContextGuard skips it) and `LabPortalGuard` on every handler, so
 * `@LabActor()` is always the caller's own active lab membership.
 *
 *   @LabPortalController('orders')
 *   export class LabOrdersController { … }
 */
export const LabPortalController = (path = '') =>
  applyDecorators(
    Controller(path ? `${LAB_PORTAL_PREFIX}/${path}` : LAB_PORTAL_PREFIX),
    ContextFree(),
    UseGuards(LabPortalGuard),
  );

/** Restrict a portal route (or controller) to these lab roles. */
export const LabRoles = (...roles: LabMemberRole[]) =>
  SetMetadata(LAB_ROLES_KEY, roles);

/**
 * The route needs a lab membership but no selected lab (e.g. `GET /me`,
 * which lists the labs to choose from). `@LabActor()` is unavailable there.
 */
export const AnyLabMembership = () => SetMetadata(LAB_ANY_KEY, true);

/** The caller's `{ userId, labId, role }` in the active lab. */
export const LabActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): LabActorContext => {
    const actor = ctx.switchToHttp().getRequest<LabPortalRequest>().labActor;
    if (!actor) {
      // Programming error: not a @LabPortalController, or an @AnyLabMembership route.
      throw new Error('@LabActor() needs a @LabPortalController route');
    }
    return actor;
  },
);
