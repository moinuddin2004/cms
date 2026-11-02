import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PrescriptionPreset } from '../entities/prescription-preset.entity';
import { PrescriptionPresetMedicine } from '../entities/prescription-preset-medicine.entity';
import { MealRelation } from '../enums/meal-relation.enum';
import {
  CreateTemplateMedicineDto,
  CreatePrescriptionPresetDto,
  UpdatePrescriptionPresetDto,
} from '../dto/prescription-preset.dto';

@Injectable()
export class PrescriptionPresetService {
  constructor(
    @InjectRepository(PrescriptionPreset)
    private readonly repo: Repository<PrescriptionPreset>,
    @InjectRepository(PrescriptionPresetMedicine)
    private readonly medicineRepo: Repository<PrescriptionPresetMedicine>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    organizationId: string,
    dto: CreatePrescriptionPresetDto,
    createdBy: string | null,
  ): Promise<PrescriptionPreset> {
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
  ): Promise<PrescriptionPreset[]> {
    const where: any = { organizationId, isActive: true };
    if (category) where.category = category;
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<PrescriptionPreset> {
    const row = await this.repo.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Prescription preset not found');
    return row;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdatePrescriptionPresetDto,
  ): Promise<PrescriptionPreset> {
    const template = await this.findOne(id, organizationId);

    // Replace-all pattern: if medicines provided, drop existing and insert new.
    // Same approach used by ConsumptionTemplate — atomic via transaction.
    if (dto.medicines) {
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(PrescriptionPresetMedicine, {
          presetId: template.id,
        });
        const newRows = manager.create(
          PrescriptionPresetMedicine,
          dto.medicines!.map((m, idx) => ({
            ...m,
            mealRelation: m.mealRelation ?? MealRelation.NONE,
            frequencyTiming: m.frequencyTiming ?? [],
            sortOrder: m.sortOrder ?? idx,
            presetId: template.id,
          })),
        );
        await manager.save(newRows);

        const { medicines, ...rest } = dto;
        manager.merge(PrescriptionPreset, template, rest as any);
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
  ): PrescriptionPresetMedicine[] {
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
