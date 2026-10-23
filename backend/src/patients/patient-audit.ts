import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import type { AccessContext } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';
import { columnSnapshot, Snapshot } from 'src/common/audit/audit-diff';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';

/**
 * `audit_logs.entity_type` of the patient and each of their records. Every
 * row carries the patient as `subject_id`, so one query reads the patient's
 * whole change history.
 */
export const PATIENT_AUDIT_ENTITY = {
  PATIENT: 'patient',
  DENTAL_INFO: 'patient_dental_info',
  TEETH_CHART: 'patient_teeth_chart',
  VITALS: 'patient_vitals',
  TREATMENT_PLAN: 'patient_treatment_plan',
  PLAN_ITEM: 'treatment_plan_item',
  PRESCRIPTION: 'patient_prescription',
  DOCUMENT: 'patient_document',
  CONSENT: 'patient_consent',
  COMMUNICATION: 'patient_communication',
  RECALL: 'patient_recall',
  REFERRAL: 'patient_referral',
  FEEDBACK: 'patient_feedback',
  INSURANCE: 'patient_insurance',
} as const;

export type PatientAuditEntity =
  (typeof PATIENT_AUDIT_ENTITY)[keyof typeof PATIENT_AUDIT_ENTITY];

/**
 * Never recorded: identity and bookkeeping columns (the audit row already
 * says who and when), and file links — reading the log must not hand out a
 * document, X-ray or signature the reader could not open otherwise.
 */
const OMIT = new Set([
  'id',
  'organizationId',
  'patientId',
  'referringPatientId',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'profilePictureUrl',
  'fileUrl',
  'thumbnailUrl',
  'signatureUrl',
  'cardFrontUrl',
  'cardBackUrl',
]);

/** The audited fields of one patient record, in comparable form. */
export function patientRecordSnapshot<T extends ObjectLiteral>(
  manager: EntityManager,
  target: EntityTarget<T>,
  row: T,
): Snapshot {
  return columnSnapshot(manager.connection.getMetadata(target), row, OMIT);
}

/**
 * Writes the audit row of one change to a patient record, in `manager`'s
 * transaction. No `before` → create; no `after` → delete; both → update
 * (skipped when nothing changed).
 */
export function recordPatientChange(
  audit: AuditService,
  manager: EntityManager,
  actor: ActorRef,
  change: {
    organizationId: string;
    patientId: string;
    entityType: PatientAuditEntity;
    entityId: string;
    before: Snapshot | null;
    after: Snapshot | null;
  },
): Promise<boolean> {
  const action = !change.before
    ? AuditAction.CREATE
    : change.after
      ? AuditAction.UPDATE
      : AuditAction.DELETE;
  return audit.record(manager, actor, {
    organizationId: change.organizationId,
    entityType: change.entityType,
    entityId: change.entityId,
    subjectId: change.patientId,
    action,
    before: change.before,
    after: change.after,
  });
}

/** Records whose values only holders of the given permission may read. */
const DETAIL_PERMISSION: Partial<Record<string, Permission>> = {
  [PATIENT_AUDIT_ENTITY.DENTAL_INFO]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.TEETH_CHART]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.VITALS]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.TREATMENT_PLAN]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.PLAN_ITEM]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.PRESCRIPTION]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.CONSENT]: 'patients.clinical.view',
  [PATIENT_AUDIT_ENTITY.DOCUMENT]: 'patients.documents.manage',
};

/** Clinical fields on the patient row itself. */
const CLINICAL_PATIENT_FIELDS = ['medicalHistory', 'allergies'];

/**
 * The patient's history as this reader may see it: every event stays (who
 * did what, when), but the values of records they cannot open are removed.
 */
export function redactPatientTimeline(
  entries: TimelineEntry[],
  access: AccessContext,
): TimelineEntry[] {
  const clinical = access.can('patients.clinical.view');
  return entries.map((entry) => {
    const needed = DETAIL_PERMISSION[entry.entityType];
    if (needed && !access.can(needed)) return { ...entry, changes: null };
    if (entry.entityType !== PATIENT_AUDIT_ENTITY.PATIENT || clinical) {
      return entry;
    }
    return { ...entry, changes: withoutFields(entry.changes) };
  });
}

function withoutFields(changes: TimelineEntry['changes']) {
  if (!changes) return changes;
  const strip = (side: Snapshot | null) => {
    if (!side) return side;
    const copy = { ...side };
    for (const f of CLINICAL_PATIENT_FIELDS) delete copy[f];
    return copy;
  };
  return { before: strip(changes.before), after: strip(changes.after) };
}
