import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In } from 'typeorm';
import { AppLogger } from 'src/common/services/logger.service';
import { AccessTemplatesService } from 'src/access/templates/access-templates.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { Location } from 'src/locations/entities/location.entity';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { User } from 'src/user/entities/user.entity';
import { TRIAL_DAYS, TRIAL_PLAN } from './plans';
import { SetupClinicDto, SetupLocationDto } from './dto/subscription.dto';

const DEFAULT_TIMEZONE = 'Asia/Karachi';
const DEFAULT_CURRENCY = 'PKR';

export interface ClinicSetup {
  clinic: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    specialtyTags: string[];
    timezone: string;
    currency: string;
  };
  location: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    taxRate: number;
  } | null;
  onboardingPending: boolean;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'clinic'
  );
}

/**
 * Self-serve clinic signup and the one-time setup wizard. A signup creates
 * the clinic, its main location and the owner link in one transaction, on a
 * TRIAL_DAYS trial of TRIAL_PLAN.
 */
@Injectable()
export class ClinicSetupService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly featureFlags: FeatureFlagsService,
    private readonly logger: AppLogger,
    @Optional() private readonly accessTemplates?: AccessTemplatesService,
  ) {}

  async createClinicForOwner(
    user: User,
    input: { clinicName: string; phone?: string | null },
  ): Promise<{ organizationId: string; locationId: string }> {
    const now = new Date();
    const result = await this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(Organization);
      const base = slugify(input.clinicName);
      let slug = base;
      while (await orgRepo.exist({ where: { slug } })) {
        slug = `${base}-${randomBytes(3).toString('hex')}`;
      }

      const org = await orgRepo.save(
        orgRepo.create({
          name: input.clinicName.trim(),
          slug,
          email: user.email,
          phone: input.phone?.trim() || null,
          subscriptionPlan: TRIAL_PLAN,
          trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          paidUntil: null,
          onboardingPending: true,
          timezone: DEFAULT_TIMEZONE,
          currency: DEFAULT_CURRENCY,
        }),
      );

      const locRepo = manager.getRepository(Location);
      const location = await locRepo.save(
        locRepo.create({
          organizationId: org.id,
          name: input.clinicName.trim(),
          code: 'MAIN',
          phone: input.phone?.trim() || null,
          email: user.email,
          timezone: DEFAULT_TIMEZONE,
          currency: DEFAULT_CURRENCY,
          isMainBranch: true,
          createdBy: user.uuid,
        }),
      );
      const settingsRepo = manager.getRepository(LocationSettings);
      await settingsRepo.save(
        settingsRepo.create({ locationId: location.id, organizationId: org.id }),
      );

      const ownRepo = manager.getRepository(OrganizationOwnership);
      await ownRepo.save(
        ownRepo.create({
          userId: user.uuid,
          organizationId: org.id,
          isPrimaryOwner: true,
        }),
      );
      await manager.getRepository(User).update(user.uuid, {
        lastAccessedOrganizationId: org.id,
        lastAccessedLocationId: location.id,
      });
      return { organizationId: org.id, locationId: location.id };
    });

    // Same seeding as a super-admin-created org (OrganizationsService.create).
    // Both are idempotent, so a failure here can be fixed by re-running them.
    try {
      await this.featureFlags.seedFlagsForOrg(result.organizationId);
      await this.accessTemplates?.seedForOrg(result.organizationId);
    } catch (err) {
      this.logger.error(
        `Seeding new clinic ${result.organizationId} failed: ${(err as Error).message}`,
        ClinicSetupService.name,
      );
    }
    return result;
  }

  private async mainLocation(orgId: string): Promise<Location | null> {
    return this.dataSource.getRepository(Location).findOne({
      where: { organizationId: orgId, isActive: true },
      order: { isMainBranch: 'DESC', createdAt: 'ASC' },
    });
  }

  async get(orgId: string): Promise<ClinicSetup> {
    const org = await this.dataSource
      .getRepository(Organization)
      .findOneBy({ id: orgId });
    if (!org) throw new NotFoundException('Organization not found');
    const loc = await this.mainLocation(orgId);
    const settings = loc
      ? await this.dataSource
          .getRepository(LocationSettings)
          .findOneBy({ locationId: loc.id })
      : null;
    return {
      clinic: {
        id: org.id,
        name: org.name,
        phone: org.phone,
        email: org.email,
        website: org.website,
        specialtyTags: org.specialtyTags ?? ['general'],
        timezone: org.timezone,
        currency: org.currency,
      },
      location: loc
        ? {
            id: loc.id,
            name: loc.name,
            address: loc.address,
            city: loc.city,
            phone: loc.phone,
            email: loc.email,
            taxRate: Number(settings?.taxRate ?? 0),
          }
        : null,
      onboardingPending: org.onboardingPending,
    };
  }

  async saveClinic(orgId: string, dto: SetupClinicDto): Promise<ClinicSetup> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Organization);
      const org = await repo.findOneBy({ id: orgId });
      if (!org) throw new NotFoundException('Organization not found');
      org.name = dto.name.trim();
      org.phone = dto.phone?.trim() || null;
      org.email = dto.email?.trim() || null;
      org.website = dto.website?.trim() || null;
      org.specialtyTags = dto.specialtyTags.length
        ? dto.specialtyTags
        : ['general'];
      const previousTimezone = org.timezone;
      org.timezone = dto.timezone;
      org.currency = dto.currency.toUpperCase();
      await repo.save(org);
      const locations = manager.getRepository(Location);
      // Branches follow the clinic's currency.
      await locations.update(
        { organizationId: orgId },
        { currency: org.currency },
      );
      // The clinic timezone is the default for branches: only those still on
      // the old default move with it — a branch given its own timezone in
      // location settings keeps it.
      if (previousTimezone !== org.timezone) {
        await locations.update(
          { organizationId: orgId, timezone: In([previousTimezone, 'UTC']) },
          { timezone: org.timezone },
        );
      }
    });
    return this.get(orgId);
  }

  async saveLocation(
    orgId: string,
    dto: SetupLocationDto,
  ): Promise<ClinicSetup> {
    const loc = await this.mainLocation(orgId);
    if (!loc) throw new NotFoundException('Location not found');
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Location).update(loc.id, {
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
      });
      const settingsRepo = manager.getRepository(LocationSettings);
      const settings =
        (await settingsRepo.findOneBy({ locationId: loc.id })) ??
        settingsRepo.create({ locationId: loc.id, organizationId: orgId });
      settings.taxRate = dto.taxRate;
      await settingsRepo.save(settings);
    });
    return this.get(orgId);
  }

  async complete(orgId: string): Promise<ClinicSetup> {
    await this.dataSource
      .getRepository(Organization)
      .update(orgId, { onboardingPending: false });
    return this.get(orgId);
  }
}
