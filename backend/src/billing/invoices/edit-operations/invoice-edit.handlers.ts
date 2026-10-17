import { Injectable } from '@nestjs/common';
import { ChargePricingService } from '../../catalog/charge-pricing.service';
import { BillingContext } from '../../common/billing-context';
import { billingError } from '../../common/billing-errors';
import { BillingLookups } from '../../common/billing-lookups';
import { Charge } from '../../entities/charge.entity';
import { ChargeStatus } from '../../enums/billing.enums';
import { DiscountApplier } from '../../discounts/discount-applier.service';
import {
  clearDiscount,
  recalcCharge,
  voidCharge,
} from '../../charges/charge-math';
import { ChargeDraftFactory } from '../../charges/sources/charge-draft.factory';
import {
  InvoiceEditContext,
  InvoiceEditHandlerRegistry,
  InvoiceEditOperation,
  InvoiceEditOperationHandler,
  InvoiceEditOperationInput,
} from './invoice-edit.types';

type Op<K extends InvoiceEditOperation['op']> = Extract<
  InvoiceEditOperation,
  { op: K }
>;

const missing = (op: string, field: string) =>
  billingError('BILLING_CHARGE_INVALID', `${op}: ${field} is required`);

function required<T>(
  value: T | undefined | null,
  op: string,
  field: string,
): T {
  if (value === undefined || value === null) throw missing(op, field);
  return value;
}

/** An ACTIVE charge that is on this invoice. */
function chargeOnInvoice(ctx: InvoiceEditContext, chargeId: string): Charge {
  const charge = ctx.charges.get(chargeId);
  if (!charge || charge.invoiceId !== ctx.invoice.id) {
    throw billingError('BILLING_NOT_FOUND', 'Charge is not on this invoice');
  }
  if (charge.status !== ChargeStatus.ACTIVE) {
    throw billingError(
      'BILLING_CHARGE_NOT_OPEN',
      `${charge.description} is already void`,
    );
  }
  return charge;
}

/** D5: reception may price only "Other" charges (or ones still needing a price). */
function assertCanSetPrice(
  actor: BillingContext['actor'],
  charge: Charge,
): void {
  if (actor.isAdmin || !charge.serviceId || charge.needsPricing) return;
  throw billingError(
    'BILLING_PRICE_CHANGE_NOT_ALLOWED',
    'Only an admin can change a catalog price',
  );
}

class UpdateQuantityHandler
  implements InvoiceEditOperationHandler<Op<'updateQuantity'>>
{
  readonly op = 'updateQuantity' as const;
  parse(i: InvoiceEditOperationInput): Op<'updateQuantity'> {
    return {
      op: this.op,
      chargeId: required(i.chargeId, this.op, 'chargeId'),
      quantity: required(i.quantity, this.op, 'quantity'),
    };
  }
  apply(cmd: Op<'updateQuantity'>, ctx: InvoiceEditContext): void {
    const charge = chargeOnInvoice(ctx, cmd.chargeId);
    charge.quantity = cmd.quantity;
    recalcCharge(charge);
  }
}

class SetUnitPriceHandler
  implements InvoiceEditOperationHandler<Op<'setUnitPrice'>>
{
  readonly op = 'setUnitPrice' as const;
  parse(i: InvoiceEditOperationInput): Op<'setUnitPrice'> {
    return {
      op: this.op,
      chargeId: required(i.chargeId, this.op, 'chargeId'),
      unitPrice: required(i.unitPrice, this.op, 'unitPrice'),
    };
  }
  apply(cmd: Op<'setUnitPrice'>, ctx: InvoiceEditContext): void {
    const charge = chargeOnInvoice(ctx, cmd.chargeId);
    assertCanSetPrice(ctx.ctx.actor, charge);
    charge.unitPrice = cmd.unitPrice;
    charge.needsPricing = false;
    recalcCharge(charge);
  }
}

class SetDiscountHandler
  implements InvoiceEditOperationHandler<Op<'setDiscount'>>
{
  readonly op = 'setDiscount' as const;
  constructor(private readonly discounts: DiscountApplier) {}
  parse(i: InvoiceEditOperationInput): Op<'setDiscount'> {
    return {
      op: this.op,
      chargeId: required(i.chargeId, this.op, 'chargeId'),
      discountTypeId: i.discountTypeId ?? null,
      kind: i.kind,
      value: i.value,
      note: i.note ?? null,
    };
  }
  async apply(cmd: Op<'setDiscount'>, ctx: InvoiceEditContext): Promise<void> {
    const charge = chargeOnInvoice(ctx, cmd.chargeId);
    const discount = await this.discounts.resolve(
      ctx.manager,
      ctx.ctx,
      cmd,
      ctx.time.today,
    );
    await this.discounts.applyOne(ctx.manager, ctx.ctx, charge, discount);
  }
}

class RemoveDiscountHandler
  implements InvoiceEditOperationHandler<Op<'removeDiscount'>>
{
  readonly op = 'removeDiscount' as const;
  parse(i: InvoiceEditOperationInput): Op<'removeDiscount'> {
    return { op: this.op, chargeId: required(i.chargeId, this.op, 'chargeId') };
  }
  apply(cmd: Op<'removeDiscount'>, ctx: InvoiceEditContext): void {
    clearDiscount(chargeOnInvoice(ctx, cmd.chargeId));
  }
}

