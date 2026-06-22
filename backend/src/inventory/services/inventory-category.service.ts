import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryCategory } from '../entities/inventory-category.entity';
import {
  CreateInventoryCategoryDto,
  UpdateInventoryCategoryDto,
} from '../dto/inventory-category.dto';

const DEFAULT_CATEGORIES = [
  'Disposables',
  'Dental Materials',
  'Medicines',
  'Instruments',
  'Office Supplies',
  'Sterilization',
];

@Injectable()
export class InventoryCategoryService {
  constructor(
    @InjectRepository(InventoryCategory)
    private readonly categoryRepo: Repository<InventoryCategory>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateInventoryCategoryDto,
  ): Promise<InventoryCategory> {
    const category = this.categoryRepo.create({
      ...dto,
      organizationId,
    });
    return this.categoryRepo.save(category);
  }

  async findAll(organizationId: string): Promise<InventoryCategory[]> {
    return this.categoryRepo.find({
      where: { organizationId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateInventoryCategoryDto,
  ): Promise<InventoryCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id, organizationId },
    });
    if (!category) throw new NotFoundException('Category not found');
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async deactivate(
    id: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const category = await this.categoryRepo.findOne({
      where: { id, organizationId },
    });
    if (!category) throw new NotFoundException('Category not found');
    category.isActive = false;
    await this.categoryRepo.save(category);
    return { id };
  }

  async seedDefaults(organizationId: string): Promise<void> {
    const existing = await this.categoryRepo.count({
      where: { organizationId },
    });
    if (existing > 0) return; // already seeded

    const categories = DEFAULT_CATEGORIES.map((name, index) =>
      this.categoryRepo.create({
        organizationId,
        name,
        sortOrder: index,
      }),
    );
    await this.categoryRepo.save(categories);
  }
}
