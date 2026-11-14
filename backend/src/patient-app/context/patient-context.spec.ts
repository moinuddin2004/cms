import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ObjectLiteral } from 'typeorm';
import {
  assertProfile,
  assertWritableLink,
  linkedPatientWhere,
  PatientContext,
} from './patient-context';

const context: PatientContext = {
  accountId: 'account-a',
  sessionId: 'session-a',
  profiles: [
    { id: 'profile-a', relation: 'self', isSelf: true },
    { id: 'profile-child', relation: 'child', isSelf: false },
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
      id: 'link-child',
      profileId: 'profile-child',
      organizationId: 'org-b',
      patientId: 'patient-b',
      status: 'frozen',
      patientAppEnabled: false,
    },
  ],
};

function queryBuilder() {
  const conditions: {
    sql: string;
    parameters?: ObjectLiteral;
  }[] = [];
  const fake: Record<string, unknown> = {
    expressionMap: { mainAlias: { name: 'patient' } },
    andWhere(sql: string, parameters?: ObjectLiteral) {
      conditions.push({ sql, parameters });
      return fake;
    },
  };
  return {
    qb: fake as unknown as Parameters<typeof linkedPatientWhere>[0],
    conditions,
  };
}

describe('patient context helpers', () => {
  it('adds a false condition when there are no links', () => {
    const { qb, conditions } = queryBuilder();

    linkedPatientWhere(qb, { ...context, links: [] });

    expect(conditions).toEqual([{ sql: '1 = 0', parameters: undefined }]);
  });

  it('binds linked ids and narrows to a profile owned by the account', () => {
    const { qb, conditions } = queryBuilder();

    linkedPatientWhere(qb, context, { profileId: 'profile-child' });

    expect(conditions).toEqual([
      {
        sql:
          '("patient"."organization_id", "patient"."patient_id") IN ' +
          '((:patientLinkOrg0, :patientLinkId0))',
        parameters: {
          patientLinkOrg0: 'org-b',
          patientLinkId0: 'patient-b',
        },
      },
    ]);
  });

  it('adds a false condition for a profile outside the account', () => {
    const { qb, conditions } = queryBuilder();

    linkedPatientWhere(qb, context, { profileId: 'profile-b' });

    expect(conditions).toEqual([{ sql: '1 = 0', parameters: undefined }]);
  });

  it('excludes frozen links when requested', () => {
    const { qb, conditions } = queryBuilder();

    linkedPatientWhere(qb, context, { includeFrozen: false });

    expect(conditions[0].parameters).toEqual({
      patientLinkOrg0: 'org-a',
      patientLinkId0: 'patient-a',
    });
  });

  it('returns only account profiles and permits writes only through active enabled links', () => {
    expect(assertProfile(context, 'profile-a')).toEqual(context.profiles[0]);
    expect(assertWritableLink(context, 'link-a')).toEqual(context.links[0]);

    expect(() => assertProfile(context, 'foreign-profile')).toThrow(
      NotFoundException,
    );
    expect(() => assertWritableLink(context, 'foreign-link')).toThrow(
      NotFoundException,
    );
    for (const linkId of ['link-child']) {
      try {
        assertWritableLink(context, linkId);
        throw new Error('Expected the link to be read-only');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toMatchObject({
          code: 'PATIENT_APP_DISABLED',
        });
      }
    }
  });
});
