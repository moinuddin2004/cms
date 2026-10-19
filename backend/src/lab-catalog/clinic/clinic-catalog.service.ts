import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull } from 'typeorm';
import { toPaisa } from 'src/billing/common/money';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServicePrice } from 'src/billing/entities/service-price.entity';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { SpecialtiesService } from 'src/engine/specialties/specialties.service';
import { likePattern } from 'src/labs/common/lab-query';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { LabLinkStatus } from 'src/labs/enums/lab.enums';
import { catalogError } from '../common/catalog-errors';
import { ClinicLabServicesQueryDto } from '../dto/catalog.dto';
import { LabServicePrice } from '../entities/lab-service-price.entity';
import { LabService } from '../entities/lab-service.entity';
import { ServiceCategory } from '../entities/service-category.entity';
import { ServiceMapping } from '../entities/service-mapping.entity';
import { CATALOG_TIMEZONE } from '../lab-catalog.constants';
import {
  ClinicServiceRow,
  toCategoryResponse,
  CategoryResponse,
  toEffectivePrice,
  toServiceResponse,
} from '../mappers/catalog-response';
import { pickLabPrice } from '../pricing/price-resolver';
import { LabServicesService } from '../services/lab-services.service';

/** Labs whose services a clinic sees: the ones on its lab list. */
const VISIBLE_LINKS = [LabLinkStatus.ACTIVE, LabLinkStatus.INVITED];

export interface ClinicServiceRowWithPatient extends ClinicServiceRow {
  linkStatus: LabLinkStatus;
  /** Patient price of the mapped treatment at the active location, paisa. */
  patientPricePaisa: number | null;
}

export interface ClinicTreatmentRow {
  id: string;
  name: string;
  code: string | null;
  kind: string;
  isActive: boolean;
  /** Patient price at the active location (location override or default). */
  pricePaisa: number;
  mappedServiceCount: number;
}

/**
 * The clinic's read view of the lab catalog: the services of the labs on
 * its list with the price THIS clinic pays (negotiated or list — never
 * another clinic's rate), plus its own treatments for mapping. Tenant
 * scoped by `organization_id` throughout.
 */
