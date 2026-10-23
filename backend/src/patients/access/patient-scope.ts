import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import type { AccessContext, ScopeColumns } from 'src/access/access-context';
import { noPermission } from 'src/access/decorators/access.decorators';
import { Patient } from '../entities/patient.entity';

/**
 * Row filter for `patients.view`, for any query that has a patient id column
 * (`p.id`, `rx.patient_id`, …). `own` (doctor) = patients with an
 * appointment or a queue visit (every encounter has one) with this doctor.
 * `location` = registered at, booked at or queued at the active location.
 * Only the column name is interpolated (always a constant from code); the
 * employee / location ids are bound by `applyScope`.
 */
export function patientScope(patientId = 'p.id'): ScopeColumns {
  return {
    ownWhere:
      `EXISTS (SELECT 1 FROM appointments sa WHERE sa.patient_id = ${patientId} AND sa.doctor_id = :employeeId)` +
      ` OR EXISTS (SELECT 1 FROM queue_entries sq JOIN queue_sessions ss ON ss.id = sq.queue_session_id` +
      ` WHERE sq.patient_id = ${patientId} AND ss.doctor_id = :employeeId)`,
    locationWhere:
      `EXISTS (SELECT 1 FROM patients sp WHERE sp.id = ${patientId} AND sp.primary_location_id = :locationId)` +
      ` OR EXISTS (SELECT 1 FROM appointments sa WHERE sa.patient_id = ${patientId} AND sa.location_id = :locationId)` +
      ` OR EXISTS (SELECT 1 FROM queue_entries sq JOIN queue_sessions ss ON ss.id = sq.queue_session_id` +
      ` WHERE sq.patient_id = ${patientId} AND ss.location_id = :locationId)`,
  };
}

/** True when the patient exists in the org and is inside the caller's `patients.view` scope. */
export async function isPatientInScope(
  dataSource: DataSource,
  access: AccessContext,
  patientId: string,
): Promise<boolean> {
  const qb = dataSource
    .getRepository(Patient)
    .createQueryBuilder('p')
    .where('p.id = :patientId AND p.organization_id = :organizationId', {
      patientId,
      organizationId: access.organizationId,
    });
  access.applyScope(qb, 'patients.view', patientScope('p.id'));
  return qb.getExists();
}

const PATIENT_SCOPE_KEY = 'm3:patientScope';

interface PatientScopeOptions {
  /** Where the patient id is: a route param (default) or a query param. */
  from: 'param' | 'query';
  name: string;
}

/**
 * Runs after the global guards (so `request.access` is set): a patient
 * outside the caller's `patients.view` scope answers 404, exactly like a
 * patient of another org, so its existence is not leaked. No id in the
 * request (e.g. `GET /patients`) → nothing to check here.
 */
@Injectable()
export class PatientScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<PatientScopeOptions>(
      PATIENT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opts) return true;
    const req = context.switchToHttp().getRequest<{
      access?: AccessContext;
      params: Record<string, string | undefined>;
      query: Record<string, unknown>;
    }>();
    const raw =
      opts.from === 'param' ? req.params[opts.name] : req.query[opts.name];
    const patientId = typeof raw === 'string' ? raw : undefined;
    if (!patientId) return true;

    // A malformed id is left to the handler's ParseUUIDPipe (400).
    if (!UUID.test(patientId)) return true;
    const access = req.access;
    if (!access)
      throw noPermission(['patients.view'], 'No organization selected');
    if (!(await isPatientInScope(this.dataSource, access, patientId))) {
      throw new NotFoundException('Patient not found');
    }
    return true;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The patient named by route param `name` (or `?name=` with `from: 'query'`)
 * must be inside the caller's `patients.view` scope, else 404.
 */
export const PatientInScope = (
  name = 'id',
  from: 'param' | 'query' = 'param',
) =>
  applyDecorators(
    SetMetadata(PATIENT_SCOPE_KEY, {
      name,
      from,
    } satisfies PatientScopeOptions),
    UseGuards(PatientScopeGuard),
  );
