import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { MedicineDirectory } from '../entities/medicine-directory.entity';
import { MedicineType } from '../enums/medicine-type.enum';
import { MealRelation } from '../enums/meal-relation.enum';
import {
  CreateMedicineDirectoryDto,
  SearchMedicineDto,
  UpdateMedicineDirectoryDto,
} from '../dto/medicine-directory.dto';

@Injectable()
export class MedicineDirectoryService {
  constructor(
    @InjectRepository(MedicineDirectory)
    private readonly repo: Repository<MedicineDirectory>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateMedicineDirectoryDto,
  ): Promise<MedicineDirectory> {
    const row = this.repo.create({
      ...dto,
      organizationId,
      defaultMealRelation: dto.defaultMealRelation ?? MealRelation.NONE,
    });
    return this.repo.save(row);
  }

  async findAll(organizationId: string): Promise<MedicineDirectory[]> {
    return this.repo.find({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<MedicineDirectory> {
    const row = await this.repo.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Medicine not found');
    return row;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateMedicineDirectoryDto,
  ): Promise<MedicineDirectory> {
    const row = await this.findOne(id, organizationId);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  /** Soft-disable so existing prescriptions still resolve the row by id. */
  async deactivate(
    id: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const row = await this.findOne(id, organizationId);
    row.isActive = false;
    await this.repo.save(row);
    return { id };
  }

  /**
   * Autocomplete query — matches the English name, generic name, or Urdu
   * name. Active rows only, ordered by name, limited.
   */
  async search(
    organizationId: string,
    dto: SearchMedicineDto,
  ): Promise<MedicineDirectory[]> {
    const limit = Math.min(dto.limit ?? 10, 50);
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.organization_id = :organizationId', { organizationId })
      .andWhere('m.is_active = :active', { active: true })
      .andWhere(
        new Brackets((b) => {
          b.where('m.name ILIKE :q', { q: `%${dto.query}%` })
            .orWhere('m.generic_name ILIKE :q', { q: `%${dto.query}%` })
            .orWhere('m.name_urdu ILIKE :q', { q: `%${dto.query}%` });
        }),
      );

    if (dto.type) {
      qb.andWhere('m.type = :type', { type: dto.type });
    }

    return qb.orderBy('m.name', 'ASC').limit(limit).getMany();
  }

  /**
   * One-shot seeding of common medicines for a brand-new org. Idempotent:
   * skips when the directory already has any rows for this org. Doctors are
   * encouraged to extend / customise after seeding.
   */
  async seedCommonMedicines(
    organizationId: string,
  ): Promise<{ seeded: number; skipped: boolean }> {
    const existing = await this.repo.count({ where: { organizationId } });
    if (existing > 0) return { seeded: 0, skipped: true };

    const seeds: Array<Partial<MedicineDirectory>> = [
      {
        name: 'Panadol 500mg Tab',
        genericName: 'Paracetamol',
        type: MedicineType.TABLET,
        strength: '500mg',
        defaultFrequency: '3 times a day',
        defaultDuration: '5 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Brufen 400mg Tab',
        genericName: 'Ibuprofen',
        type: MedicineType.TABLET,
        strength: '400mg',
        defaultFrequency: '3 times a day',
        defaultDuration: '5 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Augmentin 625mg Tab',
        genericName: 'Amoxicillin + Clavulanic Acid',
        type: MedicineType.TABLET,
        strength: '625mg',
        defaultFrequency: '2 times a day',
        defaultDuration: '7 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Flagyl 400mg Tab',
        genericName: 'Metronidazole',
        type: MedicineType.TABLET,
        strength: '400mg',
        defaultFrequency: '3 times a day',
        defaultDuration: '5 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Amoxil 500mg Cap',
        genericName: 'Amoxicillin',
        type: MedicineType.CAPSULE,
        strength: '500mg',
        defaultFrequency: '3 times a day',
        defaultDuration: '5 days',
        defaultMealRelation: MealRelation.BEFORE_MEAL,
      },
      {
        name: 'Ponstan 250mg Cap',
        genericName: 'Mefenamic Acid',
        type: MedicineType.CAPSULE,
        strength: '250mg',
        defaultFrequency: '3 times a day',
        defaultDuration: '3 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Voltral SR 75mg Tab',
        genericName: 'Diclofenac Sodium',
        type: MedicineType.TABLET,
        strength: '75mg',
        defaultFrequency: '2 times a day',
        defaultDuration: '5 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Risek 20mg Cap',
        genericName: 'Omeprazole',
        type: MedicineType.CAPSULE,
        strength: '20mg',
        defaultFrequency: '1 morning',
        defaultDuration: '14 days',
        defaultMealRelation: MealRelation.BEFORE_MEAL,
      },
      {
        name: 'Calpol Syrup',
        genericName: 'Paracetamol',
        type: MedicineType.SYRUP,
        strength: '120mg/5ml',
        defaultFrequency: '3 times a day',
        defaultDuration: '3 days',
        defaultMealRelation: MealRelation.AFTER_MEAL,
      },
      {
        name: 'Disprol Syrup',
        genericName: 'Paracetamol',
        type: MedicineType.SYRUP,
        strength: '120mg/5ml',
        defaultFrequency: 'as needed',
        defaultDuration: 'SOS',
        defaultMealRelation: MealRelation.NONE,
      },
    ];

    const rows = this.repo.create(
      seeds.map((s) => ({ ...s, organizationId })),
    );
    await this.repo.save(rows);
    return { seeded: rows.length, skipped: false };
  }
}
