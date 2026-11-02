import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { DiscountKind } from 'src/billing/enums/billing.enums';
import {
  PlanTemplate,
  PlanTemplateItem,
} from './entities/plan-template.entity';
import {
  CreatePlanTemplateDto,
  PlanTemplateItemDto,
  UpdatePlanTemplateDto,
} from './dto/plan-template.dto';
import { PlanTemplateCategory } from './enums/plan-template-category.enum';
import { DEFAULT_PLAN_TEMPLATES } from './default-plan-templates';

/** No kind or a zero value = no discount; a percentage tops out at 100. */
const toDiscount = (
  kind: DiscountKind | null | undefined,
  value: number | null | undefined,
) =>
  !kind || value == null || value <= 0
    ? { discountKind: null, discountValue: null }
    : {
        discountKind: kind,
        discountValue:
          kind === DiscountKind.PERCENTAGE ? Math.min(value, 100) : value,
      };

@Injectable()
export class PlanTemplatesService {
  constructor(
    @InjectRepository(PlanTemplate)
    private readonly repo: Repository<PlanTemplate>,
    @InjectRepository(CatalogService)
    private readonly catalog: Repository<CatalogService>,
  ) {}

  /** Every line must be an active service of this clinic; names come from it. */
  private async toItems(
    organizationId: string,
    items: PlanTemplateItemDto[],
  ): Promise<PlanTemplateItem[]> {
    const ids = [...new Set(items.map((i) => i.serviceId))];
    const services = await this.catalog.find({
      where: { id: In(ids), organizationId, isActive: true },
      select: { id: true, name: true },
    });
    const names = new Map(services.map((s) => [s.id, s.name]));
    if (names.size !== ids.length) {
      throw new BadRequestException(
        'A selected service is not in the clinic catalog any more',
      );
    }
    return items.map((i) => ({
      serviceId: i.serviceId,
      procedureName: names.get(i.serviceId) ?? '',
      estimatedSessions: i.estimatedSessions,
      notes: i.notes?.trim() || null,
    }));
  }

  /**
   * The clinic's templates. A clinic that has never had any gets the
   * predefined set the first time it asks, so the picker is never empty.
   */
  async findAll(
    organizationId: string,
    includeInactive = false,
  ): Promise<PlanTemplate[]> {
    const any = await this.repo.count({ where: { organizationId } });
    if (any === 0) await this.seedDefaults(organizationId);
    return this.repo.find({
      where: includeInactive
        ? { organizationId }
        : { organizationId, isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  private async seedDefaults(organizationId: string): Promise<void> {
    await this.repo.save(
      DEFAULT_PLAN_TEMPLATES.map((t) =>
        this.repo.create({ ...t, organizationId, createdBy: null }),
      ),
    );
  }

  async create(
    organizationId: string,
    dto: CreatePlanTemplateDto,
    createdBy: string | null,
  ): Promise<PlanTemplate> {
    return this.repo.save(
      this.repo.create({
        organizationId,
        name: dto.name.trim(),
        category: dto.category ?? PlanTemplateCategory.GENERAL,
        description: dto.description?.trim() || null,
        items: await this.toItems(organizationId, dto.items),
        ...toDiscount(dto.discountKind, dto.discountValue),
        createdBy,
      }),
    );
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdatePlanTemplateDto,
  ): Promise<PlanTemplate> {
    const row = await this.get(id, organizationId);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.items !== undefined) {
      row.items = await this.toItems(organizationId, dto.items);
    }
    if (dto.discountKind !== undefined || dto.discountValue !== undefined) {
      Object.assign(
        row,
        toDiscount(
          dto.discountKind === undefined ? row.discountKind : dto.discountKind,
          dto.discountValue === undefined
            ? row.discountValue
            : dto.discountValue,
        ),
      );
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }

  /** Permanent. Plans already made from it keep their own copy of the procedures. */
  async remove(id: string, organizationId: string): Promise<void> {
    const row = await this.get(id, organizationId);
    await this.repo.remove(row);
  }

  private async get(id: string, organizationId: string): Promise<PlanTemplate> {
    const row = await this.repo.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Treatment plan template not found');
    return row;
  }
}
