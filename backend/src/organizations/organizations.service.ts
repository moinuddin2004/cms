import {
  Injectable,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationSettings } from './entities/organization-settings.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessTemplatesService } from 'src/access/templates/access-templates.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationSettings)
    private readonly settingsRepo: Repository<OrganizationSettings>,
    private readonly featureFlagsService: FeatureFlagsService,
    @Optional() private readonly accessTemplates?: AccessTemplatesService,
  ) {}

  /**
   * Create a new organization with an auto-generated slug.
   */
  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const slug = this.generateSlug(dto.name);

    // Ensure unique slug
    const existing = await this.orgRepo.findOneBy({ slug });
    if (existing) {
      throw new ConflictException(`Organization slug "${slug}" already exists`);
    }

    const org = this.orgRepo.create({
      ...dto,
      slug,
    });
    const saved = await this.orgRepo.save(org);

    // Seed default feature flags for the new organization
    await this.featureFlagsService.seedFlagsForOrg(saved.id);
    // System role templates (Admin, Doctor, Receptionist, …)
    await this.accessTemplates?.seedForOrg(saved.id);

    return saved;
  }

  /**
   * Get all organizations (super admin only).
   */
  async findAll(): Promise<Organization[]> {
    return this.orgRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Get a single organization by ID.
   */
  async findOne(id: string): Promise<Organization> {
    const org = await this.orgRepo.findOneBy({ id });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  /**
   * Update an organization.
   */
  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.findOne(id);
    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  /**
   * Deactivate an organization (soft-delete).
   */
  async deactivate(id: string): Promise<Organization> {
    const org = await this.findOne(id);
    org.isActive = false;
    return this.orgRepo.save(org);
  }

  /**
   * Get organization settings.
   */
  async getSettings(id: string): Promise<OrganizationSettings> {
    await this.findOne(id); // Ensure org exists
    let settings = await this.settingsRepo.findOne({
      where: { organizationId: id },
    });

    if (!settings) {
      settings = this.settingsRepo.create({ organizationId: id });
      settings = await this.settingsRepo.save(settings);
    }

    return settings;
  }

  /**
   * Update organization settings.
   */
  async updateSettings(id: string, dto: any): Promise<OrganizationSettings> {
    const settings = await this.getSettings(id);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  /**
   * Generate a URL-safe slug from a name.
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
