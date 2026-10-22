import { HttpException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PermissionMap } from 'src/access/catalog/permissions';
import { testActor } from '../common/billing-access.testing';
import { BillingContext } from '../common/billing-context';
import { ChargeStatus } from '../enums/billing.enums';
import { Charge } from '../entities/charge.entity';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceEditHandlers } from './edit-operations/invoice-edit.handlers';
import { InvoiceEditContext } from './edit-operations/invoice-edit.types';
import { InvoicesService } from './invoices.service';
import type { ChargePricingService } from '../catalog/charge-pricing.service';
import type { DiscountApplier } from '../discounts/discount-applier.service';

const tenant = { organizationId: 'org-1', locationId: 'loc-1' };
const ctxWith = (perms: PermissionMap): BillingContext => ({
  tenant,
  actor: testActor(perms),
});

async function statusOf(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
  } catch (e) {
    return (e as HttpException).getStatus();
  }
  return undefined;
}

describe('billing.invoice.void', () => {
  /** InvoicesService with only a spy DataSource: a refused call never opens a transaction. */
  function service() {
    const transaction = jest.fn().mockResolvedValue(undefined);
    const svc = Object.assign(Object.create(InvoicesService.prototype), {
      dataSource: { transaction },
    }) as InvoicesService;
    return { svc, transaction };
  }

  it('cancelling an invoice is refused without billing.invoice.void', async () => {
    const { svc, transaction } = service();
    const ctx = ctxWith({
      'billing.desk.use': true,
      'billing.invoice.edit': true,
    });
    expect(await statusOf(svc.cancel(ctx, 'inv-1', 'Wrong patient'))).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('cancelling an invoice proceeds with billing.invoice.void', async () => {
    const { svc, transaction } = service();
    jest.spyOn(svc, 'detail').mockResolvedValue({} as never);
    const ctx = ctxWith({ 'billing.invoice.void': true });
    await svc.cancel(ctx, 'inv-1', 'Wrong patient');
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  describe('voidCharge edit operation', () => {
    const handlers = new InvoiceEditHandlers(
      {} as DiscountApplier,
      {} as ChargePricingService,
    );
    const editCtx = (perms: PermissionMap): InvoiceEditContext => {
      const charge = {
        id: 'ch-1',
        invoiceId: 'inv-1',
        status: ChargeStatus.ACTIVE,
        description: 'Scaling',
      } as Charge;
      return {
        manager: {} as EntityManager,
        ctx: ctxWith(perms),
        invoice: { id: 'inv-1' } as Invoice,
        charges: new Map([[charge.id, charge]]),
        reason: 'Charged twice',
        time: { now: new Date(), today: '2026-10-22', tz: 'Asia/Karachi' },
      } as InvoiceEditContext;
    };

    it('needs billing.invoice.void even with billing.invoice.edit', async () => {
      const ctx = editCtx({ 'billing.invoice.edit': true });
      expect(
        await statusOf(
          handlers.apply({ op: 'voidCharge', chargeId: 'ch-1' }, ctx),
        ),
      ).toBe(403);
      expect(ctx.charges.get('ch-1')!.status).toBe(ChargeStatus.ACTIVE);
    });

    it('voids the line with billing.invoice.void', async () => {
      const ctx = editCtx({
        'billing.invoice.edit': true,
        'billing.invoice.void': true,
      });
      await handlers.apply({ op: 'voidCharge', chargeId: 'ch-1' }, ctx);
      expect(ctx.charges.get('ch-1')!.status).toBe(ChargeStatus.VOID);
    });
  });

  it('every invoice edit needs billing.invoice.edit', async () => {
    const svc = Object.create(InvoicesService.prototype) as InvoicesService;
    expect(
      await statusOf(
        svc.runEdit(
          {} as EntityManager,
          ctxWith({ 'billing.invoice.view': 'location' }),
          {} as never,
          'inv-1',
          { expectedRevision: 1, operations: [] } as never,
          'reason',
        ),
      ),
    ).toBe(403);
  });
});
