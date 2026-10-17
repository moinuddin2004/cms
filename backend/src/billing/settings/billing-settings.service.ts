import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Location } from 'src/locations/entities/location.entity';
import { BillingAuditService } from '../audit/billing-audit.service';
import {
  DEFAULT_CASH_ACCOUNT_NAME,
  DOCUMENT_CODE_PATTERN,
} from '../billing.constants';
import { BillingContext } from '../common/billing-context';
import { billingError, notFound } from '../common/billing-errors';
import { findOneInTenantOrFail } from '../common/tenant-scope';
import { UpdateBillingSettingsDto } from '../dto/config.dto';
import { CatalogService } from '../entities/catalog-service.entity';
import { LocationBillingSettings } from '../entities/location-billing-settings.entity';
import { PaymentAccount } from '../entities/payment-account.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  PaymentMethod,
  ServiceKind,
} from '../enums/billing.enums';

export interface BillingSettingsView extends LocationBillingSettings {
  documentCodeLocked: boolean;
  locationName: string;
}

/** `locations.code` → `KHI01`-style document code, when it fits (V5). */
const deriveDocumentCode = (code: string | null | undefined): string | null => {
  const candidate = (code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return DOCUMENT_CODE_PATTERN.test(candidate) ? candidate : null;
};

@Injectable()
export class BillingSettingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: BillingAuditService,
  ) {}

  /**
   * Settings row of the active location, created lazily with defaults
   * together with its `Cash` account, which becomes the default (6.19).
   * Insert-or-ignore keeps concurrent first calls safe.
   */
  async getOrCreate(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<LocationBillingSettings> {
    const repo = manager.getRepository(LocationBillingSettings);
    const existing = await repo.findOne({
      where: {
        locationId: tenant.locationId,
        organizationId: tenant.organizationId,
      },
    });
    if (existing) return existing;

    const location = await manager.getRepository(Location).findOne({
      where: { id: tenant.locationId, organizationId: tenant.organizationId },
      select: { id: true, code: true },
    });
    if (!location) throw notFound('Location');

    await manager
      .createQueryBuilder()
      .insert()
      .into(LocationBillingSettings)
      .values({
        locationId: tenant.locationId,
        organizationId: tenant.organizationId,
        documentCode: deriveDocumentCode(location.code),
      })
      .orIgnore()
      .execute();
    await manager
      .createQueryBuilder()
      .insert()
      .into(PaymentAccount)
      .values({
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
        name: DEFAULT_CASH_ACCOUNT_NAME,
        method: PaymentMethod.CASH,
        requiresReference: false,
        countedInCashClose: true,
      })
      .orIgnore()
      .execute();
    const cash = await manager.getRepository(PaymentAccount).findOneOrFail({
      where: {
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
        name: DEFAULT_CASH_ACCOUNT_NAME,
      },
    });
    await repo.update(
      { locationId: tenant.locationId, defaultPaymentAccountId: IsNull() },
      { defaultPaymentAccountId: cash.id },
    );
    return repo.findOneOrFail({ where: { locationId: tenant.locationId } });
  }

  async get(tenant: TenantContext): Promise<BillingSettingsView> {
    return this.dataSource.transaction((manager) => this.view(manager, tenant));
  }

  async update(
    ctx: BillingContext,
    dto: UpdateBillingSettingsDto,
  ): Promise<BillingSettingsView> {
    return this.dataSource.transaction(async (manager) => {
      const settings = await this.getOrCreate(manager, ctx.tenant);
      const before = { ...settings };

      if (
        dto.documentCode !== undefined &&
        dto.documentCode !== settings.documentCode
      ) {
        if (await this.hasIssuedNumbers(manager, ctx.tenant)) {
          throw billingError(
            'BILLING_LOCATION_CODE_LOCKED',
            'The document code cannot change after the first invoice, receipt or refund',
          );
        }
        settings.documentCode = dto.documentCode;
      }
      if (dto.defaultConsultationServiceId) {
        const service = await findOneInTenantOrFail(
          manager,
          CatalogService,
          dto.defaultConsultationServiceId,
          ctx.tenant,
          { label: 'Service', orgOnly: true },
        );
        if (service.kind !== ServiceKind.CONSULTATION) {
          throw billingError(
            'BILLING_SERVICE_KIND_INVALID',
            'Choose a consultation service',
          );
        }
      }
      if (dto.defaultPaymentAccountId) {
        const account = await findOneInTenantOrFail(
          manager,
          PaymentAccount,
          dto.defaultPaymentAccountId,
          ctx.tenant,
          { label: 'Payment account' },
        );
        if (!account.isActive) {
          throw billingError(
            'BILLING_PAYMENT_ACCOUNT_INVALID',
            'The default account must be active',
          );
        }
      }

      const rest: Partial<UpdateBillingSettingsDto> = { ...dto };
      delete rest.documentCode;
      Object.assign(settings, rest, { updatedBy: ctx.actor.userId });
      await manager.getRepository(LocationBillingSettings).save(settings);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.SETTINGS,
        entityId: ctx.tenant.locationId,
        action: BillingAuditAction.UPDATED,
        before,
        after: settings,
      });
      return this.view(manager, ctx.tenant);
    });
  }

  private async view(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<BillingSettingsView> {
    const settings = await this.getOrCreate(manager, tenant);
    const location = await manager.getRepository(Location).findOneOrFail({
      where: { id: tenant.locationId },
      select: { id: true, name: true },
    });
    return {
      ...settings,
      documentCodeLocked: await this.hasIssuedNumbers(manager, tenant),
      locationName: location.name,
    };
  }

  private async hasIssuedNumbers(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<boolean> {
    const rows: unknown[] = await manager.query(
      `SELECT 1 FROM document_sequences WHERE organization_id = $1 AND location_id = $2 LIMIT 1`,
      [tenant.organizationId, tenant.locationId],
    );
    return rows.length > 0;
  }
}
