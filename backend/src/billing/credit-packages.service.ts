import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditPackage } from './entities/credit-package.entity';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/credit-package.dto';

@Injectable()
export class CreditPackagesService {
  constructor(
    @InjectRepository(CreditPackage)
    private readonly packageRepo: Repository<CreditPackage>,
  ) {}

  async create(
    organizationId: string,
    dto: CreateCreditPackageDto,
  ): Promise<CreditPackage> {
    const pkg = this.packageRepo.create({ ...dto, organizationId });
    return this.packageRepo.save(pkg);
  }

  async findAll(organizationId: string): Promise<CreditPackage[]> {
    return this.packageRepo.find({
      where: { organizationId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateCreditPackageDto,
  ): Promise<CreditPackage> {
    const pkg = await this.packageRepo.findOne({
      where: { id, organizationId },
    });
    if (!pkg) throw new NotFoundException('Credit package not found');
    Object.assign(pkg, dto);
    return this.packageRepo.save(pkg);
  }

  async deactivate(id: string, organizationId: string): Promise<CreditPackage> {
    const pkg = await this.packageRepo.findOne({
      where: { id, organizationId },
    });
    if (!pkg) throw new NotFoundException('Credit package not found');
    pkg.isActive = false;
    return this.packageRepo.save(pkg);
  }

  async getOrFail(id: string, organizationId: string): Promise<CreditPackage> {
    const pkg = await this.packageRepo.findOne({
      where: { id, organizationId },
    });
    if (!pkg) throw new NotFoundException('Credit package not found');
    return pkg;
  }
}
