import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { PatientProfile } from '../entities/patient-profile.entity';
import { PatientLinkGuard, PatientRequest } from './patient-link.guard';

const rows = [
  {
    profileId: 'profile-a',
    profileRelation: 'self' as const,
    linkId: 'link-a',
    linkProfileId: 'profile-a',
    organizationId: 'org-a',
    patientId: 'patient-a',
    linkStatus: 'active' as const,
  },
  {
    profileId: 'profile-a',
    profileRelation: 'self' as const,
    linkId: 'link-frozen',
    linkProfileId: 'profile-a',
    organizationId: 'org-b',
    patientId: 'patient-b',
    linkStatus: 'frozen' as const,
  },
  {
    profileId: 'profile-empty',
    profileRelation: 'child' as const,
    linkId: null,
    linkProfileId: null,
    organizationId: null,
    patientId: null,
    linkStatus: null,
  },
];

function setup(rawRows = rows) {
  const query = {
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
  };
  const profiles = {
    createQueryBuilder: jest.fn().mockReturnValue(query),
  } as unknown as Repository<PatientProfile>;
  const isFeatureEnabled = jest
    .fn()
    .mockImplementation(async (orgId: string) => orgId === 'org-a');
  const featureFlags = { isFeatureEnabled } as unknown as FeatureFlagsService;
  const guard = new PatientLinkGuard(profiles, featureFlags);
  const request: PatientRequest = {
    patientAuth: { accountId: 'account-a', sessionId: 'session-a' },
  } as PatientRequest;
  const executionContext = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, request, executionContext, query, profiles, isFeatureEnabled };
}

describe('PatientLinkGuard', () => {
  it('requires patient authentication before querying profiles', async () => {
    const setupResult = setup();
    setupResult.request.patientAuth = undefined;

    await expect(
      setupResult.guard.canActivate(setupResult.executionContext),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(setupResult.profiles.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('loads profiles and active/frozen links in one query and checks each org once', async () => {
    const { guard, request, executionContext, profiles, isFeatureEnabled } =
      setup();

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);

    expect(profiles.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(isFeatureEnabled).toHaveBeenCalledTimes(2);
    expect(isFeatureEnabled).toHaveBeenCalledWith('org-a', 'patient_app');
    expect(isFeatureEnabled).toHaveBeenCalledWith('org-b', 'patient_app');
    expect(request.patientContext).toEqual({
      accountId: 'account-a',
      sessionId: 'session-a',
      profiles: [
        { id: 'profile-a', relation: 'self', isSelf: true },
        { id: 'profile-empty', relation: 'child', isSelf: false },
      ],
      links: [
        {
          id: 'link-a',
          profileId: 'profile-a',
          organizationId: 'org-a',
          patientId: 'patient-a',
          status: 'active',
          patientAppEnabled: true,
        },
        {
          id: 'link-frozen',
          profileId: 'profile-a',
          organizationId: 'org-b',
          patientId: 'patient-b',
          status: 'frozen',
          patientAppEnabled: false,
        },
      ],
    });
  });

  it('sets no links when every database row has no active or frozen link', async () => {
    const { guard, request, executionContext } = setup([
      {
        profileId: 'profile-a',
        profileRelation: 'self',
        linkId: null,
        linkProfileId: null,
        organizationId: null,
        patientId: null,
        linkStatus: null,
      },
    ]);

    await guard.canActivate(executionContext);

    expect(request.patientContext?.links).toEqual([]);
  });
});
