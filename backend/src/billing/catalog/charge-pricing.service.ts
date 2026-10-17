import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { billingError } from '../common/billing-errors';
import { findOneInTenantOrFail } from '../common/tenant-scope';
import { CatalogService } from '../entities/catalog-service.entity';
import { ServicePrice } from '../entities/service-price.entity';
import { ServiceKind } from '../enums/billing.enums';

export interface ResolvedPrice {
  serviceId: string;
  unitPrice: number;
  description: string;
  serviceKind: ServiceKind;
  /** Where the price came from — shown in the settings UI. */
  level: 'DOCTOR' | 'LOCATION' | 'DEFAULT';
}

/**
 * Price resolution (D5, 6.2):
 * (service, location, doctor) → (service, location) → service default.
 * Callers snapshot the result on the charge.
 */
@Injectable()
export class ChargePricingService {
  async resolve(
    manager: EntityManager,
    tenant: TenantContext,
    serviceId: string,
    doctorId: string | null | undefined,
  ): Promise<ResolvedPrice> {
    const service = await findOneInTenantOrFail(
      manager,
      CatalogService,
      serviceId,
      tenant,
      {
        label: 'Service',
        orgOnly: true,
      },
    );
    if (!service.isActive) {
      throw billingError(
        'BILLING_SERVICE_INACTIVE',
        `${service.name} is no longer offered`,
      );
    }

    const prices = await manager.getRepository(ServicePrice).find({
      where: [
        ...(doctorId
          ? [
              {
                serviceId,
                locationId: tenant.locationId,
                organizationId: tenant.organizationId,
                doctorId,
              },
            ]
          : []),
        {
          serviceId,
          locationId: tenant.locationId,
          organizationId: tenant.organizationId,
          doctorId: IsNull(),
        },
      ],
    });
    const doctorPrice = doctorId
      ? prices.find((p) => p.doctorId === doctorId)
      : undefined;
    const locationPrice = prices.find((p) => p.doctorId === null);
    const chosen = doctorPrice ?? locationPrice;

    return {
      serviceId: service.id,
      unitPrice: chosen ? chosen.price : service.defaultPrice,
      description: service.name,
      serviceKind: service.kind,
      level: doctorPrice ? 'DOCTOR' : locationPrice ? 'LOCATION' : 'DEFAULT',
    };
  }
}
