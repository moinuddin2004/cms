import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import { addDays } from 'src/common/clock/tz.util';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { mapConstraintErrors, PRICE_OVERLAP } from '../common/catalog-db';
import { catalogError } from '../common/catalog-errors';
import {
  CreatePriceDto,
  ListPricesQueryDto,
  UpdatePriceDto,
  VoidPriceDto,
} from '../dto/catalog.dto';
import { LabServicePrice } from '../entities/lab-service-price.entity';
import { CATALOG_ENTITY } from '../enums/catalog.enums';
import {
  PRICE_AUDIT_FIELDS,
  PriceResponse,
  toPriceResponse,
} from '../mappers/catalog-response';
import { checkWindowEdit, planNewWindow } from '../pricing/price-resolver';
import { LabServicesService } from './lab-services.service';

/**
 * A lab's price windows for one service: its list price and each clinic's
 * negotiated price. Scoped by lab like `LabServicesService`. Writes lock
 * the service row, so two edits of the same service's prices queue up and
 * the overlap check sees committed data; the exclusion constraint is the
 * last line of defence. Prices are never deleted.
 */
@Injectable()
export class LabServicePricesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly services: LabServicesService,
  ) {}

  async list(
    labId: string,
    serviceId: string,
    q: ListPricesQueryDto,
  ): Promise<PriceResponse[]> {
    const m = this.dataSource.manager;
    await this.services.findService(m, labId, serviceId);
    const rows = await m.getRepository(LabServicePrice).find({
      where: {
        labServiceId: serviceId,
        ...(q.includeVoided ? {} : { voidedAt: IsNull() }),
      },
      relations: { organization: true },
      order: { effectiveFrom: 'DESC', createdAt: 'DESC' },
    });
    // List prices first, then clinics by name; newest window first in each.
    return rows
      .sort((a, b) => {
        const an = a.organization?.name ?? '';
        const bn = b.organization?.name ?? '';
        return an === bn ? 0 : an < bn ? -1 : 1;
      })
      .map(toPriceResponse);
  }

  async create(
    labId: string,
    serviceId: string,
    dto: CreatePriceDto,
    actor: ActorRef,
  ): Promise<PriceResponse> {
    return this.dataSource.transaction(async (m) => {
      const service = await this.services.lockService(m, labId, serviceId);
      const organizationId = dto.organizationId ?? null;
      if (organizationId) await this.assertLinked(m, labId, organizationId);

      const repo = m.getRepository(LabServicePrice);
      const existing = await repo.find({
        where: {
          labServiceId: service.id,
          organizationId: organizationId ?? IsNull(),
          voidedAt: IsNull(),
        },
      });
      const today = this.services.today();
      const { close } = planNewWindow(
        existing,
        {
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo ?? null,
        },
        today,
      );
      if (close) {
        const prev = existing.find((p) => p.id === close.id)!;
        const before = snapshotOf(prev, PRICE_AUDIT_FIELDS);
        prev.effectiveTo = close.effectiveTo;
        prev.updatedBy = actor.userId;
        await repo.save(prev);
        await this.audit.record(m, actor, {
          organizationId,
          entityType: CATALOG_ENTITY.LAB_SERVICE_PRICE,
          entityId: prev.id,
          action: AuditAction.UPDATE,
          before,
          after: snapshotOf(prev, PRICE_AUDIT_FIELDS),
        });
      }
      const price = await mapConstraintErrors(
        () =>
          repo.save(
            repo.create({
              labServiceId: service.id,
              organizationId,
              unitPricePaisa: dto.unitPricePaisa,
              rushSurchargePaisa: dto.rushSurchargePaisa ?? 0,
              effectiveFrom: dto.effectiveFrom,
              effectiveTo: dto.effectiveTo ?? null,
              notes: dto.notes ?? null,
              createdBy: actor.userId,
              updatedBy: actor.userId,
            }),
          ),
        PRICE_OVERLAP,
      );
      await this.audit.record(m, actor, {
        organizationId,
        entityType: CATALOG_ENTITY.LAB_SERVICE_PRICE,
        entityId: price.id,
        action: AuditAction.CREATE,
        after: snapshotOf(price, PRICE_AUDIT_FIELDS),
      });
      return toPriceResponse(await this.reload(m, price.id));
    });
  }

  async update(
    labId: string,
    serviceId: string,
    priceId: string,
    dto: UpdatePriceDto,
    actor: ActorRef,
  ): Promise<PriceResponse> {
    return this.dataSource.transaction(async (m) => {
      await this.services.lockService(m, labId, serviceId);
      const price = await this.lockPrice(m, serviceId, priceId);
      assertVersion(price.version, dto.version);
      const amountsChanged =
        (dto.unitPricePaisa !== undefined &&
          dto.unitPricePaisa !== price.unitPricePaisa) ||
        (dto.rushSurchargePaisa !== undefined &&
          dto.rushSurchargePaisa !== price.rushSurchargePaisa);
      checkWindowEdit(
        price,
        {
          amountsChanged,
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo,
        },
        this.services.today(),
      );

      const before = snapshotOf(price, PRICE_AUDIT_FIELDS);
      if (dto.unitPricePaisa !== undefined)
        price.unitPricePaisa = dto.unitPricePaisa;
      if (dto.rushSurchargePaisa !== undefined)
        price.rushSurchargePaisa = dto.rushSurchargePaisa;
      if (dto.effectiveFrom !== undefined)
        price.effectiveFrom = dto.effectiveFrom;
      if (dto.effectiveTo !== undefined) price.effectiveTo = dto.effectiveTo;
      if (dto.notes !== undefined) price.notes = dto.notes;
      const changed = await this.audit.record(m, actor, {
        organizationId: price.organizationId,
        entityType: CATALOG_ENTITY.LAB_SERVICE_PRICE,
        entityId: price.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(price, PRICE_AUDIT_FIELDS),
      });
      if (changed) {
        price.updatedBy = actor.userId;
        await mapConstraintErrors(
          () => m.getRepository(LabServicePrice).save(price),
          PRICE_OVERLAP,
        );
      }
      return toPriceResponse(await this.reload(m, price.id));
    });
  }

  /**
   * Only a price that never took effect; a running one is ended instead.
   * The price before it is extended over the voided window again.
   */
  async void(
    labId: string,
    serviceId: string,
    priceId: string,
    dto: VoidPriceDto,
    actor: ActorRef,
  ): Promise<PriceResponse> {
    return this.dataSource.transaction(async (m) => {
      await this.services.lockService(m, labId, serviceId);
      const price = await this.lockPrice(m, serviceId, priceId);
      assertVersion(price.version, dto.version);
      if (price.voidedAt) {
        throw catalogError('LAB_PRICE_LOCKED', 'This price was already voided');
      }
      if (price.effectiveFrom <= this.services.today()) {
        throw catalogError(
          'LAB_PRICE_LOCKED',
          'This price is already in use — set an end date instead',
        );
      }
      const repo = m.getRepository(LabServicePrice);
      const before = snapshotOf(price, PRICE_AUDIT_FIELDS);
      price.voidedAt = new Date();
      price.voidReason = dto.reason;
      price.updatedBy = actor.userId;
      await repo.save(price);
      await this.audit.record(m, actor, {
        organizationId: price.organizationId,
        entityType: CATALOG_ENTITY.LAB_SERVICE_PRICE,
        entityId: price.id,
        action: AuditAction.VOID,
        before,
        after: snapshotOf(price, PRICE_AUDIT_FIELDS),
      });

      // The price that ran up to the voided one (e.g. ended when the
      // voided one superseded it) carries on over the voided days.
      const previous = await repo.findOneBy({
        labServiceId: price.labServiceId,
        organizationId: price.organizationId ?? IsNull(),
        effectiveTo: addDays(price.effectiveFrom, -1),
        voidedAt: IsNull(),
      });
      if (previous) {
        const prevBefore = snapshotOf(previous, PRICE_AUDIT_FIELDS);
        previous.effectiveTo = price.effectiveTo;
        previous.updatedBy = actor.userId;
        await mapConstraintErrors(() => repo.save(previous), PRICE_OVERLAP);
        await this.audit.record(m, actor, {
          organizationId: previous.organizationId,
          entityType: CATALOG_ENTITY.LAB_SERVICE_PRICE,
          entityId: previous.id,
          action: AuditAction.UPDATE,
          before: prevBefore,
          after: snapshotOf(previous, PRICE_AUDIT_FIELDS),
        });
      }
      return toPriceResponse(await this.reload(m, price.id));
    });
  }

  async history(
    labId: string,
    serviceId: string,
    priceId: string,
  ): Promise<TimelineEntry[]> {
    const m = this.dataSource.manager;
    await this.services.findService(m, labId, serviceId);
    const exists = await m
      .getRepository(LabServicePrice)
      .existsBy({ id: priceId, labServiceId: serviceId });
    if (!exists) throw catalogError('LAB_PRICE_NOT_FOUND', 'Price not found');
    return this.audit.timeline(
      m,
      CATALOG_ENTITY.LAB_SERVICE_PRICE,
      priceId,
      null,
    );
  }

  /** A negotiated price needs the clinic on the lab's client list. */
  private async assertLinked(
    m: EntityManager,
    labId: string,
    organizationId: string,
  ): Promise<void> {
    const linked = await m
      .getRepository(LabClinicLink)
      .existsBy({ labId, organizationId });
    if (!linked) {
      throw catalogError(
        'LAB_NOT_LINKED',
        'This clinic does not work with this lab yet',
      );
    }
  }

  private async lockPrice(
    m: EntityManager,
    serviceId: string,
    priceId: string,
  ): Promise<LabServicePrice> {
    const price = await m.getRepository(LabServicePrice).findOne({
      where: { id: priceId, labServiceId: serviceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!price) throw catalogError('LAB_PRICE_NOT_FOUND', 'Price not found');
    return price;
  }

  private reload(m: EntityManager, id: string): Promise<LabServicePrice> {
    return m.getRepository(LabServicePrice).findOneOrFail({
      where: { id },
      relations: { organization: true },
    });
  }
}
