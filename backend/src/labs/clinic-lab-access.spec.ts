import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import {
  ANY_MEMBER_KEY,
  CAN_KEY,
} from 'src/access/decorators/access.decorators';
import { isPermission } from 'src/access/catalog/permissions';
import { REQUIRE_FEATURE_KEY } from 'src/common/decorators/require-feature.decorator';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { ClinicLabAccessController } from 'src/lab-access/controllers/clinic-lab-access.controller';
import { LabBillingController } from 'src/lab-billing/lab-billing.controller';
import { ClinicCatalogController } from 'src/lab-catalog/clinic/clinic-catalog.controller';
import { LabOrdersController } from 'src/lab-orders/controllers/lab-orders.controller';
import { LabPayablesController } from 'src/lab-payables/controllers/lab-payables.controller';
import {
  ClinicProductionController,
  ClinicShipmentsController,
} from 'src/lab-production/controllers/clinic-production.controller';
import { LabLinksController } from './links/lab-links.controller';
import { LAB_FEATURE } from './labs.constants';

/**
 * Every clinic-side lab controller. Not here on purpose: the lab portal
 * (`LabPortalGuard` / `@LabRoles`), platform routes (`@RequireSuperAdmin`),
 * the public magic-link routes and `order-links` (context-free QR resolver
 * with its own membership check).
 */
const CONTROLLERS = [
  LabLinksController,
  ClinicLabAccessController,
  ClinicCatalogController,
  LabOrdersController,
  ClinicProductionController,
  ClinicShipmentsController,
  LabBillingController,
  LabPayablesController,
] as const;

type Ctor = (typeof CONTROLLERS)[number];

interface Route {
  route: string;
  can: string[];
  anyMember: boolean;
  handler: (...args: unknown[]) => unknown;
  controller: Ctor;
}

function routesOf(controller: Ctor): Route[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const classCan =
    (Reflect.getMetadata(CAN_KEY, controller) as string[] | undefined) ?? [];
  const proto = controller.prototype as unknown as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((k) => k !== 'constructor' && typeof proto[k] === 'function')
    .map((k) => proto[k] as (...args: unknown[]) => unknown)
    .filter((h) => Reflect.getMetadata(PATH_METADATA, h) !== undefined)
    .map((handler) => {
      const method =
        RequestMethod[
          Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
        ];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const methodCan =
        (Reflect.getMetadata(CAN_KEY, handler) as string[] | undefined) ?? [];
      return {
        route: `${method} /${base}${path === '/' ? '' : `/${path}`}`,
        can: [...new Set([...classCan, ...methodCan])],
        anyMember: !!Reflect.getMetadata(ANY_MEMBER_KEY, handler),
        handler,
        controller,
      };
    });
}

const ROUTES = CONTROLLERS.flatMap(routesOf);

describe('clinic-side lab controllers → @Can', () => {
  it('finds the routes', () => {
    expect(ROUTES.length).toBeGreaterThan(80);
  });

  it.each(ROUTES.map((r) => [r.route, r] as const))(
    '%s has @Can or @AnyMember',
    (_route, r) => {
      expect(r.can.length > 0 || r.anyMember).toBe(true);
    },
  );

  it('uses only catalog permissions', () => {
    const unknown = ROUTES.flatMap((r) => r.can).filter(
      (p) => !isPermission(p),
    );
    expect(unknown).toEqual([]);
  });

  it('keeps no legacy @Roles', () => {
    const withRoles = ROUTES.filter(
      (r) =>
        Reflect.getMetadata(REQUIRED_ROLES_KEY, r.handler) !== undefined ||
        Reflect.getMetadata(REQUIRED_ROLES_KEY, r.controller) !== undefined,
    ).map((r) => r.route);
    expect(withRoles).toEqual([]);
  });

  it('keeps the lab feature gate on @AnyMember routes', () => {
    const ungated = ROUTES.filter(
      (r) =>
        r.anyMember &&
        !(
          (Reflect.getMetadata(REQUIRE_FEATURE_KEY, r.handler) as
            | string[]
            | undefined) ?? []
        ).includes(LAB_FEATURE),
    ).map((r) => r.route);
    expect(ungated).toEqual([]);
  });

  it('maps each area to its Lab permission', () => {
    const permsOf = (route: string) =>
      ROUTES.find((r) => r.route === route)?.can.sort();

    expect(permsOf('POST /lab-links')).toEqual(['lab.links.manage']);
    expect(permsOf('GET /lab-orders')).toEqual(['lab.orders.view']);
    expect(permsOf('POST /lab-orders')).toEqual(['lab.orders.create']);
    expect(permsOf('POST /lab-orders/:id/proxy/accept')).toEqual([
      'lab.links.manage',
      'lab.orders.create',
    ]);
    expect(permsOf('POST /lab-catalog/mappings')).toEqual([
      'lab.catalog.manage',
    ]);
    expect(permsOf('POST /lab-catalog/order-templates')).toEqual([
      'lab.orders.create',
    ]);
    expect(permsOf('GET /lab-billing/invoices')).toEqual([
      'lab.billing.manage',
    ]);
    expect(permsOf('POST /lab-billing/invoices/:id/void')).toEqual([
      'billing.invoice.void',
      'lab.billing.manage',
    ]);
    expect(permsOf('POST /lab-billing/refunds')).toEqual([
      'billing.refund.issue',
      'lab.billing.manage',
    ]);
    expect(permsOf('PATCH /lab-billing/settings')).toEqual([
      'admin.settings.manage',
      'lab.billing.manage',
    ]);
    expect(permsOf('GET /lab-payables/bills')).toEqual(['lab.payables.manage']);
    expect(permsOf('POST /lab-shipments/:id/receive')).toEqual([
      'lab.orders.view',
    ]);
  });
});
