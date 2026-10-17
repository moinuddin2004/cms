import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BillingContext } from '../common/billing-context';
import { billingError, isUniqueViolation } from '../common/billing-errors';
import { findOneInTenantOrFail, tenantWhere } from '../common/tenant-scope';
import {
  CreatePaymentAccountDto,
  UpdatePaymentAccountDto,
} from '../dto/config.dto';
import { PaymentAccount } from '../entities/payment-account.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  PaymentMethod,
} from '../enums/billing.enums';
import { BillingSettingsService } from '../settings/billing-settings.service';

/** What a payment or refund snapshots from its account (6.19). */
export interface ResolvedPaymentAccount {
  id: string;
  name: string;
  method: PaymentMethod;
  requiresReference: boolean;
}

@Injectable()
export class PaymentAccountsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: BillingSettingsService,
    private readonly audit: BillingAuditService,
  ) {}

  async list(
    tenant: TenantContext,
    activeOnly = false,
  ): Promise<PaymentAccount[]> {
    return this.dataSource.transaction(async (manager) => {
      await this.settings.getOrCreate(manager, tenant);
      return manager.getRepository(PaymentAccount).find({
        where: {
          ...tenantWhere(tenant),
          ...(activeOnly ? { isActive: true } : {}),
        },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  }

  async create(
    ctx: BillingContext,
    dto: CreatePaymentAccountDto,
  ): Promise<PaymentAccount> {
    return this.saveUnique(async (manager) => {
      const isCash = dto.method === PaymentMethod.CASH;
      const account = manager.getRepository(PaymentAccount).create({
        ...tenantWhere(ctx.tenant),
        ...dto,
        requiresReference: dto.requiresReference ?? !isCash,
        countedInCashClose: dto.countedInCashClose ?? isCash,
      });
      await manager.save(account);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.PAYMENT_ACCOUNT,
        entityId: account.id,
        action: BillingAuditAction.CREATED,
        after: account,
      });
      return account;
    });
  }

  async update(
    ctx: BillingContext,
    id: string,
    dto: UpdatePaymentAccountDto,
  ): Promise<PaymentAccount> {
    return this.saveUnique(async (manager) => {
      const account = await findOneInTenantOrFail(
        manager,
        PaymentAccount,
        id,
        ctx.tenant,
        {
          label: 'Payment account',
          lock: true,
        },
      );
      const before = { ...account };
      if (dto.isActive === false && account.isActive) {
        await this.assertCanDeactivate(manager, ctx.tenant, account.id);
      }
      Object.assign(account, dto);
      await manager.save(account);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.PAYMENT_ACCOUNT,
        entityId: account.id,
        action: BillingAuditAction.UPDATED,
        before,
        after: account,
      });
      return account;
    });
  }

  /** The account must be active and belong to the active location (6.19). */
  async resolveForUse(
    manager: EntityManager,
    tenant: TenantContext,
    accountId: string,
    referenceNumber: string | null | undefined,
  ): Promise<ResolvedPaymentAccount> {
    const account = await manager.getRepository(PaymentAccount).findOne({
      where: { id: accountId, ...tenantWhere(tenant) },
    });
    if (!account?.isActive) {
      throw billingError(
        'BILLING_PAYMENT_ACCOUNT_INVALID',
        'This payment account is not available',
      );
    }
    if (account.requiresReference && !referenceNumber?.trim()) {
      throw billingError(
        'BILLING_REFERENCE_REQUIRED',
        `A reference number is required for ${account.name}`,
      );
    }
    return {
      id: account.id,
      name: account.name,
      method: account.method,
      requiresReference: account.requiresReference,
    };
  }

  private async assertCanDeactivate(
    manager: EntityManager,
    tenant: TenantContext,
    id: string,
  ): Promise<void> {
    const settings = await this.settings.getOrCreate(manager, tenant);
    if (settings.defaultPaymentAccountId === id) {
      throw billingError(
        'BILLING_PAYMENT_ACCOUNT_IS_DEFAULT',
        'Choose another default account before deactivating this one',
      );
    }
    const active = await manager.getRepository(PaymentAccount).count({
      where: { ...tenantWhere(tenant), isActive: true },
    });
    if (active <= 1) {
      throw billingError(
        'BILLING_PAYMENT_ACCOUNT_INVALID',
        'A location needs at least one active account',
      );
    }
  }

  private async saveUnique<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw billingError(
          'BILLING_DUPLICATE',
          'An account with this name already exists',
        );
      }
      throw err;
    }
  }
}
