import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmploymentRole } from './entities/employment-role.entity';
import { CreateEmploymentRoleDto } from './dto/create-employment-role.dto';
import { UpdateEmploymentRoleDto } from './dto/update-employment-role.dto';

@Injectable()
export class EmploymentRolesService {
  constructor(
    @InjectRepository(EmploymentRole)
    private readonly roleRepo: Repository<EmploymentRole>,
  ) {}

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async findAll(organizationId: string): Promise<EmploymentRole[]> {
    return this.roleRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<EmploymentRole> {
    const role = await this.roleRepo.findOne({
      where: { id, organizationId },
    });
    if (!role) {
      throw new NotFoundException('Employment role not found');
    }
    return role;
  }

  async create(
    organizationId: string,
    dto: CreateEmploymentRoleDto,
  ): Promise<EmploymentRole> {
    const slug = this.slugify(dto.name);

    // Check for duplicate slug within the org
    const existing = await this.roleRepo.findOne({
      where: { organizationId, slug },
    });
    if (existing) {
      throw new ConflictException(
        `A role with the name "${dto.name}" already exists`,
      );
    }

    const role = this.roleRepo.create({
      organizationId,
      name: dto.name,
      slug,
      isSystemRole: dto.isSystemRole ?? false,
      permissions: dto.permissions ?? {},
      isActive: true,
    });

    return this.roleRepo.save(role);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateEmploymentRoleDto,
  ): Promise<EmploymentRole> {
    const role = await this.findOne(id, organizationId);

    if (dto.name !== undefined) {
      const slug = this.slugify(dto.name);
      // Check for duplicate slug (excluding current role)
      const existing = await this.roleRepo.findOne({
        where: { organizationId, slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `A role with the name "${dto.name}" already exists`,
        );
      }
      role.name = dto.name;
      role.slug = slug;
    }

    if (dto.isActive !== undefined) {
      role.isActive = dto.isActive;
    }

    if (dto.permissions !== undefined) {
      role.permissions = dto.permissions;
    }

    return this.roleRepo.save(role);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const role = await this.findOne(id, organizationId);
    await this.roleRepo.remove(role);
  }
}
