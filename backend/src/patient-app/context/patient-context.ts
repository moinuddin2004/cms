import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  ObjectLiteral,
  QueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import type { PatientAuth } from 'src/patient-auth/strategies/patient-jwt.strategy';
import type { PatientProfileRelation } from '../entities/patient-profile.entity';
import type { PatientRecordLinkStatus } from '../entities/patient-record-link.entity';

export interface PatientContext {
  accountId: string;
  sessionId: string;
  profiles: { id: string; relation: PatientProfileRelation; isSelf: boolean }[];
  links: {
    id: string;
    profileId: string;
    organizationId: string;
    patientId: string;
    status: 'active' | 'frozen';
    patientAppEnabled: boolean;
  }[];
}

export type PatientRequest = Request & {
  patientAuth?: PatientAuth;
  patientContext?: PatientContext;
};

export const PatientCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PatientContext => {
    const request = context.switchToHttp().getRequest<PatientRequest>();
    if (!request.patientContext) throw new UnauthorizedException();
    return request.patientContext;
  },
);

export interface LinkedPatientWhereOptions {
  profileId?: string;
  alias?: string;
  orgColumn?: string;
  patientColumn?: string;
  includeFrozen?: boolean;
}

function sqlIdentifier(value: string, label: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${label} identifier`);
  }
  return `"${value}"`;
}

let callSequence = 0;

/**
 * Restrict a query to the account's linked (organization, patient) pairs.
 * The helper always adds a predicate, including when there are no matching links.
 */
export function linkedPatientWhere<
  Qb extends WhereExpressionBuilder &
    Pick<QueryBuilder<ObjectLiteral>, 'expressionMap'>,
>(qb: Qb, ctx: PatientContext, opts: LinkedPatientWhereOptions = {}): Qb {
  const profileIsLinked =
    opts.profileId === undefined ||
    ctx.profiles.some((profile) => profile.id === opts.profileId);
  const links = ctx.links.filter(
    (link) =>
      profileIsLinked &&
      (opts.profileId === undefined || link.profileId === opts.profileId) &&
      (opts.includeFrozen !== false || link.status === 'active'),
  );
  if (links.length === 0) {
    qb.andWhere('1 = 0');
    return qb;
  }

  const alias = opts.alias ?? qb.expressionMap.mainAlias?.name;
  if (!alias) throw new Error('A query alias is required');
  const quotedAlias = sqlIdentifier(alias, 'alias');
  const organizationColumn = `${quotedAlias}.${sqlIdentifier(
    opts.orgColumn ?? 'organization_id',
    'organization column',
  )}`;
  const patientColumn = `${quotedAlias}.${sqlIdentifier(
    opts.patientColumn ?? 'patient_id',
    'patient column',
  )}`;
  // Unique per call: a second call on the same builder must not overwrite the
  // first call's bound parameters.
  const prefix = `patientLink${++callSequence}`;
  const params: Record<string, string> = {};
  const tuples = links.map((link, index) => {
    const organizationKey = `${prefix}Org${index}`;
    const patientKey = `${prefix}Id${index}`;
    params[organizationKey] = link.organizationId;
    params[patientKey] = link.patientId;
    return `(:${organizationKey}, :${patientKey})`;
  });

  qb.andWhere(
    `(${organizationColumn}, ${patientColumn}) IN (${tuples.join(', ')})`,
    params,
  );
  return qb;
}

export function assertProfile(
  ctx: PatientContext,
  profileId: string,
): PatientContext['profiles'][number] {
  const profile = ctx.profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
  }
  return profile;
}

export function assertWritableLink(
  ctx: PatientContext,
  linkId: string,
): PatientContext['links'][number] {
  const link = ctx.links.find((item) => item.id === linkId);
  if (!link) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
  }
  if (link.status !== 'active' || !link.patientAppEnabled) {
    throw new ForbiddenException({
      code: 'PATIENT_APP_DISABLED',
      message: 'This clinic link is read-only',
    });
  }
  return link;
}

export type PatientLinkStatus = PatientRecordLinkStatus;
