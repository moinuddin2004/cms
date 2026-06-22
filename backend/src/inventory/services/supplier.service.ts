import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateSupplierDto,
  ): Promise<Supplier> {
    const supplier = this.supplierRepo.create({ ...dto, organizationId });
    return this.supplierRepo.save(supplier);
  }

  async findAll(organizationId: string): Promise<Supplier[]> {
    return this.supplierRepo.find({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id, organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id, organizationId);
    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async deactivate(
    id: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const supplier = await this.findOne(id, organizationId);
    supplier.isActive = false;
    await this.supplierRepo.save(supplier);
    return { id };
  }
}
