import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  BillingFixture,
  Clinic,
  TEST_USER_HEADER,
  Who,
  createBillingFixture,
} from './billing-it.harness';

/** Plan 12.2 S15 + 10.3/10.4: doctors get 403 everywhere, other tenants' ids are 404. */
describe('Billing integration — roles and tenant isolation (API)', () => {
  let fx: BillingFixture;
  let other: {
    patientId: string;
    chargeId: string;
    invoiceId: string;
    paymentId: string;
  };

  beforeAll(async () => {
    fx = await createBillingFixture();
    const B = fx.clinicB;
    const patientId = await fx.newPatient(B);
    const charge = await fx.addCharge(B, patientId, {
      description: 'B treatment',
      unitPrice: 1000,
    });
    const paid = await fx.collect(B, patientId, {
      amount: 1000,
      selections: [{ chargeId: charge.id }],
    });
    const open = await fx.addCharge(B, patientId, {
      description: 'B open',
      unitPrice: 500,
    });
    other = {
      patientId,
      chargeId: open.id,
      invoiceId: paid.invoiceId!,
      paymentId: paid.payment!.id,
    };
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  const call = (
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    as: { clinic: Clinic; who: Who },
    body?: object,
    headersFrom: Clinic = as.clinic,
  ) =>
    request(fx.app.getHttpServer())
      [method](url)
      .set(TEST_USER_HEADER, as.clinic.people[as.who].userId)
      .set('x-organization-id', headersFrom.tenant.organizationId)
      .set('x-location-id', headersFrom.tenant.locationId)
      .send(body);

  const id = () => randomUUID();

  it('a doctor is rejected with 403 on every billing route', async () => {
    const A = fx.clinicA;
    const p = id();
    const routes: Array<
      ['get' | 'post' | 'patch' | 'delete', string, object?]
    > = [
      ['get', '/billing/services'],
      [
        'post',
        '/billing/services',
        { name: 'x', kind: 'PROCEDURE', defaultPrice: 1 },
      ],
      ['get', '/billing/settings'],
      ['patch', '/billing/settings', { dueDays: 3 }],
      ['get', '/billing/payment-accounts'],
      ['get', '/billing/discount-types'],
      ['get', '/billing/ready-to-bill'],
      ['get', `/billing/outstanding?patientIds=${p}`],
      ['get', '/billing/cash-close/preview'],
      ['get', '/billing/activity'],
      ['get', '/billing/reports/doctor-revenue'],
      ['get', `/patients/${p}/charges`],
      ['post', `/patients/${p}/charges`, { description: 'x', unitPrice: 1 }],
      ['get', `/patients/${p}/billing/summary`],
      ['get', `/patients/${p}/billing/statement`],
      [
        'post',
        `/patients/${p}/advance/apply`,
        { mode: 'AUTO', selections: [] },
      ],
      ['patch', `/charges/${id()}`, { quantity: 2 }],
      ['post', `/charges/${id()}/void`, { reason: 'reason!' }],
      ['get', '/invoices'],
      ['get', `/invoices/${id()}`],
      ['post', '/invoices', { patientId: p, chargeIds: [id()] }],
      ['post', `/invoices/${id()}/cancel`, { reason: 'reason!' }],
      ['get', '/payments'],
      ['get', `/payments/${id()}`],
      [
        'post',
        '/payments/preview',
        {
          patientId: p,
          amount: 1,
          applyAdvance: true,
          mode: 'AUTO',
          selections: [],
        },
      ],
      ['post', `/payments/${id()}/unapply`, { reason: 'reason!' }],
      [
        'post',
        '/refunds',
        {
          patientId: p,
          amount: 1,
          paymentAccountId: id(),
          reason: 'reason!',
          clientRequestId: id(),
        },
      ],
      ['get', '/refunds'],
      ['get', `/print/invoices/${id()}`],
      ['get', `/treatment-plans/${id()}/billing-summary`],
    ];
    const failures: string[] = [];
    for (const [method, url, body] of routes) {
      const res = await call(method, url, { clinic: A, who: 'doctor' }, body);
      if (res.status !== 403)
        failures.push(`${method.toUpperCase()} ${url} -> ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('a user of another organization cannot switch into this clinic (403)', async () => {
    const res = await call(
      'get',
      '/invoices',
      { clinic: fx.clinicA, who: 'admin' },
      undefined,
      fx.clinicB,
    );
    expect(res.status).toBe(403);
  });

  it("clinic A's admin gets 404 (never 403) for clinic B's records", async () => {
    const as = { clinic: fx.clinicA, who: 'admin' as Who };
    const cases: Array<['get' | 'post', string, object?]> = [
      ['get', `/invoices/${other.invoiceId}`],
      [
        'post',
        `/invoices/${other.invoiceId}/cancel`,
        { reason: 'Not mine to cancel' },
      ],
      [
        'post',
        `/invoices/${other.invoiceId}/edit`,
        {
          expectedRevision: 1,
          reason: 'Not mine to edit',
          operations: [{ op: 'voidCharge', chargeId: other.chargeId }],
        },
      ],
      ['get', `/payments/${other.paymentId}`],
      [
        'post',
        `/payments/${other.paymentId}/unapply`,
        { reason: 'Not mine to unapply' },
      ],
      ['get', `/patients/${other.patientId}/billing/summary`],
      ['get', `/patients/${other.patientId}/charges`],
      [
        'post',
        `/patients/${other.patientId}/charges`,
        { description: 'Not mine', unitPrice: 5 },
      ],
      [
        'post',
        `/charges/${other.chargeId}/void`,
        { reason: 'Not mine to void' },
      ],
      ['get', `/print/invoices/${other.invoiceId}`],
      [
        'post',
        '/payments',
        {
          patientId: other.patientId,
          amount: 100,
          paymentAccountId: fx.clinicA.cashAccountId,
          applyAdvance: true,
          mode: 'AUTO',
          selections: [],
          clientRequestId: id(),
        },
      ],
      [
        'post',
        '/refunds',
        {
          patientId: other.patientId,
          amount: 100,
          paymentAccountId: fx.clinicA.cashAccountId,
          reason: 'Not my patient',
          clientRequestId: id(),
        },
      ],
    ];
    const failures: string[] = [];
    for (const [method, url, body] of cases) {
      const res = await call(method, url, as, body);
      const code = (res.body?.error?.code ?? res.body?.code) as
        | string
        | undefined;
      if (res.status !== 404 || (code && code !== 'BILLING_NOT_FOUND'))
        failures.push(
          `${method.toUpperCase()} ${url} -> ${res.status} ${code ?? ''}`,
        );
    }
    expect(failures).toEqual([]);
    expect(await fx.violations(fx.clinicB, other.patientId)).toEqual([]);
  });

  it('reception reaches the billing API; admin-only routes stay admin-only', async () => {
    const reception = { clinic: fx.clinicA, who: 'reception' as Who };
    const reads = [
      '/invoices',
      '/invoices/stats',
      '/payments',
      '/payments/daily-collection',
      '/refunds',
      '/billing/payment-accounts',
      '/billing/ready-to-bill',
      '/billing/cash-close',
      '/billing/cash-close/preview',
    ];
    const notOk: string[] = [];
    for (const url of reads) {
      const res = await call('get', url, reception);
      if (res.status !== 200) notOk.push(`GET ${url} -> ${res.status}`);
    }
    expect(notOk).toEqual([]);
    expect(
      (await call('get', '/billing/payment-accounts', reception)).status,
    ).toBe(200);
    expect((await call('get', '/billing/activity', reception)).status).toBe(
      403,
    );
    expect(
      (
        await call('post', '/billing/services', reception, {
          name: 'x',
          kind: 'PROCEDURE',
          defaultPrice: 1,
        })
      ).status,
    ).toBe(403);
  });
});