@Injectable()
export class ClinicCatalogService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly services: LabServicesService,
    private readonly specialties: SpecialtiesService,
  ) {}

  async categories(organizationId: string): Promise<CategoryResponse[]> {
    const specialties = await this.specialties.enabledFor(organizationId);
    if (!specialties.length) return [];
    const rows = await this.dataSource.getRepository(ServiceCategory).find({
      where: {
        specialtyId: In(specialties.map((sp) => sp.id)),
        isActive: true,
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map((c) => toCategoryResponse(c));
  }

  async list(
    tenant: TenantContext,
    q: ClinicLabServicesQueryDto,
    /** Internal: just this service (detail view). */
    serviceId?: string,
  ): Promise<PaginatedResponseDto<ClinicServiceRowWithPatient>> {
    const { organizationId } = tenant;
    const qb = this.dataSource
      .getRepository(LabService)
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.lab', 'lab')
      .innerJoinAndMapOne(
        's.clinicLink',
        LabClinicLink,
        'k',
        'k.lab_id = s.lab_id AND k.organization_id = :organizationId AND k.status IN (:...linkStatuses)',
        { organizationId, linkStatuses: VISIBLE_LINKS },
      )
      .innerJoinAndSelect('s.specialty', 'specialty')
      .innerJoinAndSelect('s.category', 'category')
      .leftJoinAndSelect('s.formSchema', 'formSchema')
      .leftJoinAndSelect('s.workflowTemplate', 'workflowTemplate')
      .leftJoinAndSelect('s.stageTemplate', 'stageTemplate')
      .where('s.is_active')
      .orderBy('lab.name', 'ASC')
      .addOrderBy('category.sortOrder', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (serviceId) qb.andWhere('s.id = :serviceId', { serviceId });
    if (q.labId) qb.andWhere('s.lab_id = :labId', { labId: q.labId });
    if (q.categoryId) {
      qb.andWhere('s.category_id = :categoryId', { categoryId: q.categoryId });
    }
    if (q.mapped !== undefined) {
      qb.andWhere(
        `${q.mapped ? '' : 'NOT '}EXISTS (SELECT 1 FROM service_mappings sm
           WHERE sm.lab_service_id = s.id AND sm.organization_id = :organizationId
             AND sm.is_active)`,
      );
    }
    if (q.search) {
      const term = likePattern(q.search);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('s.name ILIKE :term', { term })
            .orWhere('s.code ILIKE :term', { term })
            .orWhere('lab.name ILIKE :term', { term }),
        ),
      );
    }
    const [rows, total] = (await qb.getManyAndCount()) as [
      Array<LabService & { clinicLink: LabClinicLink }>,
      number,
    ];
    const ids = rows.map((r) => r.id);
    const m = this.dataSource.manager;
    const options = await this.services.optionsFor(m, ids);
    const today = this.clock.today(CATALOG_TIMEZONE);
    const windows = ids.length
      ? await m.getRepository(LabServicePrice).find({
          where: [
            { labServiceId: In(ids), organizationId, voidedAt: IsNull() },
            {
              labServiceId: In(ids),
              organizationId: IsNull(),
              voidedAt: IsNull(),
            },
          ],
        })
      : [];
    const mappings = ids.length
      ? await m.getRepository(ServiceMapping).find({
          where: { organizationId, labServiceId: In(ids), isActive: true },
          relations: { clinicTreatment: true },
        })
      : [];
    const patientPrices = await this.patientPrices(
      tenant,
      mappings.map((x) => x.clinicTreatment),
    );

    return PaginatedResponseDto.create(
      rows.map((s) => {
        const picked = pickLabPrice(
          windows.filter((w) => w.labServiceId === s.id),
          organizationId,
          today,
        );
        const mapping = mappings.find((x) => x.labServiceId === s.id);
        return {
          ...toServiceResponse(
            s,
            (options.get(s.id) ?? []).filter((o) => o.isActive),
          ),
          lab: { id: s.lab.id, name: s.lab.name, city: s.lab.city },
          linkStatus: s.clinicLink.status,
          price: picked ? toEffectivePrice(picked.price, picked.source) : null,
          mapping: mapping
            ? {
                id: mapping.id,
                clinicTreatmentId: mapping.clinicTreatmentId,
                clinicTreatmentName: mapping.clinicTreatment.name,
                isDefault: mapping.isDefault,
              }
            : null,
          patientPricePaisa: mapping
            ? (patientPrices.get(mapping.clinicTreatmentId) ?? null)
            : null,
        };
      }),
      total,
      q.page,
      q.limit,
    );
  }

  /** One service the clinic can see. Unknown / unlinked → 404. */
  async get(
    tenant: TenantContext,
    id: string,
  ): Promise<ClinicServiceRowWithPatient> {
    const page = await this.list(
      tenant,
      { page: 1, limit: 1 } as ClinicLabServicesQueryDto,
      id,
    );
    const row = page.data[0];
    if (!row) throw catalogError('LAB_SERVICE_NOT_FOUND', 'Service not found');
    return row;
  }

  /** The clinic's treatments (billing catalog) for the mapping picker. */
  async treatments(
    tenant: TenantContext,
    search?: string | null,
  ): Promise<ClinicTreatmentRow[]> {
    const qb = this.dataSource
      .getRepository(CatalogService)
      .createQueryBuilder('t')
      .where('t.organization_id = :organizationId', {
        organizationId: tenant.organizationId,
      })
      .orderBy('t.isActive', 'DESC')
      .addOrderBy('t.sortOrder', 'ASC')
      .addOrderBy('t.name', 'ASC')
      .take(200);
    if (search) {
      const term = likePattern(search);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('t.name ILIKE :term', { term })
            .orWhere('t.code ILIKE :term', { term }),
        ),
      );
    }
    const rows = await qb.getMany();
    const prices = await this.patientPrices(tenant, rows);
    const counts = new Map<string, number>();
    if (rows.length) {
      const res = await sqlRows<{ clinic_treatment_id: string; n: string }>(
        this.dataSource.manager,
        `SELECT clinic_treatment_id, count(*) AS n FROM service_mappings
          WHERE organization_id = $1 AND is_active
            AND clinic_treatment_id = ANY($2::uuid[])
          GROUP BY clinic_treatment_id`,
        [tenant.organizationId, rows.map((r) => r.id)],
      );
      for (const r of res) counts.set(r.clinic_treatment_id, Number(r.n));
    }
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      kind: t.kind,
      isActive: t.isActive,
      pricePaisa: prices.get(t.id) ?? toPaisa(t.defaultPrice),
      mappedServiceCount: counts.get(t.id) ?? 0,
    }));
  }

  /** Location price (no doctor) or the treatment default, in paisa. */
  private async patientPrices(
    tenant: TenantContext,
    treatments: CatalogService[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (const t of treatments) out.set(t.id, toPaisa(t.defaultPrice));
    if (!treatments.length || !tenant.locationId) return out;
    const overrides = await this.dataSource.getRepository(ServicePrice).findBy({
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
      serviceId: In(treatments.map((t) => t.id)),
      doctorId: IsNull(),
    });
    for (const o of overrides) out.set(o.serviceId, toPaisa(o.price));
    return out;
  }
}
