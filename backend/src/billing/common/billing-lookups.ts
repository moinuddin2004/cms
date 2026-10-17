import { EntityManager, In } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { User } from 'src/user/entities/user.entity';
import { PatientRef } from '../mappers/billing-response.types';
import { notFound } from './billing-errors';

/** Cross-module reads billing needs, tenant-checked (10.1). */
export const BillingLookups = {
  async patient(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientRef> {
    const p = await manager.getRepository(Patient).findOne({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true, fullName: true, phone: true, patientNumber: true },
    });
    if (!p) throw notFound('Patient');
    return toPatientRef(p);
  },

  async patients(
    manager: EntityManager,
    tenant: TenantContext,
    ids: string[],
  ): Promise<Map<string, PatientRef>> {
    const list = [...new Set(ids)];
    if (!list.length) return new Map();
    const rows = await manager.getRepository(Patient).find({
      where: { id: In(list), organizationId: tenant.organizationId },
      select: { id: true, fullName: true, phone: true, patientNumber: true },
    });
    return new Map(rows.map((p) => [p.id, toPatientRef(p)]));
  },

  /** The doctor must work for this organization (employees are org-less, V4). */
  async assertDoctor(
    manager: EntityManager,
    tenant: TenantContext,
    doctorId: string,
  ): Promise<void> {
    const ok = await manager
      .getRepository(EmployeeOrgLocationAssignment)
      .exists({
        where: { employeeId: doctorId, organizationId: tenant.organizationId },
      });
    if (!ok) throw notFound('Doctor');
  },

  /** users.name for "issued by" / "received by" labels. */
  async userNames(
    manager: EntityManager,
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    if (!list.length) return new Map();
    const rows = await manager.getRepository(User).find({
      where: { uuid: In(list) },
      select: { uuid: true, name: true, email: true },
    });
    return new Map(rows.map((u) => [u.uuid, u.name || u.email]));
  },
};

export function toPatientRef(
  p: Pick<Patient, 'id' | 'fullName' | 'phone' | 'patientNumber'>,
): PatientRef {
  return {
    id: p.id,
    name: p.fullName,
    phone: p.phone ?? null,
    mrn: p.patientNumber ?? null,
  };
}
