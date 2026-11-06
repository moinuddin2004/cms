import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConsumptionTemplate } from '../entities/consumption-template.entity';
import { ConsumptionTemplateItem } from '../entities/consumption-template-item.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { assertAllInOrg } from 'src/common/tenancy/assert-in-org';
import {
  CreateConsumptionTemplateDto,
  UpdateConsumptionTemplateDto,
} from '../dto/consumption-template.dto';

@Injectable()
export class ConsumptionTemplateService {
  constructor(
    @InjectRepository(ConsumptionTemplate)
    private readonly templateRepo: Repository<ConsumptionTemplate>,
    @InjectRepository(ConsumptionTemplateItem)
    private readonly templateItemRepo: Repository<ConsumptionTemplateItem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    organizationId: string,
    dto: CreateConsumptionTemplateDto,
  ): Promise<ConsumptionTemplate> {
    await assertAllInOrg(
      this.dataSource.manager,
      InventoryItem,
      dto.items.map((l) => l.inventoryItemId),
      { organizationId },
      'Inventory item',
    );
    const items = dto.items.map((line, index) =>
      this.templateItemRepo.create({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        notes: line.notes ?? null,
        sortOrder: line.sortOrder ?? index,
      }),
    );

    const template = this.templateRepo.create({
      organizationId,
      name: dto.name,
      procedureName: dto.procedureName,
      appointmentType: dto.appointmentType ?? null,
      items,
    });

    const saved = await this.templateRepo.save(template);
    return this.findOne(saved.id, organizationId);
  }

  async findAll(organizationId: string): Promise<ConsumptionTemplate[]> {
    return this.templateRepo.find({
      where: { organizationId, isActive: true },
      order: { procedureName: 'ASC' },
    });
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<ConsumptionTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id, organizationId },
    });
    if (!template) throw new NotFoundException('Consumption template not found');
    return template;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateConsumptionTemplateDto,
  ): Promise<ConsumptionTemplate> {
    const template = await this.findOne(id, organizationId);
    await assertAllInOrg(
      this.dataSource.manager,
      InventoryItem,
      (dto.items ?? []).map((l) => l.inventoryItemId),
      { organizationId },
      'Inventory item',
    );

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.procedureName !== undefined)
      template.procedureName = dto.procedureName;
    if (dto.appointmentType !== undefined)
      template.appointmentType = dto.appointmentType;

    await this.dataSource.transaction(async (manager) => {
      const templateRepo = manager.getRepository(ConsumptionTemplate);
      const itemRepo = manager.getRepository(ConsumptionTemplateItem);

      await templateRepo.save(template);

      if (dto.items !== undefined) {
        // Replace all existing items
        await itemRepo.delete({ templateId: id });
        const newItems = dto.items.map((line, index) =>
          itemRepo.create({
            templateId: id,
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity,
            notes: line.notes ?? null,
            sortOrder: line.sortOrder ?? index,
          }),
        );
        await itemRepo.save(newItems);
      }
    });

    return this.findOne(id, organizationId);
  }

  async deactivate(
    id: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const template = await this.findOne(id, organizationId);
    template.isActive = false;
    await this.templateRepo.save(template);
    return { id };
  }

  async findByAppointmentType(
    organizationId: string,
    appointmentType: string,
  ): Promise<ConsumptionTemplate | null> {
    return this.templateRepo.findOne({
      where: { organizationId, appointmentType, isActive: true },
    });
  }
}
