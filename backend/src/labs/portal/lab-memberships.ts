import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { LabMemberRole, LabStatus, LabType } from '../enums/lab.enums';

/** A lab the user may open in the lab portal. */
export interface LabMembership {
  labId: string;
  labName: string;
  labType: LabType;
  city: string | null;
  role: LabMemberRole;
}

/**
 * The labs a user can work in: active membership of an active lab. This is
 * the only source of lab-side access (lab ERD §7, §13) — used by the portal
 * guard and by the login / me responses. A plain function so the auth
 * module can call it without importing the labs module.
 */
export async function findLabMemberships(
  manager: EntityManager,
  userId: string,
): Promise<LabMembership[]> {
  const rows = await sqlRows<{
    lab_id: string;
    lab_name: string;
    lab_type: LabType;
    city: string | null;
    role: LabMemberRole;
  }>(
    manager,
    `SELECT l.id AS lab_id, l.name AS lab_name, l.lab_type, l.city, m.role
       FROM lab_members m
       JOIN labs l ON l.id = m.lab_id
      WHERE m.user_id = $1 AND m.is_active AND l.status = $2
      ORDER BY l.name, l.id`,
    [userId, LabStatus.ACTIVE],
  );
  return rows.map((r) => ({
    labId: r.lab_id,
    labName: r.lab_name,
    labType: r.lab_type,
    city: r.city,
    role: r.role,
  }));
}
