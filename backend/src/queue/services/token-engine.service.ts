import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { QueueErrors } from '../queue.errors';
import { sqlRows } from 'src/common/database/sql';

/**
 * Token Engine. A token is (doctor, location, service date, number) — in the
 * database, a `queue_sessions` row plus an integer. Numbers come from the
 * session's own counter column, never a SEQUENCE: a rollback rolls the
 * counter back too, so there are no gaps, and a number is never reused.
 *
 * Every method that writes takes the caller's transaction (EntityManager);
 * it cannot run on its own.
 */
@Injectable()
export class TokenEngine {
  /**
   * Create the doctor's session for the service day if it doesn't exist yet
   * (race-safe), and return its id. Sessions start on the first check-in —
   * there is no separate "open queue" step.
   */
  async ensureSession(
    tx: EntityManager,
    args: {
      organizationId: string;
      locationId: string;
      doctorId: string;
      serviceDate: string;
      smartQueueEnabled: boolean;
    },
  ): Promise<string> {
    const tokenPrefix = await this.resolvePrefix(
      tx,
      args.organizationId,
      args.locationId,
      args.doctorId,
    );
    await tx.query(
      `INSERT INTO queue_sessions
         (organization_id, location_id, doctor_id, service_date, smart_queue_enabled, token_prefix)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ON CONSTRAINT uq_queue_session_doctor_day DO NOTHING`,
      [
        args.organizationId,
        args.locationId,
        args.doctorId,
        args.serviceDate,
        args.smartQueueEnabled,
        tokenPrefix,
      ],
    );
    const rows = await sqlRows<{ id: string }>(
      tx,
      `SELECT id FROM queue_sessions
        WHERE organization_id = $1 AND location_id = $2 AND doctor_id = $3 AND service_date = $4`,
      [args.organizationId, args.locationId, args.doctorId, args.serviceDate],
    );
    return rows[0].id;
  }

  /**
   * Allocate the next token in an (already locked) session. 0 rows means the
   * session is closed for the day.
   */
  async nextToken(tx: EntityManager, sessionId: string): Promise<number> {
    const [row] = await sqlRows<{ last_token_number: number }>(
      tx,
      `UPDATE queue_sessions
          SET last_token_number = last_token_number + 1, version = version + 1
        WHERE id = $1 AND status <> 'closed'
        RETURNING last_token_number`,
      [sessionId],
    );
    if (!row) throw QueueErrors.sessionNotOpen('closed');
    return Number(row.last_token_number);
  }

  /** "A-007"; four digits after 999. */
  format(prefix: string, n: number): string {
    return `${prefix}-${String(n).padStart(3, '0')}`;
  }

  /** Doctor's prefix at this location: the assignment's, else the name's first letter. */
  prefixFor(
    assignment: Pick<EmployeeOrgLocationAssignment, 'tokenPrefix'> | null,
    doctorName: string | null | undefined,
  ): string {
    const raw =
      assignment?.tokenPrefix?.trim() ||
      (doctorName ?? '')
        .replace(/^(dr\.?\s+)/i, '')
        .trim()
        .charAt(0) ||
      'T';
    return (
      raw
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'T'
    );
  }

  private async resolvePrefix(
    tx: EntityManager,
    organizationId: string,
    locationId: string,
    doctorId: string,
  ): Promise<string> {
    const [assignment, doctor] = await Promise.all([
      tx.getRepository(EmployeeOrgLocationAssignment).findOne({
        where: { organizationId, locationId, employeeId: doctorId },
        select: { id: true, tokenPrefix: true },
      }),
      tx.getRepository(Employee).findOne({
        where: { id: doctorId },
        select: { id: true, fullName: true },
      }),
    ]);
    return this.prefixFor(assignment, doctor?.fullName);
  }
}
