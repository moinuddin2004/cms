import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingLookups } from '../common/billing-lookups';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BillingContext } from '../common/billing-context';
import { billingError, isUniqueViolation } from '../common/billing-errors';
import { findOneInTenantOrFail } from '../common/tenant-scope';
import {
  CreateServiceDto,
  CreateServicePriceDto,
  ListServicesQueryDto,
  UpdateServiceDto,
  UpdateServicePriceDto,
} from '../dto/config.dto';
import { CatalogService } from '../entities/catalog-service.entity';
import { ServicePrice } from '../entities/service-price.entity';
import { BillingAuditAction, BillingAuditEntity } from '../enums/billing.enums';
import { ChargePricingService, ResolvedPrice } from './charge-pricing.service';

export interface ServicePriceView {
  id: string;
  serviceId: string;
  serviceName: string;
  doctorId: string | null;
  doctorName: string | null;
  price: number;
}

/** Org-level service catalog + per-location / per-doctor overrides (D5). */
@Injectable()
export class CatalogServicesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly pricing: ChargePricingService,
    private readonly audit: BillingAuditService,
  ) {}

  list(
    tenant: TenantContext,
    q: ListServicesQueryDto,
  ): Promise<CatalogService[]> {
    return this.dataSource.getRepository(CatalogService).find({
      where: {
        organizationId: tenant.organizationId,
        ...(q.activeOnly ? { isActive: true } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(
    ctx: BillingContext,
    dto: CreateServiceDto,
  ): Promise<CatalogService> {
    return this.write(
      'A service with this name or code already exists',
      async (manager) => {
        const service = manager.getRepository(CatalogService).create({
          ...dto,
          code: dto.code || null,
          organizationId: ctx.tenant.organizationId,
        });
        await manager.save(service);
        await this.audit.log(manager, ctx, {
          entityType: BillingAuditEntity.SERVICE,
          entityId: service.id,
          action: BillingAuditAction.CREATED,
          after: service,
          locationScoped: false,
        });
        return service;
      },
    );
  }

  async update(
    ctx: BillingContext,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<CatalogService> {
    return this.write(
      'A service with this name or code already exists',
      async (manager) => {
        const service = await findOneInTenantOrFail(
          manager,
          CatalogService,
          id,
          ctx.tenant,
          {
            label: 'Service',
            orgOnly: true,
            lock: true,
          },
        );
        const before = { ...service };
        Object.assign(
          service,
          dto,
          dto.code !== undefined ? { code: dto.code || null } : {},
        );
        await manager.save(service);
        await this.audit.log(manager, ctx, {
          entityType: BillingAuditEntity.SERVICE,
          entityId: service.id,
          action: BillingAuditAction.UPDATED,
          before,
          after: service,
          locationScoped: false,
        });
        return service;
      },
    );
  }

  resolvedPrice(
    tenant: TenantContext,
    serviceId: string,
    doctorId?: string,
  ): Promise<ResolvedPrice> {
    return this.pricing.resolve(
      this.dataSource.manager,
      tenant,
      serviceId,
      doctorId ?? null,
    );
  }

  // ─── Overrides (active location) ──────────────────────────────────

  async listPrices(
    tenant: TenantContext,
    serviceId?: string,
  ): Promise<ServicePriceView[]> {
    const rows = await this.dataSource
      .getRepository(ServicePrice)
      .createQueryBuilder('sp')
      .innerJoinAndSelect('sp.service', 's')
      .leftJoinAndSelect('sp.doctor', 'd')
      .where('sp.organization_id = :org AND sp.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      })
      .andWhere(serviceId ? 'sp.service_id = :serviceId' : '1=1', { serviceId })
      .orderBy('s.name', 'ASC')
      .addOrderBy('d.full_name', 'ASC', 'NULLS FIRST')
      .getMany();
    return rows.map((p) => ({
      id: p.id,
      serviceId: p.serviceId,
      serviceName: p.service.name,
      doctorId: p.doctorId,
      doctorName: p.doctor?.fullName ?? null,
      price: p.price,
    }));
  }

  async createPrice(
    ctx: BillingContext,
    dto: CreateServicePriceDto,
  ): Promise<ServicePrice> {
    return this.write(
      'An override for this service and doctor already exists',
      async (manager) => {
        await findOneInTenantOrFail(
          manager,
          CatalogService,
          dto.serviceId,
          ctx.tenant,
          {
            label: 'Service',
            orgOnly: true,
          },
        );
        if (dto.doctorId)
          await BillingLookups.assertDoctor(manager, ctx.tenant, dto.doctorId);
        const price = manager.getRepository(ServicePrice).create({
          organizationId: ctx.tenant.organizationId,
          locationId: ctx.tenant.locationId,
          serviceId: dto.serviceId,
          doctorId: dto.doctorId ?? null,
          price: dto.price,
        });
        await manager.save(price);
        await this.audit.log(manager, ctx, {
          entityType: BillingAuditEntity.SERVICE_PRICE,
          entityId: price.id,
          action: BillingAuditAction.CREATED,
          after: price,
        });
        return price;
      },
    );
  }

  async updatePrice(
    ctx: BillingContext,
    id: string,
    dto: UpdateServicePriceDto,
  ): Promise<ServicePrice> {
    return this.dataSource.transaction(async (manager) => {
      const price = await findOneInTenantOrFail(
        manager,
        ServicePrice,
        id,
        ctx.tenant,
        {
          label: 'Price override',
          lock: true,
        },
      );
      const before = { ...price };
      price.price = dto.price;
      await manager.save(price);
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.SERVICE_PRICE,
        entityId: price.id,
        action: BillingAuditAction.PRICE_CHANGED,
        before,
        after: price,
      });
      return price;
    });
  }

  /** Overrides are configuration (no history of their own); removal is audited. */
  async deletePrice(ctx: BillingContext, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const price = await findOneInTenantOrFail(
        manager,
        ServicePrice,
        id,
        ctx.tenant,
        {
          label: 'Price override',
          lock: true,
        },
      );
      await manager.delete(ServicePrice, { id: price.id });
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.SERVICE_PRICE,
        entityId: price.id,
        action: BillingAuditAction.DELETED,
        before: price,
      });
    });
  }

  private async write<T>(
    duplicateMessage: string,
    work: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (err) {
      if (isUniqueViolation(err))
        throw billingError('BILLING_DUPLICATE', duplicateMessage);
      throw err;
    }
  }
}
