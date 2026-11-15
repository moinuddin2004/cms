import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { SettingsRegistryService } from 'src/settings-registry/settings-registry.service';
import type { PatientContext } from '../context/patient-context';
import { PATIENT_APP_SETTINGS } from '../patient-app.settings';
import type { ClinicRefDto } from './patient-reads.types';
import { clinicStatusFor, ClinicVisibility } from './visibility';

export interface ClinicInfo extends ClinicVisibility {
  ref: ClinicRefDto;
  currency: string;
  timezone: string;
}

export interface VisibleScope {
  /** The caller's context narrowed to clinics whose records may be shown. */
  ctx: PatientContext;
  clinics: Map<string, ClinicInfo>;
}

const THEME_LOGO = 'theme.logo_url';
const THEME_BRAND = 'theme.brand_color';

/**
 * Resolves, per clinic the account is linked to: its display data, its
 * status (A-19) and the two `patient_app.*` visibility settings. The
 * returned context is what every read query is scoped with.
 */
@Injectable()
export class PatientClinicsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsRegistryService,
  ) {}

  async visibleScope(ctx: PatientContext): Promise<VisibleScope> {
    const orgIds = [...new Set(ctx.links.map((l) => l.organizationId))];
    const clinics = new Map<string, ClinicInfo>();
    if (orgIds.length === 0) return { ctx, clinics };

    const orgs = await this.dataSource.getRepository(Organization).find({
      where: { id: In(orgIds) },
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        isActive: true,
        currency: true,
        timezone: true,
      },
    });

    await Promise.all(
      orgs.map(async (org) => {
        const status = clinicStatusFor(org);
        if (!status) return; // never approved → nothing at all
        const v = await this.settings.getMany(
          [
            THEME_LOGO,
            THEME_BRAND,
            PATIENT_APP_SETTINGS.showBilling.key,
            PATIENT_APP_SETTINGS.showDiagnosis.key,
          ],
          { organizationId: org.id },
        );
        clinics.set(org.id, {
          ref: {
            organizationId: org.id,
            name: org.name,
            logoUrl: (v[THEME_LOGO] as string | null) ?? null,
            brandColor: (v[THEME_BRAND] as string | null) ?? null,
            clinicStatus: status,
          },
          currency: org.currency,
          timezone: org.timezone,
          showBilling: v[PATIENT_APP_SETTINGS.showBilling.key] !== false,
          showDiagnosis: v[PATIENT_APP_SETTINGS.showDiagnosis.key] !== false,
        });
      }),
    );

    return {
      ctx: {
        ...ctx,
        links: ctx.links.filter((l) => clinics.has(l.organizationId)),
      },
      clinics,
    };
  }

  /** Same scope, further narrowed to clinics with the given capability on. */
  narrow(scope: VisibleScope, allow: (c: ClinicInfo) => boolean): VisibleScope {
    const clinics = new Map(
      [...scope.clinics].filter(([, info]) => allow(info)),
    );
    return {
      ctx: {
        ...scope.ctx,
        links: scope.ctx.links.filter((l) => clinics.has(l.organizationId)),
      },
      clinics,
    };
  }
}
