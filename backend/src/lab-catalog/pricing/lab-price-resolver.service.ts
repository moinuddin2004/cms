import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { toMinor } from 'src/billing/common/money';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServicePrice } from 'src/billing/entities/service-price.entity';
import { ClockService } from 'src/common/clock/clock.service';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { LabLinkStatus } from 'src/labs/enums/lab.enums';
import { catalogError } from '../common/catalog-errors';
import { LabServiceOption } from '../entities/lab-service-option.entity';
import { LabServicePrice } from '../entities/lab-service-price.entity';
import { LabService } from '../entities/lab-service.entity';
import { ServiceMapping } from '../entities/service-mapping.entity';
import { LabPriceSource, UnitType } from '../enums/catalog.enums';
import { CATALOG_TIMEZONE } from '../lab-catalog.constants';
import {
  labUnitCost,
  PatientPriceLevel,
  pickLabPrice,
  pickPatientPrice,
  Ymd,
} from './price-resolver';

export interface PriceQuery {
  organizationId: string;
  /** The ordering location (patient price overrides); null = org default. */
  locationId: string | null;
  labServiceId: string;
  optionIds?: string[];
  rush?: boolean;
  /** Calendar day to price on; defaults to today. */
  on?: Ymd;
  /** Bill as this treatment; default = the service's active mapping. */
  clinicTreatmentId?: string | null;
  /** Doctor (employee) for doctor-level patient price overrides. */
  doctorId?: string | null;
}

export interface PriceQuote {
  on: Ymd;
  labService: {
    id: string;
    labId: string;
    code: string;
    name: string;
    unitType: UnitType;
  };
  /** What one unit costs the clinic (lab payable). */
  lab: {
    priceId: string;
    source: LabPriceSource;
    currency: string;
    baseMinor: number;
    optionsMinor: number;
    rushMinor: number;
    unitMinor: number;
    options: {
      id: string;
      code: string;
      name: string;
      extraCostMinor: number;
    }[];
  };
  /** What one unit costs the patient; null when no treatment is mapped. */
  patient: {
    clinicTreatmentId: string;
    name: string;
    unitPriceMinor: number;
    level: PatientPriceLevel;
  } | null;
}

/**
 * Resolves both prices of an order line on a date — the lab cost and the
 * patient price — for Sprint 6 to snapshot at submit (lab ERD §4, §10). It
 * reads only; pass the order transaction's manager so the snapshot sees
 * the same data the order commits with. Never exposed to the lab portal:
 * the result carries the clinic's selling price.
 */
@Injectable()
export class LabPriceResolver {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  async quote(
    q: PriceQuery,
    m: EntityManager = this.dataSource.manager,
  ): Promise<PriceQuote> {
    const on = q.on ?? this.clock.today(CATALOG_TIMEZONE);
    const service = await m
      .getRepository(LabService)
      .findOneBy({ id: q.labServiceId });
    const link =
      service &&
      (await m.getRepository(LabClinicLink).findOneBy({
        labId: service.labId,
        organizationId: q.organizationId,
      }));
    // A lab this clinic doesn't work with is reported as missing.
    if (!service || !link) {
      throw catalogError('LAB_SERVICE_NOT_FOUND', 'Service not found');
    }
    if (link.status !== LabLinkStatus.ACTIVE) {
      throw catalogError(
        'LAB_NOT_LINKED',
        'Activate this lab in your lab list before ordering from it',
      );
    }
    if (!service.isActive) {
      throw catalogError(
        'LAB_SERVICE_INACTIVE',
        `${service.name} is no longer offered by this lab`,
      );
    }

    const optionIds = [...new Set(q.optionIds ?? [])];
    const options = optionIds.length
      ? await m.getRepository(LabServiceOption).findBy({
          id: In(optionIds),
          labServiceId: service.id,
          isActive: true,
        })
      : [];
    if (options.length !== optionIds.length) {
      throw catalogError(
        'LAB_SERVICE_OPTION_NOT_FOUND',
        'One of the chosen options is not offered for this service',
      );
    }

    const windows = await m.getRepository(LabServicePrice).find({
      where: [
        { labServiceId: service.id, organizationId: q.organizationId },
        { labServiceId: service.id, organizationId: IsNull() },
      ],
    });
    const picked = pickLabPrice(windows, q.organizationId, on);
    if (!picked) {
      throw catalogError(
        'LAB_PRICE_MISSING',
        `The lab has no price for ${service.name} on ${on}`,
      );
    }
    const cost = labUnitCost(picked.price, options, q.rush ?? false);

    return {
      on,
      labService: {
        id: service.id,
        labId: service.labId,
        code: service.code,
        name: service.name,
        unitType: service.unitType,
      },
      lab: {
        priceId: picked.price.id,
        source: picked.source,
        currency: picked.price.currency,
        ...cost,
        options: options
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({
            id: o.id,
            code: o.code,
            name: o.name,
            extraCostMinor: o.extraCostMinor,
          })),
      },
      patient: await this.patientPrice(m, q, service.id),
    };
  }

  private async patientPrice(
    m: EntityManager,
    q: PriceQuery,
    labServiceId: string,
  ): Promise<PriceQuote['patient']> {
    let treatmentId = q.clinicTreatmentId ?? null;
    if (!treatmentId) {
      const mapping = await m.getRepository(ServiceMapping).findOneBy({
        organizationId: q.organizationId,
        labServiceId,
        isActive: true,
      });
      if (!mapping) return null;
      treatmentId = mapping.clinicTreatmentId;
    }
    const treatment = await m.getRepository(CatalogService).findOneBy({
      id: treatmentId,
      organizationId: q.organizationId,
    });
    if (!treatment) {
      throw catalogError('CLINIC_TREATMENT_NOT_FOUND', 'Treatment not found');
    }
    if (!treatment.isActive) {
      throw catalogError(
        'CLINIC_TREATMENT_INACTIVE',
        `${treatment.name} is no longer offered by your clinic`,
      );
    }
    const overrides = q.locationId
      ? await m.getRepository(ServicePrice).findBy({
          organizationId: q.organizationId,
          locationId: q.locationId,
          serviceId: treatment.id,
        })
      : [];
    const picked = pickPatientPrice(
      toMinor(treatment.defaultPrice),
      overrides.map((o) => ({
        locationId: o.locationId,
        doctorId: o.doctorId,
        priceMinor: toMinor(o.price),
      })),
      q.locationId,
      q.doctorId ?? null,
    );
    return {
      clinicTreatmentId: treatment.id,
      name: treatment.name,
      ...picked,
    };
  }
}
