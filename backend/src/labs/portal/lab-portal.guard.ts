import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { LabMemberRole } from '../enums/lab.enums';
import {
  CLINIC_CONTEXT_HEADERS,
  LAB_ANY_KEY,
  LAB_ID_HEADER,
  LAB_ROLES_KEY,
} from './lab-portal.constants';
import type { LabPortalRequest } from './lab-portal.constants';
import { findLabMemberships } from './lab-memberships';

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const forbidden = (code: string, message: string) =>
  new ForbiddenException({ code, message });

/**
 * Lab portal access — runs after the global guards on every
 * `@LabPortalController` route (TenantContextGuard skips them: they are
 * context-free).
 *
 * 1. A portal request never carries clinic context: `x-organization-id` /
 *    `x-location-id` are rejected (400), so lab and clinic scopes can't mix.
 * 2. The active lab is `x-lab-id`, or the caller's only lab. It must be an
 *    active membership of an active lab — anything else is 403, and another
 *    lab's id looks exactly like a lab that doesn't exist.
 * 3. `@LabRoles()` is checked against that membership's role.
 * 4. `request.labActor = { userId, labId, role }` for `@LabActor()`.
 *
 * Super admins hold no lab membership, so they are refused like anyone else.
 */
@Injectable()
export class LabPortalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<LabPortalRequest>();
    const userId = req.user?.uuid;
    if (!userId) throw new UnauthorizedException();

    if (CLINIC_CONTEXT_HEADERS.some((h) => req.headers[h] !== undefined)) {
      throw new BadRequestException({
        code: 'LAB_PORTAL_CLINIC_CONTEXT',
        message: 'Lab portal requests must not carry clinic context headers',
      });
    }

    const memberships = await findLabMemberships(
      this.dataSource.manager,
      userId,
    );
    if (!memberships.length) {
      throw forbidden('LAB_ACCESS_DENIED', 'You are not a member of any lab');
    }

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(LAB_ANY_KEY, targets)) {
      return true;
    }

    const requested = headerValue(req.headers[LAB_ID_HEADER])?.trim();
    let membership = memberships[0];
    if (requested) {
      const found = isUUID(requested)
        ? memberships.find((m) => m.labId === requested)
        : undefined;
      if (!found) {
        throw forbidden(
          'LAB_ACCESS_DENIED',
          'You do not have access to this lab',
        );
      }
      membership = found;
    } else if (memberships.length > 1) {
      throw new BadRequestException({
        code: 'LAB_SELECTION_REQUIRED',
        message: `You work in several labs — send the ${LAB_ID_HEADER} header`,
      });
    }

    const roles = this.reflector.getAllAndOverride<LabMemberRole[]>(
      LAB_ROLES_KEY,
      targets,
    );
    if (roles?.length && !roles.includes(membership.role)) {
      throw forbidden(
        'FORBIDDEN',
        `This action needs one of these lab roles: ${roles.join(', ')}`,
      );
    }

    req.labActor = { userId, labId: membership.labId, role: membership.role };
    return true;
  }
}
