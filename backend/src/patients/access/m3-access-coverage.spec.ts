import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  ANY_MEMBER_KEY,
  CAN_KEY,
} from 'src/access/decorators/access.decorators';
import { isPermission } from 'src/access/catalog/permissions';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { CONTEXT_FREE_KEY } from 'src/common/decorators/context-free.decorator';
import { PatientsController } from '../patients.controller';
import { PrescriptionController } from 'src/prescriptions/controllers/prescription.controller';
import { DoctorSignatureController } from 'src/prescriptions/controllers/doctor-signature.controller';
import { MedicineDirectoryController } from 'src/prescriptions/controllers/medicine-directory.controller';
import { PrescriptionTemplateController } from 'src/prescriptions/controllers/prescription-template.controller';
import { TreatmentPlanTemplateController } from 'src/prescriptions/controllers/treatment-plan-template.controller';
import { PlanTemplatesController } from 'src/plan-templates/plan-templates.controller';
import { TreatmentsController } from 'src/treatments/treatments.controller';
import { InventoryController } from 'src/inventory/controllers/inventory.controller';
import { ConsumptionTemplateController } from 'src/inventory/controllers/consumption-template.controller';
import { PatientConsumptionController } from 'src/inventory/controllers/patient-consumption.controller';
import { PurchaseOrderController } from 'src/inventory/controllers/purchase-order.controller';
import { SupplierController } from 'src/inventory/controllers/supplier.controller';
import { UserController } from 'src/user/user.controller';

/** Every controller of sprint M3 (patients, prescriptions, plans, treatments, inventory, user). */
const CONTROLLERS: Array<abstract new (...args: never[]) => unknown> = [
  PatientsController,
  PrescriptionController,
  DoctorSignatureController,
  MedicineDirectoryController,
  PrescriptionTemplateController,
  TreatmentPlanTemplateController,
  PlanTemplatesController,
  TreatmentsController,
  InventoryController,
  ConsumptionTemplateController,
  PatientConsumptionController,
  PurchaseOrderController,
  SupplierController,
  UserController,
];

interface Endpoint {
  route: string;
  /** `@Can` permissions (class + method), or the marker that opens it. */
  access: string;
}

const reflector = new Reflector();

function endpointsOf(ctrl: (typeof CONTROLLERS)[number]): Endpoint[] {
  const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) ?? '');
  const proto = ctrl.prototype as Record<string, unknown>;
  const out: Endpoint[] = [];
  for (const name of Object.getOwnPropertyNames(proto)) {
    const handler = proto[name];
    if (name === 'constructor' || typeof handler !== 'function') continue;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as
      | RequestMethod
      | undefined;
    if (method === undefined) continue; // private helper, not a route
    const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
    const route = `${RequestMethod[method]} /${[base, path].filter((p) => p && p !== '/').join('/')}`;

    const targets = [handler, ctrl];
    const perms = [
      ...new Set(
        (reflector.getAllAndMerge<string[]>(CAN_KEY, targets) ?? []).flat(),
      ),
    ];
    const marker = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)
      ? '@Public'
      : reflector.getAllAndOverride<boolean>(ANY_MEMBER_KEY, targets)
        ? '@AnyMember'
        : reflector.getAllAndOverride<boolean>(CONTEXT_FREE_KEY, targets)
          ? '@ContextFree'
          : '';
    out.push({ route, access: perms.length ? perms.join(' + ') : marker });
  }
  return out;
}

const ALL = CONTROLLERS.flatMap(endpointsOf);
const accessOf = (route: string) => ALL.find((e) => e.route === route)?.access;

describe('M3 access coverage', () => {
  it('finds every route (sanity)', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(120);
  });

  it('every handler has @Can, @AnyMember, @Public or is authenticated-only', () => {
    expect(ALL.filter((e) => !e.access).map((e) => e.route)).toEqual([]);
  });

  it('only uses catalog permissions', () => {
    const used = ALL.flatMap((e) =>
      e.access.startsWith('@') ? [] : e.access.split(' + '),
    );
    expect(used.filter((p) => !isPermission(p))).toEqual([]);
  });

  it.each([
    ['GET /patients', 'patients.view'],
    ['GET /patients/:id', 'patients.view'],
    ['POST /patients', 'patients.create'],
    ['PUT /patients/:id', 'patients.edit'],
    ['DELETE /patients/:id', 'patients.delete'],
    ['POST /patients/:id/vitals', 'patients.clinical.edit'],
    ['POST /patients/:id/teeth-charts', 'patients.chart.edit'],
    ['POST /patients/:id/documents', 'patients.documents.manage'],
    ['POST /patients/:id/treatment-plans', 'plans.manage'],
    ['POST /plan-templates', 'plans.templates.manage'],
    ['POST /prescriptions', 'prescriptions.create'],
    ['GET /prescriptions/:id/pdf', 'patients.clinical.view'],
    ['POST /medicine-directory', 'prescriptions.library.manage'],
    ['GET /medicine-directory/search', '@AnyMember'],
    ['POST /treatments', 'patients.clinical.edit'],
    ['POST /inventory/items/:id/adjust-stock', 'inventory.stock.adjust'],
    ['POST /purchase-orders/:id/receive', 'inventory.po.manage'],
    ['GET /suppliers', 'inventory.view'],
    ['GET /user/me', '@ContextFree'],
  ])('%s → %s', (route, access) => {
    expect(accessOf(route)).toBe(access);
  });
});
