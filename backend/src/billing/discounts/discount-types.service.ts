import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BillingClock } from '../common/billing-clock.service';
import { BillingContext } from '../common/billing-context';
import { billingError, isUniqueViolation } from '../common/billing-errors';
import { findOneInTenantOrFail } from '../common/tenant-scope';
import {
  CreateDiscountTypeDto,
  UpdateDiscountTypeDto,
} from '../dto/discount.dto';
import { DiscountType } from '../entities/discount-type.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  DiscountAppliesTo,
} from '../enums/billing.enums';
import { isDiscountUsable, isValueInKindBounds } from './applicability';

/** Owner-defined discount presets (D8). Never deleted once used. */
@Injectable()
export class DiscountTypesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly audit: BillingAuditService,
  ) {}

  async list(
    tenant: TenantContext,
    usableToday = false,
  ): Promise<DiscountType[]> {
    const rows = await this.dataSource.getRepository(DiscountType).find({
      where: { organizationId: tenant.organizationId },
      order: { name: 'ASC' },
    });
    if (!usableToday) return rows;
    const { today } = await this.clock.read(tenant.locationId);
    return rows.filter((t) => isDiscountUsable(t, today));
  }

  async create(
    ctx: BillingContext,
    dto: CreateDiscountTypeDto,
  ): Promise<DiscountType> {
    return this.write(async (manager) => {
      const type = manager.getRepository(DiscountType).create({
        ...dto,
        code: dto.code || null,
        organizationId: ctx.tenant.organizationId,
        createdBy: ctx.actor.userId,
      });
      this.assertShape(type);
      await manager.save(type);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.DISCOUNT_TYPE,
        entityId: type.id,
        action: BillingAuditAction.CREATED,
        after: type,
        locationScoped: false,
      });
      return type;
    });
  }

  /** Charges keep their snapshot; editing a type never changes them. */
  async update(
    ctx: BillingContext,
    id: string,
    dto: UpdateDiscountTypeDto,
  ): Promise<DiscountType> {
    return this.write(async (manager) => {
      const type = await findOneInTenantOrFail(
        manager,
        DiscountType,
        id,
        ctx.tenant,
        {
          label: 'Discount type',
          orgOnly: true,
          lock: true,
        },
      );
      const before = { ...type };
      Object.assign(
        type,
        dto,
        dto.code !== undefined ? { code: dto.code || null } : {},
      );
      this.assertShape(type);
      await manager.save(type);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.DISCOUNT_TYPE,
        entityId: type.id,
        action: BillingAuditAction.UPDATED,
        before,
        after: type,
        locationScoped: false,
      });
      return type;
    });
  }

  /** 5.6 shape rules, checked on the merged row so PATCH can't break them. */
  private assertShape(t: DiscountType): void {
    const fail = (message: string) =>
      billingError('BILLING_DISCOUNT_INVALID', message);
    if (!isValueInKindBounds(t.kind, t.value))
      throw fail('Percentage must be between 0 and 100');
    if (
      t.appliesTo === DiscountAppliesTo.SERVICE_KINDS &&
      !t.serviceKinds?.length
    ) {
      throw fail('Choose at least one service kind');
    }
    if (t.appliesTo === DiscountAppliesTo.SERVICES && !t.serviceIds?.length) {
      throw fail('Choose at least one service');
    }
    if (t.receptionEditable) {
      const ok =
        t.minValue != null &&
        t.maxValue != null &&
        t.minValue <= t.value &&
        t.value <= t.maxValue;
      if (!ok) throw fail('Reception range must satisfy min ≤ value ≤ max');
    }
    if (t.validFrom && t.validTo && t.validFrom > t.validTo) {
      throw fail('Valid from must be before valid to');
    }
  }

  private async write<T>(work: (m: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw billingError(
          'BILLING_DUPLICATE',
          'A discount type with this name or code already exists',
        );
      }
      throw err;
    }
  }
}
