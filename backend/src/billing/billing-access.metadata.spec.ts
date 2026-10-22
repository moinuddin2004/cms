import 'reflect-metadata';
import { RequestMethod, Type } from '@nestjs/common';
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import {
  ANY_MEMBER_KEY,
  CAN_KEY,
} from 'src/access/decorators/access.decorators';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { BillingModule } from './billing.module';

/** "METHOD /path" → the merged class + method `@Can` list (or `@AnyMember`). */
function billingRoutes(): Record<string, string[] | 'any-member'> {
  const controllers = Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    BillingModule,
  ) as Type[];
  const out: Record<string, string[] | 'any-member'> = {};
  for (const ctrl of controllers) {
    const base = (Reflect.getMetadata(PATH_METADATA, ctrl) as string) ?? '';
    const classCan = (Reflect.getMetadata(CAN_KEY, ctrl) as string[]) ?? [];
    const classMember = !!Reflect.getMetadata(ANY_MEMBER_KEY, ctrl);
    const proto = ctrl.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as
        | string
        | undefined;
      if (path === undefined) continue;
      const method =
        RequestMethod[
          Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
        ];
      const url = ['', base, path]
        .join('/')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');
      const can = [
        ...new Set([
          ...classCan,
          ...((Reflect.getMetadata(CAN_KEY, handler) as string[]) ?? []),
        ]),
      ].sort();
      const member =
        classMember || !!Reflect.getMetadata(ANY_MEMBER_KEY, handler);
      out[`${method} ${url}`] = can.length ? can : member ? 'any-member' : [];
    }
  }
  return out;
}

