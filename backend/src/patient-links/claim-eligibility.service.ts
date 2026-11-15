import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ClinicApprovalStatus } from 'src/common/enums/clinic-approval-status.enum';

export type ClaimEligibility =
  | 'ok'
  | 'unapproved'
  | 'suspended'
  | 'app_disabled';

/**
 * DECISIONS A-19: a clinic that was never approved gets no claims at all; a
 * suspended (`is_active = false`) clinic gets no NEW claims or links (existing
 * ones stay readable, frozen). The `patient_app` feature must be active.
 */
@Injectable()
export class ClaimEligibilityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async check(
    organizationId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<ClaimEligibility> {
    const org = await manager.getRepository(Organization).findOne({
      where: { id: organizationId },
      select: { id: true, approvalStatus: true, isActive: true },
    });
    if (!org || org.approvalStatus !== ClinicApprovalStatus.APPROVED) {
      return 'unapproved';
    }
    if (!org.isActive) return 'suspended';
    if (!(await this.featureFlags.isFeatureEnabled(org.id, 'patient_app'))) {
      return 'app_disabled';
    }
    return 'ok';
  }

  /** Throws the error a staff caller / patient should see; `ok` returns. */
  static assertOk(state: ClaimEligibility, hideUnapproved: boolean): void {
    if (state === 'ok') return;
    if (state === 'suspended') {
      throw new ForbiddenException({
        code: 'CLINIC_SUSPENDED',
        message: 'This clinic cannot link new records right now',
      });
    }
    if (state === 'app_disabled') {
      throw new ForbiddenException({
        code: 'PATIENT_APP_DISABLED',
        message: 'The patient app is not enabled for this clinic',
      });
    }
    // unapproved
    if (hideUnapproved) return ClaimEligibilityService.invalid();
    throw new ForbiddenException({
      code: 'CLINIC_NOT_APPROVED',
      message: 'This clinic is not approved yet',
    });
  }

  static invalid(): never {
    // One code for every reason a token is unusable (no enumeration).
    throw new NotFoundException({
      code: 'CLAIM_INVALID',
      message: 'This link is invalid or has expired',
    });
  }
}
