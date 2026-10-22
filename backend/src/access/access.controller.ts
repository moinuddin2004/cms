import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Req,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import type { AppRequest } from 'src/common/types/app-request';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { AccessResolver, isUuid } from './access.resolver';
import type { AccessContext } from './access-context';
import {
  Grant,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSIONS,
  Permission,
  Scope,
  SCOPES,
} from './catalog/permissions';
import { BUNDLES } from './catalog/bundles';
import { ROLE_TEMPLATES } from './catalog/templates';
import { Can } from './decorators/access.decorators';
import { NavLayoutsService } from './nav/nav-layouts.service';
import type { NavLayoutJson } from './nav/nav-layout.types';

/** `GET /me/access` — the contract the web app builds on (sprint S2). */
export interface MeAccess {
  version: number;
  organizationId: string;
  locationId: string | null;
  isSuperAdmin: boolean;
  isOwner: boolean;
  /** Active feature keys. */
  features: string[];
  /** Granted only. */
  permissions: Record<string, Scope | true>;
  roles: { id: string; name: string; templateKey: string | null }[];
  employeeId: string | null;
  homeRoute: string | null;
  /** The clinic's sidebar layout; null = the web app's code default. Never grants access. */
  nav: NavLayoutJson | null;
}

export function toMeAccess(
  ctx: AccessContext,
  nav: NavLayoutJson | null = null,
): MeAccess {
  return {
    version: ctx.version,
    organizationId: ctx.organizationId,
    locationId: ctx.locationId,
    isSuperAdmin: ctx.isSuperAdmin,
    isOwner: ctx.isOwner,
    features: [...ctx.features],
    permissions: { ...ctx.permissions } as Record<string, Grant>,
    roles: ctx.roles.map((r) => ({ ...r })),
    employeeId: ctx.employeeId,
    homeRoute: ctx.homeRoute,
    nav,
  };
}

function header(req: AppRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

@Controller('me')
export class MeAccessController {
  constructor(
    private readonly resolver: AccessResolver,
    private readonly authorization: AuthorizationService,
    private readonly navLayouts: NavLayoutsService,
  ) {}

  /**
   * The caller's access in the org from `x-organization-id` and, when sent,
   * the location from `x-location-id` (without one, role permissions are
   * empty for staff — roles are per location). 400 without an org, 403 when
   * the caller has no access there.
   */
  @Get('access')
  @ContextFree() // location is optional here; membership is checked below
  async getMyAccess(@Req() req: AppRequest) {
    const userId = req.user?.uuid;
    const organizationId = header(req, 'x-organization-id');
    const rawLocation = header(req, 'x-location-id');
    if (!userId) throw new ForbiddenException('Not signed in');
    if (!isUuid(organizationId)) {
      throw new BadRequestException('x-organization-id header is required');
    }
    if (rawLocation && !isUuid(rawLocation)) {
      throw new BadRequestException('x-location-id must be a uuid');
    }
    const locationId = rawLocation ?? null;

    const allowed = locationId
      ? await this.authorization.validateAccess(
          userId,
          organizationId,
          locationId,
        )
      : await this.authorization.canAccessOrganization(userId, organizationId);
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have access to this organization/location',
      );
    }

    const [ctx, nav] = await Promise.all([
      this.resolver.resolve(userId, organizationId, locationId),
      this.navLayouts.clinicLayout(organizationId),
    ]);
    return ResponseWrapper.success(toMeAccess(ctx, nav), 'Access resolved');
  }
}

@Controller('access')
export class AccessCatalogController {
  /** Permission catalog by module, with bundles and role templates (roles screen). */
  @Get('catalog')
  @Can('admin.roles.manage')
  getCatalog() {
    const groups = PERMISSION_GROUPS.map((group) => ({
      group,
      permissions: PERMISSION_KEYS.filter(
        (k) => PERMISSIONS[k].group === group,
      ).map((key: Permission) => ({ key, ...PERMISSIONS[key] })),
      bundles: BUNDLES[group],
    }));
    return ResponseWrapper.success(
      { scopes: SCOPES, groups, templates: ROLE_TEMPLATES },
      'Access catalog retrieved',
    );
  }
}
