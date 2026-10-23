import { BillingActor } from '../common/billing-context';
import { billingError } from '../common/billing-errors';
import { Charge } from '../entities/charge.entity';

/**
 * D5: without `billing.price.override` only "Other" charges (no catalog
 * service) or ones still needing a price can be priced — give a discount
 * instead. Shared by charge updates and invoice edits.
 */
export function assertCanSetPrice(
  actor: BillingActor,
  charge: Pick<Charge, 'serviceId' | 'needsPricing'>,
): void {
  if (!charge.serviceId || charge.needsPricing) return;
  if (actor.access.can('billing.price.override')) return;
  throw billingError(
    'BILLING_PRICE_CHANGE_NOT_ALLOWED',
    'You are not allowed to change a catalog price — give a discount instead',
  );
}
