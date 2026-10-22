import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  ANY_MEMBER_KEY,
  CAN_KEY,
} from 'src/access/decorators/access.decorators';
import { isPermission } from 'src/access/catalog/permissions';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { REQUIRE_FEATURE_KEY } from 'src/common/decorators/require-feature.decorator';
import { EmployeesController } from 'src/employees/employees.controller';
import { ScheduleController } from 'src/employees/schedule.controller';
import { AvailabilityOverrideController } from 'src/employees/availability-override.controller';
import { LeaveController } from 'src/employees/leave.controller';
import { PayrollController } from 'src/payroll/payroll.controller';
import { NotificationSettingsController } from 'src/notifications/controllers/notification-settings.controller';
import { LocationsController } from 'src/locations/locations.controller';
import { UserController } from 'src/user/user.controller';
import { ReportsController } from './reports.controller';

/**
 * Sprint M5 (team, reports, notifications, admin): every route handler is
 * decorated with `@Can` / `@AnyMember`, and no legacy `@Roles` /
 * `@RequireFeature` is left. The two context-free admin controllers check
 * in the handler instead (their own specs cover that) and are listed here
 * so a new handler there is a conscious choice.
 */
type Ctor = { prototype: object; name: string };

const DECORATED: Ctor[] = [
  EmployeesController,
  ScheduleController,
  AvailabilityOverrideController,
  LeaveController,
  PayrollController,
  ReportsController,
  NotificationSettingsController,
];

/** Handlers that authorize in code (no tenant headers → no AccessGuard). */
const CHECKED_IN_HANDLER: Record<string, string[]> = {
  // admin.locations.manage in the org of the location acted on
  LocationsController: [
    'create',
    'findAll',
    'findOne',
    'update',
    'deactivate',
    'getSettings',
    'updateSettings',
  ],
  // admin.users.manage (super admins work without an org); `getMe` = any signed-in user
  UserController: [
    'getMe',
    'getUsers',
    'createUser',
    'updateUser',
    'deleteUser',
  ],
};

const reflector = new Reflector();

function handlers(ctor: Ctor): string[] {
  const proto = ctor.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).filter((name) => {
    if (name === 'constructor') return false;
    const fn = proto[name];
    return (
      typeof fn === 'function' &&
      Reflect.getMetadata(METHOD_METADATA, fn) !== undefined &&
      Reflect.getMetadata(PATH_METADATA, fn) !== undefined
    );
  });
}

describe('M5 controllers: access decorators', () => {
  it.each(DECORATED.map((c) => [c.name, c] as const))(
    '%s: every handler has @Can or @AnyMember with catalog keys',
    (_name, ctor) => {
      const names = handlers(ctor);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        const fn = (ctor.prototype as Record<string, () => unknown>)[name];
        const perms = reflector.getAllAndMerge<string[]>(CAN_KEY, [
          fn,
          ctor as unknown as () => unknown,
        ]);
        const anyMember = reflector.getAllAndOverride<boolean>(ANY_MEMBER_KEY, [
          fn,
          ctor as unknown as () => unknown,
        ]);
        expect({
          handler: name,
          decorated: perms.length > 0 || !!anyMember,
        }).toEqual({ handler: name, decorated: true });
        for (const p of perms) expect(isPermission(p)).toBe(true);
      }
    },
  );

  it.each(
    [...DECORATED, LocationsController, UserController].map(
      (c) => [c.name, c] as const,
    ),
  )('%s: no legacy @Roles / @RequireFeature left', (_name, ctor) => {
    const targets = [
      ctor,
      ...handlers(ctor).map(
        (n) => (ctor.prototype as Record<string, () => unknown>)[n],
      ),
    ];
    for (const t of targets) {
      expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, t)).toBeUndefined();
      expect(Reflect.getMetadata(REQUIRE_FEATURE_KEY, t)).toBeUndefined();
    }
  });

  it.each(Object.entries(CHECKED_IN_HANDLER))(
    '%s: the in-handler list matches the routes',
    (name, expected) => {
      const ctor =
        name === 'LocationsController' ? LocationsController : UserController;
      expect(handlers(ctor).sort()).toEqual([...expected].sort());
    },
  );

  it('maps each area to its permission', () => {
    const can = (ctor: Ctor, name: string) =>
      reflector.getAllAndMerge<string[]>(CAN_KEY, [
        (ctor.prototype as Record<string, () => unknown>)[name],
        ctor as unknown as () => unknown,
      ]);
    expect(can(EmployeesController, 'findAll')).toEqual(['employees.view']);
    expect(can(EmployeesController, 'create')).toEqual(['employees.manage']);
    expect(can(LeaveController, 'approve')).toEqual(['leave.approve']);
    expect(can(PayrollController, 'generate')).toEqual(['payroll.manage']);
    expect(can(ReportsController, 'financeOverview')).toEqual([
      'finance.overview.view',
    ]);
    expect(can(ReportsController, 'clinicOverview')).toEqual([
      'reports.clinical.view',
    ]);
    expect(can(ReportsController, 'export')).toEqual(['reports.export']);
    expect(can(NotificationSettingsController, 'overview')).toEqual([
      'notifications.settings.manage',
    ]);
  });
});
