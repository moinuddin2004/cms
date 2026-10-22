import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { AccessContext } from 'src/access/access-context';
import type { PermissionMap } from 'src/access/catalog/permissions';
import { stripHiddenFields } from 'src/access/visible-if/visible-if';
import { Treatment } from 'src/treatments/entities/treatment.entity';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { TreatmentPlanItem } from 'src/patients/entities/treatment-plan-item.entity';
import { HideTreatmentPricesInterceptor } from './hide-treatment-prices.interceptor';

function access(permissions: PermissionMap) {
  return new AccessContext({
    userId: 'u1',
    organizationId: 'org1',
    locationId: 'loc1',
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: 'emp1',
    features: [],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

/** A history-shaped plain-object body (what the interceptor exists for). */
const body = () => ({
  data: {
    encounters: [{ treatments: [{ treatmentName: 'RCT', cost: 5000 }] }],
    standaloneTreatments: [{ treatmentName: 'Scaling', cost: 1500 }],
    invoice: { total: 9000 }, // not treatment-shaped: untouched
  },
});

async function run(req: { access?: AccessContext }) {
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(body()) };
  return firstValueFrom(
    new HideTreatmentPricesInterceptor().intercept(ctx, next),
  ) as Promise<ReturnType<typeof body>>;
}

describe('HideTreatmentPricesInterceptor', () => {
  it('keeps prices for holders of patients.price.view', async () => {
    const out = await run({
      access: access({ 'patients.price.view': true }),
    });
    expect(out.data.encounters[0].treatments[0].cost).toBe(5000);
    expect(out.data.standaloneTreatments[0].cost).toBe(1500);
  });

  it('strips every treatment cost without it (e.g. the Doctor template)', async () => {
    const out = await run({
      access: access({
        'patients.clinical.view': true,
        'patients.view': 'own',
      }),
    });
    expect(out.data.encounters[0].treatments[0]).not.toHaveProperty('cost');
    expect(out.data.standaloneTreatments[0]).not.toHaveProperty('cost');
    expect(out.data.invoice.total).toBe(9000);
  });

  it('strips them when the request has no AccessContext (fail-closed)', async () => {
    const out = await run({});
    expect(out.data.standaloneTreatments[0]).not.toHaveProperty('cost');
  });
});

describe('@VisibleIf price fields on entities', () => {
  const rows = () => {
    const t = Object.assign(new Treatment(), {
      treatmentName: 'RCT',
      cost: 5000,
    });
    const plan = Object.assign(new PatientTreatmentPlan(), {
      title: 'Plan',
      estimatedCost: 10000,
      discountAmount: 500,
      finalEstimatedCost: 9500,
    });
    const item = Object.assign(new TreatmentPlanItem(), {
      procedureName: 'Crown',
      estimatedCost: 4000,
    });
    return { t, plan, item };
  };

  it('hides them without patients.price.view', () => {
    const r = rows();
    const can = access({ 'plans.manage': true });
    stripHiddenFields(r, (p) => can.can(p));
    expect(r.t).not.toHaveProperty('cost');
    expect(r.plan).not.toHaveProperty('estimatedCost');
    expect(r.plan).not.toHaveProperty('discountAmount');
    expect(r.plan).not.toHaveProperty('finalEstimatedCost');
    expect(r.item).not.toHaveProperty('estimatedCost');
    expect(r.item.procedureName).toBe('Crown');
  });

  it('keeps them with it', () => {
    const r = rows();
    const can = access({ 'patients.price.view': true });
    stripHiddenFields(r, (p) => can.can(p));
    expect(r.t.cost).toBe(5000);
    expect(r.plan.finalEstimatedCost).toBe(9500);
    expect(r.item.estimatedCost).toBe(4000);
  });
});
