import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BillingContext } from '../common/billing-context';
import { billingError } from '../common/billing-errors';
import { lineGross } from '../common/money';
import { findOneInTenantOrFail } from '../common/tenant-scope';
import { applyDiscount } from '../charges/charge-math';
import { Charge } from '../entities/charge.entity';
import { DiscountType } from '../entities/discount-type.entity';
import { appliesToCharge } from './applicability';
import {
  discountForCharge,
  discountsForCharges,
} from './calculator/discount-calculator';
import {
  DiscountRequest,
  ResolvedDiscount,
  resolveDiscount,
} from './discount-policy';

export interface BulkDiscountResult {
  applied: Charge[];
  skipped: Array<{ chargeId: string; description: string }>;
}

/**
 * Validates a discount request (6.3) and applies it to charges in memory.
 * Shared by unbilled-charge routes and the invoice-edit `setDiscount` op.
 */
@Injectable()
export class DiscountApplier {
  async resolve(
    manager: EntityManager,
    ctx: BillingContext,
    req: DiscountRequest,
    today: string,
  ): Promise<ResolvedDiscount> {
    const type = req.discountTypeId
      ? await findOneInTenantOrFail(
          manager,
          DiscountType,
          req.discountTypeId,
          ctx.tenant,
          {
            label: 'Discount type',
            orgOnly: true,
          },
        )
      : null;
    return resolveDiscount(req, type, ctx.actor, today);
  }

  /** Single charge: must match `appliesTo`, else BILLING_DISCOUNT_INVALID. */
  async applyOne(
    manager: EntityManager,
    ctx: BillingContext,
    charge: Charge,
    discount: ResolvedDiscount,
  ): Promise<void> {
    const type = await this.typeOf(manager, ctx, discount);
    if (type && !appliesToCharge(type, charge)) {
      throw billingError(
        'BILLING_DISCOUNT_INVALID',
        `${type.name} does not apply to ${charge.description}`,
      );
    }
    const amount = discountForCharge(
      lineGross(charge.quantity, charge.unitPrice),
      discount.rule,
    );
    applyDiscount(charge, discount, amount, ctx.actor.userId);
  }

  /** "Apply to all": non-matching charges are skipped and reported. */
  async applyMany(
    manager: EntityManager,
    ctx: BillingContext,
    charges: Charge[],
    discount: ResolvedDiscount,
  ): Promise<BulkDiscountResult> {
    const type = await this.typeOf(manager, ctx, discount);
    const applied = charges.filter((c) => !type || appliesToCharge(type, c));
    const skipped = charges
      .filter((c) => !applied.includes(c))
      .map((c) => ({ chargeId: c.id, description: c.description }));
    const amounts = discountsForCharges(
      applied.map((c) => lineGross(c.quantity, c.unitPrice)),
      discount.rule,
    );
    applied.forEach((c, i) =>
      applyDiscount(c, discount, amounts[i], ctx.actor.userId),
    );
    return { applied, skipped };
  }

  private async typeOf(
    manager: EntityManager,
    ctx: BillingContext,
    discount: ResolvedDiscount,
  ): Promise<DiscountType | null> {
    if (!discount.typeId) return null;
    return findOneInTenantOrFail(
      manager,
      DiscountType,
      discount.typeId,
      ctx.tenant,
      {
        label: 'Discount type',
        orgOnly: true,
      },
    );
  }
}
