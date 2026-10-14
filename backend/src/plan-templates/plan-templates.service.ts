import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

const toItems = (items: PlanTemplateItemDto[]): PlanTemplateItem[] =>
  items.map((i) => ({
    procedureName: i.procedureName.trim(),
    estimatedSessions: i.estimatedSessions,
    estimatedCost: i.estimatedCost ?? null,
    notes: i.notes?.trim() || null,
  }));

@Injectable()
export class PlanTemplatesService {
  constructor(
    @InjectRepository(PlanTemplate)
    private readonly repo: Repository<PlanTemplate>,
  ) {}

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

  create(
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
        items: toItems(dto.items),
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
    if (dto.items !== undefined) row.items = toItems(dto.items);
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