/** Allocations are released afterwards by the edit itself (VOID = net 0). */
class VoidChargeHandler
  implements InvoiceEditOperationHandler<Op<'voidCharge'>>
{
  readonly op = 'voidCharge' as const;
  parse(i: InvoiceEditOperationInput): Op<'voidCharge'> {
    return { op: this.op, chargeId: required(i.chargeId, this.op, 'chargeId') };
  }
  apply(cmd: Op<'voidCharge'>, ctx: InvoiceEditContext): void {
    voidCharge(
      chargeOnInvoice(ctx, cmd.chargeId),
      ctx.reason,
      ctx.ctx.actor.userId,
      ctx.time.now,
    );
  }
}

class AddChargesHandler
  implements InvoiceEditOperationHandler<Op<'addCharges'>>
{
  readonly op = 'addCharges' as const;
  parse(i: InvoiceEditOperationInput): Op<'addCharges'> {
    const ids = required(i.chargeIds, this.op, 'chargeIds');
    if (!ids.length) throw missing(this.op, 'chargeIds');
    return { op: this.op, chargeIds: ids };
  }
  apply(cmd: Op<'addCharges'>, ctx: InvoiceEditContext): void {
    for (const id of cmd.chargeIds) {
      const charge = ctx.charges.get(id);
      const ok =
        charge &&
        charge.status === ChargeStatus.ACTIVE &&
        !charge.invoiceId &&
        charge.patientId === ctx.invoice.patientId;
      if (!ok)
        throw billingError(
          'BILLING_CHARGE_NOT_OPEN',
          'Only unbilled charges of this patient can be added',
        );
      if (charge.needsPricing) {
        throw billingError(
          'BILLING_CHARGE_NEEDS_PRICING',
          `${charge.description} needs a price first`,
        );
      }
      charge.invoiceId = ctx.invoice.id;
    }
  }
}

class AddManualChargeHandler
  implements InvoiceEditOperationHandler<Op<'addManualCharge'>>
{
  readonly op = 'addManualCharge' as const;
  private readonly factory = new ChargeDraftFactory();
  constructor(private readonly pricing: ChargePricingService) {}
  parse(i: InvoiceEditOperationInput): Op<'addManualCharge'> {
    if (!i.serviceId && (!i.description || i.unitPrice == null)) {
      throw missing(this.op, 'serviceId, or description and unitPrice');
    }
    return {
      op: this.op,
      serviceId: i.serviceId ?? null,
      description: i.description ?? null,
      quantity: i.quantity ?? 1,
      unitPrice: i.unitPrice ?? null,
      doctorId: i.doctorId ?? null,
    };
  }
  async apply(
    cmd: Op<'addManualCharge'>,
    ctx: InvoiceEditContext,
  ): Promise<void> {
    const { manager, ctx: bctx } = ctx;
    if (cmd.doctorId)
      await BillingLookups.assertDoctor(manager, bctx.tenant, cmd.doctorId);
    const price = cmd.serviceId
      ? await this.pricing.resolve(
          manager,
          bctx.tenant,
          cmd.serviceId,
          cmd.doctorId,
        )
      : null;
    const charge = manager.getRepository(Charge).create(
      this.factory.manual(
        {
          ...bctx.tenant,
          patientId: ctx.invoice.patientId,
          doctorId: cmd.doctorId,
          chargeDate: ctx.time.today,
          createdBy: bctx.actor.userId,
          description: cmd.description ?? '',
          quantity: cmd.quantity,
          unitPrice: cmd.unitPrice ?? 0,
        },
        price,
      ),
    );
    if (price && cmd.unitPrice != null && cmd.unitPrice !== price.unitPrice) {
      assertCanSetPrice(bctx.actor, charge);
      charge.unitPrice = cmd.unitPrice;
      recalcCharge(charge);
    }
    charge.invoiceId = ctx.invoice.id;
    await manager.save(charge);
    ctx.charges.set(charge.id, charge);
  }
}

/** Command registry for invoice edits (13.5). */
@Injectable()
export class InvoiceEditHandlers {
  readonly registry: InvoiceEditHandlerRegistry;

  constructor(discounts: DiscountApplier, pricing: ChargePricingService) {
    this.registry = {
      updateQuantity: new UpdateQuantityHandler(),
      setUnitPrice: new SetUnitPriceHandler(),
      setDiscount: new SetDiscountHandler(discounts),
      removeDiscount: new RemoveDiscountHandler(),
      voidCharge: new VoidChargeHandler(),
      addCharges: new AddChargesHandler(),
      addManualCharge: new AddManualChargeHandler(pricing),
    };
  }

  /** Parses every input up front so nothing is applied when one is invalid. */
  parseAll(inputs: InvoiceEditOperationInput[]): InvoiceEditOperation[] {
    return inputs.map((input) => this.registry[input.op].parse(input));
  }

  async apply(
    cmd: InvoiceEditOperation,
    ctx: InvoiceEditContext,
  ): Promise<void> {
    const handler = this.registry[
      cmd.op
    ] as InvoiceEditOperationHandler<InvoiceEditOperation>;
    await handler.apply(cmd, ctx);
  }
}
