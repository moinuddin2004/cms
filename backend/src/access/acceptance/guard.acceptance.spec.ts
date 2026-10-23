import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_SUPER_ADMIN_KEY } from 'src/common/decorators/require-super-admin.decorator';
import { CONTEXT_FREE_KEY } from 'src/common/decorators/context-free.decorator';
import { AccessGuard } from '../access.guard';
import { AccessContext } from '../access-context';
import { ANY_MEMBER_KEY, CAN_KEY, Can } from '../decorators/access.decorators';
import type { PermissionMap } from '../catalog/permissions';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';
import { legacyRolesFromPermissions } from '../legacy-roles';
import { ROLE_TEMPLATES } from '../catalog/templates';

const ORG = '11111111-1111-1111-1111-111111111111';
const LOC = '22222222-2222-2222-2222-222222222222';

/** Acceptance GRD-03: class needs A, method needs B. */
@Can('billing.desk.use')
class ClassAndMethodController {
  @Can('billing.invoice.void')
  void() {}
}

function accessWith(permissions: PermissionMap) {
  return new AccessContext({
    userId: 'u1',
    organizationId: ORG,
    locationId: LOC,
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: null,
    features: [],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

describe('AC-GRD (unit)', () => {
  it('GRD-03 class + method merge: role has only B → 403 with missing = [A]', async () => {
    const request = {
      user: { uuid: 'u1' },
      headers: { 'x-organization-id': ORG, 'x-location-id': LOC },
    };
    const resolver = {
      resolve: () =>
        Promise.resolve(accessWith({ 'billing.invoice.void': true })),
    };
    const guard = new AccessGuard(new Reflector(), resolver as never);
    const context = {
      getType: () => 'http',
      getHandler: () => ClassAndMethodController.prototype.void,
      getClass: () => ClassAndMethodController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    let error: ForbiddenException | undefined;
    try {
      await guard.canActivate(context);
    } catch (e) {
      error = e as ForbiddenException;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    const body = error!.getResponse() as { code: string; missing: string[] };
    expect(body.code).toBe('NO_PERMISSION');
    expect(body.missing).toEqual(['billing.desk.use']);
  });

  /**
   * GRD-06 — stricter than access-coverage.spec.ts: a class-level
   * `@UseGuards(...)` does NOT count as "decorated"; only @Can, @AnyMember,
   * @Public, @RequireSuperAdmin, or the documented handler-checked
   * exemptions (@ContextFree on locations / user, plus the self-service
   * `/me/access` and `/feature-flags/my-features`).
   */
  const MODULE_DIRS = [
    'billing',
    'queue',
    'appointments',
    'encounters',
    'patients',
    'prescriptions',
    'plan-templates',
    'treatments',
    'inventory',
    'lab-access',
    'lab-billing',
    'lab-catalog',
    'lab-finance',
    'lab-orders',
    'lab-payables',
    'lab-production',
    'labs',
    'employees',
    'payroll',
    'reports',
    'notifications',
    'locations',
    'user',
    'access',
    'feature-flags',
    'settings-registry',
  ];
  const HANDLER_CHECKED = [
    'LocationsController.',
    'UserController.',
    'MeAccessController.getMyAccess',
    'FeatureFlagsController.getMyFeatures',
    // Self-service @ContextFree reads scoped to the signed-in user.
    'MyNotificationsController.',
    'OrderLinkController.resolve',
  ];

  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const full = join(dir, n);
      if (statSync(full).isDirectory()) return files(full);
      return n.endsWith('.controller.ts') ? [full] : [];
    });
  const has = (key: string, ...t: object[]) =>
    t.some((x) => Reflect.getMetadata(key, x) !== undefined);

  it('GRD-06 every handler is decorated (strict)', () => {
    const undecorated: string[] = [];
    let seen = 0;
    for (const dir of MODULE_DIRS) {
      for (const file of files(join(__dirname, '../..', dir))) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(file) as Record<string, unknown>;
        for (const ctrl of Object.values(mod)) {
          if (typeof ctrl !== 'function') continue;
          if (Reflect.getMetadata(PATH_METADATA, ctrl) === undefined) continue;
          const proto = (ctrl as { prototype: object }).prototype;
          for (const name of Object.getOwnPropertyNames(proto)) {
            const fn = (proto as Record<string, unknown>)[name];
            if (name === 'constructor' || typeof fn !== 'function') continue;
            if (Reflect.getMetadata(METHOD_METADATA, fn) === undefined) continue;
            seen++;
            const id = `${ctrl.name}.${name}`;
            const decorated =
              has(CAN_KEY, fn, ctrl) ||
              has(ANY_MEMBER_KEY, fn, ctrl) ||
              has(IS_PUBLIC_KEY, fn, ctrl) ||
              has(REQUIRE_SUPER_ADMIN_KEY, fn, ctrl);
            if (decorated) continue;
            const guardNames = [fn, ctrl].flatMap(
              (t) =>
                (
                  (Reflect.getMetadata(GUARDS_METADATA, t) as
                    | { name: string }[]
                    | undefined) ?? []
                ).map((g) => g.name),
            );
            // The lab portal is another trust domain: @LabPortalController =
            // @ContextFree + LabPortalGuard (a lab membership, never a clinic role).
            const exempt =
              has(CONTEXT_FREE_KEY, fn, ctrl) &&
              (HANDLER_CHECKED.some((p) => id.startsWith(p)) ||
                guardNames.includes('LabPortalGuard'));
            if (!exempt) {
              const path = Reflect.getMetadata(PATH_METADATA, fn) as string;
              const guards = [fn, ctrl].flatMap(
                (t) =>
                  (Reflect.getMetadata(GUARDS_METADATA, t) as
                    | { name: string }[]
                    | undefined) ?? [],
              );
              undecorated.push(
                `${id} (${path}) guards=[${guards.map((g) => g.name).join(',')}]`,
              );
            }
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(300);
    expect(undecorated.join('\n')).toBe('');
  });

  /** SEC-05 — no endpoint still sits on `@Roles`; the derivation helper stays fail-closed. */
  it('SEC-05 no handler uses @Roles; derived legacy roles: receptionist passes RECEPTIONIST, no role → none', () => {
    const roleGated: string[] = [];
    for (const file of files(join(__dirname, '../..'))) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(file) as Record<string, unknown>;
      for (const ctrl of Object.values(mod)) {
        if (typeof ctrl !== 'function') continue;
        if (Reflect.getMetadata(PATH_METADATA, ctrl) === undefined) continue;
        const proto = (ctrl as { prototype: object }).prototype;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const fn = (proto as Record<string, unknown>)[name];
          if (typeof fn !== 'function') continue;
          if (has(REQUIRED_ROLES_KEY, fn, ctrl)) {
            roleGated.push(`${ctrl.name}.${name}`);
          }
        }
      }
    }
    expect(roleGated).toEqual([]);

    const rec = ROLE_TEMPLATES.find((t) => t.key === 'receptionist')!;
    expect(legacyRolesFromPermissions(rec.permissions)).toContain(
      AppRole.RECEPTIONIST,
    );
    expect(legacyRolesFromPermissions({})).toEqual([]);
    expect(legacyRolesFromPermissions(null)).toEqual([]);
    expect(
      legacyRolesFromPermissions({ canManageSettings: true, canConsult: true }),
    ).toEqual([]);
  });
});
