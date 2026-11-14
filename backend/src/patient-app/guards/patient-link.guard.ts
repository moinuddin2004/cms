import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PatientRecordLink } from '../entities/patient-record-link.entity';
import {
  PatientContext,
  PatientRequest,
} from '../context/patient-context';

interface PatientContextRow {
  profileId: string;
  profileRelation: PatientContext['profiles'][number]['relation'];
  linkId: string | null;
  linkProfileId: string | null;
  organizationId: string | null;
  patientId: string | null;
  linkStatus: 'active' | 'frozen' | null;
}

@Injectable()
export class PatientLinkGuard implements CanActivate {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly profiles: Repository<PatientProfile>,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PatientRequest>();
    const auth = request.patientAuth;
    if (!auth) throw new UnauthorizedException();

    const rows = await this.profiles
      .createQueryBuilder('profile')
      .select([
        'profile.id AS "profileId"',
        'profile.relation AS "profileRelation"',
        'link.id AS "linkId"',
        'link.profileId AS "linkProfileId"',
        'link.organizationId AS "organizationId"',
        'link.patientId AS "patientId"',
        'link.status AS "linkStatus"',
      ])
      .leftJoin(
        PatientRecordLink,
        'link',
        'link.profileId = profile.id AND link.status IN (:...linkStatuses)',
        { linkStatuses: ['active', 'frozen'] },
      )
      .where('profile.accountId = :accountId', {
        accountId: auth.accountId,
      })
      .orderBy('profile.id', 'ASC')
      .addOrderBy('link.id', 'ASC')
      .getRawMany<PatientContextRow>();

    const organizationIds = [
      ...new Set(
        rows.flatMap((row) =>
          row.linkId && row.organizationId ? [row.organizationId] : [],
        ),
      ),
    ];
    const featureStates = new Map(
      await Promise.all(
        organizationIds.map(async (organizationId) => [
          organizationId,
          await this.featureFlags.isFeatureEnabled(
            organizationId,
            'patient_app',
          ),
        ] as const),
      ),
    );

    const profiles = new Map<
      string,
      PatientContext['profiles'][number]
    >();
    const links: PatientContext['links'] = [];
    for (const row of rows) {
      if (!profiles.has(row.profileId)) {
        profiles.set(row.profileId, {
          id: row.profileId,
          relation: row.profileRelation,
          isSelf: row.profileRelation === 'self',
        });
      }
      if (
        row.linkId &&
        row.linkProfileId &&
        row.organizationId &&
        row.patientId &&
        row.linkStatus
      ) {
        links.push({
          id: row.linkId,
          profileId: row.linkProfileId,
          organizationId: row.organizationId,
          patientId: row.patientId,
          status: row.linkStatus,
          patientAppEnabled: featureStates.get(row.organizationId) ?? false,
        });
      }
    }

    request.patientContext = {
      accountId: auth.accountId,
      sessionId: auth.sessionId,
      profiles: [...profiles.values()],
      links,
    };
    return true;
  }
}
