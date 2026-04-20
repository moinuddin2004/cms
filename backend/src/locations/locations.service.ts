import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { LocationSettings } from './entities/location-settings.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(LocationSettings)
    private readonly settingsRepo: Repository<LocationSettings>,
  ) {}

  /**
   * Create a new location under an organization.
   */
  async create(
    organizationId: string,
    dto: CreateLocationDto,
    createdBy?: string,
  ): Promise<Location> {
    // Check unique code within org
    const existing = await this.locationRepo.findOne({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Location code "${dto.code}" already exists in this organization`,
      );
    }

    const location = this.locationRepo.create({
      ...dto,
      organizationId,
      createdBy: createdBy || null,
    });
    const saved = await this.locationRepo.save(location);

    // Auto-create default settings
    const settings = this.settingsRepo.create({
      locationId: saved.id,
      organizationId,
    });
    await this.settingsRepo.save(settings);

    return saved;
  }

  /**
   * Get all locations for an organization.
   */
  async findByOrganization(organizationId: string): Promise<Location[]> {
    return this.locationRepo.find({
      where: { organizationId, isActive: true },
      order: { isMainBranch: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Get all locations across all organizations (Super Admin only).
   */
  async findAll(): Promise<Location[]> {
    return this.locationRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      relations: ['organization'],
    });
  }

  /**
   * Get a single location.
   */
  async findOne(id: string): Promise<Location> {
    const loc = await this.locationRepo.findOneBy({ id });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  /**
   * Update a location.
   */
  async update(
    id: string,
    dto: UpdateLocationDto,
    updatedBy?: string,
  ): Promise<Location> {
    const loc = await this.findOne(id);
    Object.assign(loc, dto, { updatedBy: updatedBy || loc.updatedBy });
    return this.locationRepo.save(loc);
  }

  /**
   * Deactivate a location (soft-delete).
   */
  async deactivate(id: string): Promise<Location> {
    const loc = await this.findOne(id);
    loc.isActive = false;
    return this.locationRepo.save(loc);
  }

  // ── Location Settings ──

  async getSettings(locationId: string): Promise<LocationSettings> {
    let settings = await this.settingsRepo.findOneBy({ locationId });
    if (!settings) {
      settings = this.settingsRepo.create({ locationId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(
    locationId: string,
    dto: Partial<LocationSettings>,
  ): Promise<LocationSettings> {
    const settings = await this.getSettings(locationId);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }
}