/** The billing endpoint → permission table (see the M1 report). */
const EXPECTED: Record<string, string[] | 'any-member'> = {
  // Billing configuration
  'GET /billing/services': ['billing.desk.use'],
  'POST /billing/services': ['admin.settings.manage'],
  'PATCH /billing/services/:serviceId': ['admin.settings.manage'],
  'GET /billing/services/:serviceId/resolved-price': ['billing.desk.use'],
  'GET /billing/service-prices': ['admin.settings.manage'],
  'POST /billing/service-prices': ['admin.settings.manage'],
  'PATCH /billing/service-prices/:id': ['admin.settings.manage'],
  'DELETE /billing/service-prices/:id': ['admin.settings.manage'],
  'GET /billing/settings': ['billing.desk.use'],
  'PATCH /billing/settings': ['admin.settings.manage'],
  'GET /billing/payment-accounts': ['billing.desk.use'],
  'POST /billing/payment-accounts': ['admin.settings.manage'],
  'PATCH /billing/payment-accounts/:id': ['admin.settings.manage'],
  'GET /billing/discount-types': ['billing.discount.apply'],
  'POST /billing/discount-types': ['admin.settings.manage'],
  'PATCH /billing/discount-types/:id': ['admin.settings.manage'],
  // Charges (billing desk)
  'GET /patients/:patientId/charges': ['billing.desk.use'],
  'POST /patients/:patientId/charges': ['billing.desk.use'],
  'POST /patients/:patientId/charges/from-treatment-plan/:planId': [
    'billing.desk.use',
  ],
  'PATCH /charges/:chargeId': ['billing.desk.use'],
  'POST /charges/discount/bulk': ['billing.desk.use', 'billing.discount.apply'],
  'POST /charges/:chargeId/discount': [
    'billing.desk.use',
    'billing.discount.apply',
  ],
  'DELETE /charges/:chargeId/discount': [
    'billing.desk.use',
    'billing.discount.apply',
  ],
  'POST /charges/:chargeId/void': ['billing.desk.use'],
  'GET /billing/ready-to-bill': ['billing.desk.use'],
  // Invoices
  'GET /invoices': ['billing.invoice.view'],
  'GET /invoices/stats': ['billing.invoice.view'],
  'GET /invoices/:invoiceId': ['billing.invoice.view'],
  'GET /invoices/:invoiceId/revisions/:revision': ['billing.invoice.view'],
  'POST /invoices': ['billing.desk.use'],
  'POST /invoices/:invoiceId/edit/preview': ['billing.invoice.edit'],
  'POST /invoices/:invoiceId/edit': ['billing.invoice.edit'],
  'POST /invoices/:invoiceId/cancel': ['billing.invoice.void'],
  'POST /invoices/:invoiceId/refund': ['billing.refund.issue'],
  // Payments and refunds
  'POST /payments/preview': ['billing.payment.collect'],
  'POST /payments': ['billing.payment.collect'],
  'GET /payments': ['billing.invoice.view'],
  'GET /payments/daily-collection': ['billing.desk.use'],
  'GET /payments/:paymentId': ['billing.invoice.view'],
  'POST /payments/:paymentId/unapply': ['billing.invoice.edit'],
  'POST /patients/:patientId/advance/apply': ['billing.payment.collect'],
  'POST /refunds': ['billing.refund.issue'],
  'GET /refunds': ['billing.invoice.view'],
  'GET /refunds/:refundId': ['billing.invoice.view'],
  // Patient billing, cash close, reports, activity
  'GET /patients/:patientId/billing/summary': ['billing.invoice.view'],
  'GET /patients/:patientId/billing/open-charges': ['billing.invoice.view'],
  'GET /patients/:patientId/billing/statement': ['billing.invoice.view'],
  'GET /billing/outstanding': ['billing.invoice.view'],
  'GET /billing/cash-close/preview': ['billing.cash_close'],
  'POST /billing/cash-close': ['billing.cash_close'],
  'GET /billing/cash-close': ['billing.cash_close'],
  'GET /billing/cash-close/:id': ['billing.cash_close'],
  'GET /billing/reports/doctor-revenue': ['reports.financial.view'],
  'GET /treatment-plans/:planId/billing-summary': ['billing.invoice.view'],
  'GET /billing/activity': ['billing.activity.view'],
  // Print
  'GET /print/invoices/:invoiceId': ['billing.invoice.view'],
  'GET /print/payments/:paymentId': ['billing.invoice.view'],
  'GET /print/refunds/:refundId': ['billing.invoice.view'],
  'GET /print/patients/:patientId/statement': ['billing.invoice.view'],
  'GET /print/cash-close/:id': ['billing.cash_close', 'billing.invoice.view'],
  // Expenses
  'POST /expenses': ['expenses.manage'],
  'GET /expenses': ['expenses.view'],
  'GET /expenses/summary': ['expenses.view'],
  'PATCH /expenses/:id': ['expenses.manage'],
  'DELETE /expenses/:id': ['expenses.manage'],
  // Financial summary (feature billing.financial_summary stays checked)
  'GET /financial-summary/daily': ['reports.financial.view'],
  'GET /financial-summary/monthly': ['reports.financial.view'],
  'GET /financial-summary/trend': ['reports.financial.view'],
  // Credit packages (feature billing.credit_packages stays checked)
  'POST /credit-packages': ['admin.settings.manage'],
  'GET /credit-packages': ['billing.desk.use'],
  'PATCH /credit-packages/:id': ['admin.settings.manage'],
  'DELETE /credit-packages/:id': ['admin.settings.manage'],
  'POST /patients/:patientId/credits': ['billing.payment.collect'],
  'GET /patients/:patientId/credits': ['billing.desk.use'],
  'POST /patients/:patientId/credits/:creditId/use': [
    'billing.payment.collect',
  ],
  // Commissions
  'GET /assignments/:assignmentId/compensation-plans': ['compensation.manage'],
  'POST /assignments/:assignmentId/compensation-plans': ['compensation.manage'],
  'PUT /compensation-plans/:planId/rules': ['compensation.manage'],
  'GET /commissions': ['earnings.all.view'],
  'GET /reports/doctor-earnings': ['earnings.all.view'],
  'GET /me/earnings': ['earnings.own.view'],
};

describe('Billing endpoints — access metadata', () => {
  const routes = billingRoutes();

  it('every billing handler declares @Can or @AnyMember', () => {
    const open = Object.entries(routes)
      .filter(([, perms]) => perms !== 'any-member' && !perms.length)
      .map(([route]) => route);
    expect(open).toEqual([]);
  });

  it('matches the endpoint → permission table', () => {
    expect(routes).toEqual(EXPECTED);
  });

  it('no billing controller still uses the legacy @Roles', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      BillingModule,
    ) as Type[];
    const legacy = controllers.flatMap((ctrl) => {
      const proto = ctrl.prototype as Record<string, object>;
      const targets = [
        ctrl,
        ...Object.getOwnPropertyNames(proto).map((n) => proto[n]),
      ];
      return targets.some(
        (t) =>
          typeof t === 'function' &&
          Reflect.getMetadata(REQUIRED_ROLES_KEY, t) !== undefined,
      )
        ? [ctrl.name]
        : [];
    });
    expect(legacy).toEqual([]);
  });
});
