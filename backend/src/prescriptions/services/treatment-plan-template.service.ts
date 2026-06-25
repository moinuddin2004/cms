import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TreatmentPlanTemplate } from '../entities/treatment-plan-template.entity';
import { TreatmentPlanTemplateMedicine } from '../entities/treatment-plan-template-medicine.entity';
import { MealRelation } from '../enums/meal-relation.enum';
import {
  CreateTemplateMedicineDto,
  CreateTreatmentPlanTemplateDto,
  UpdateTreatmentPlanTemplateDto,
} from '../dto/treatment-plan-template.dto';

@Injectable()
export class TreatmentPlanTemplateService {
  constructor(
    @InjectRepository(TreatmentPlanTemplate)
    private readonly repo: Repository<TreatmentPlanTemplate>,
    @InjectRepository(TreatmentPlanTemplateMedicine)
    private readonly medicineRepo: Repository<TreatmentPlanTemplateMedicine>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    organizationId: string,
    dto: CreateTreatmentPlanTemplateDto,
    createdBy: string | null,
  ): Promise<TreatmentPlanTemplate> {
    const template = this.repo.create({
      organizationId,
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category,
      specialtyTags: dto.specialtyTags ?? ['general'],
      furtherPlan: dto.furtherPlan ?? null,
      instructionsEnglish: dto.instructionsEnglish ?? null,
      instructionsUrdu: dto.instructionsUrdu ?? null,
      createdBy,
      medicines: this.toMedicineEntities(dto.medicines),
    });
    return this.repo.save(template);
  }

  async findAll(
    organizationId: string,
    category?: string,
  ): Promise<TreatmentPlanTemplate[]> {
    const where: any = { organizationId, isActive: true };
    if (category) where.category = category;
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<TreatmentPlanTemplate> {
    const row = await this.repo.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Treatment plan template not found');
    return row;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateTreatmentPlanTemplateDto,
  ): Promise<TreatmentPlanTemplate> {
    const template = await this.findOne(id, organizationId);

    // Replace-all pattern: if medicines provided, drop existing and insert new.
    // Same approach used by ConsumptionTemplate — atomic via transaction.
    if (dto.medicines) {
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(TreatmentPlanTemplateMedicine, {
          templateId: template.id,
        });
        const newRows = manager.create(
          TreatmentPlanTemplateMedicine,
          dto.medicines!.map((m, idx) => ({
            ...m,
            mealRelation: m.mealRelation ?? MealRelation.NONE,
            frequencyTiming: m.frequencyTiming ?? [],
            sortOrder: m.sortOrder ?? idx,
            templateId: template.id,
          })),
        );
        await manager.save(newRows);

        const { medicines, ...rest } = dto;
        manager.merge(TreatmentPlanTemplate, template, rest as any);
        await manager.save(template);
      });
    } else {
      Object.assign(template, dto);
      await this.repo.save(template);
    }

    return this.findOne(id, organizationId);
  }

  async deactivate(
    id: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const row = await this.findOne(id, organizationId);
    row.isActive = false;
    await this.repo.save(row);
    return { id };
  }

  private toMedicineEntities(
    medicines: CreateTemplateMedicineDto[],
  ): TreatmentPlanTemplateMedicine[] {
    return medicines.map((m, idx) =>
      this.medicineRepo.create({
        ...m,
        mealRelation: m.mealRelation ?? MealRelation.NONE,
        frequencyTiming: m.frequencyTiming ?? [],
        sortOrder: m.sortOrder ?? idx,
      }),
    );
  }
}
