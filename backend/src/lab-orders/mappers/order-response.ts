import type { TimelineEntry } from 'src/common/audit/audit.service';
import type { FieldDef } from 'src/engine/forms/form-definition.types';
import { PatientDataLevel } from 'src/labs/enums/lab.enums';
import type { Attachment } from '../entities/attachment.entity';
import type { LabOrderItem } from '../entities/lab-order-item.entity';
import type { LabOrder } from '../entities/lab-order.entity';
import { AttachmentVisibility } from '../enums/order.enums';
import type { OrderBundle } from '../services/order-reader.service';
import type { OrderWarning } from '../submit/order-lines';

/**
 * Two views of an order. The clinic sees everything; the lab view (lab ERD
 * §13, §19) never carries the patient price, the clinic's treatment, the
 * patient's records or internal files — and names the patient only as the
 * lab link's `patient_data_level` allows.
 */

const teethOf = (b: OrderBundle, itemId: string) =>
  b.teeth
    .filter((t) => t.itemId === itemId)
    .sort((x, y) => x.toothCode.localeCompare(y.toothCode))
    .map((t) => ({
      tooth: t.toothCode,
      dentition: t.dentition,
      role: t.toothRole,
      surfaces: t.surfaces,
    }));

const detailsOf = (b: OrderBundle, itemId: string) => {
  const d = b.details.get(itemId);
  return d
    ? {
        shadeSystem: d.shadeSystem,
        shade: d.shade,
        materialCode: d.materialCode,
        implantSystem: d.implantSystem,
        implantPlatform: d.implantPlatform,
        implantDiameterMm:
          d.implantDiameterMm === null ? null : Number(d.implantDiameterMm),
        marginType: d.marginType,
      }
    : null;
};

const formOf = (b: OrderBundle, item: LabOrderItem) => {
  const v = item.formSchemaVersionId
    ? b.forms.get(item.formSchemaVersionId)
    : null;
  return v
    ? {
        versionId: v.id,
        versionNo: v.versionNo,
        code: v.formSchema.code,
        name: v.formSchema.name,
        schemaJson: v.schemaJson,
        uiJson: v.uiJson,
      }
    : null;
};

const userName = (b: OrderBundle, id: string | null) =>
  id ? { id, name: b.userNames.get(id) ?? null } : null;

const attachmentView = (b: OrderBundle, a: Attachment) => ({
  id: a.id,
  entityType: a.entityType,
  entityId: a.entityId,
  fileName: a.fileName,
  mimeType: a.mimeType,
  sizeBytes: a.sizeBytes,
  sha256: a.sha256,
  visibility: a.visibility,
  uploadedSide: a.uploadedSide,
  uploadedBy: userName(b, a.uploadedBy),
  createdAt: a.createdAt,
});

const messagesView = (b: OrderBundle) =>
  b.messages.map((x) => ({
    id: x.id,
    itemId: x.itemId,
    kind: x.kind,
    authorSide: x.authorSide,
    author: userName(b, x.authorUserId),
    body: x.body,
    resolvedAt: x.resolvedAt,
    createdAt: x.createdAt,
  }));

const chargesView = (b: OrderBundle) =>
  b.charges.map((x) => ({
    id: x.id,
    itemId: x.itemId,
    kind: x.kind,
    amountPaisa: x.amountPaisa,
    currency: x.currency,
    reason: x.reason,
    status: x.status,
    requestedBy: userName(b, x.requestedBy),
    decidedBy: userName(b, x.decidedBy),
    decidedAt: x.decidedAt,
    decisionNote: x.decisionNote,
    createdAt: x.createdAt,
    version: x.version,
  }));

const revisionsView = (b: OrderBundle) =>
  b.revisions.map((r) => ({
    id: r.id,
    revisionNo: r.revisionNo,
    reason: r.reason,
    createdBy: userName(b, r.createdBy),
    createdAt: r.createdAt,
    labAcknowledgedAt: r.labAcknowledgedAt,
    snapshot: r.snapshot,
  }));

const historyView = (h: TimelineEntry[]) =>
  h.map((e) => ({
    id: e.id,
    kind: e.kind,
    action: e.action,
    fromState: e.fromState,
    toState: e.toState,
    reason: e.reason,
    actorSide: e.actorSide,
    via: e.via,
    actor: e.actor,
    createdAt: e.createdAt,
  }));

const sum = (items: LabOrderItem[], pick: (i: LabOrderItem) => number) =>
  items
    .filter((i) => i.statusCode !== 'cancelled')
    .reduce((s, i) => s + pick(i), 0);

const isDraft = (o: LabOrder) => o.statusCode === 'draft';

export function toClinicOrder(
  b: OrderBundle,
  extra: { availableActions: string[]; warnings: OrderWarning[] },
) {
  const o = b.order;
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.statusCode,
    priority: o.priority,
    requestedOn: o.requestedOn,
    labExpectedOn: o.labExpectedOn,
    notes: o.notes,
    currentRevisionNo: o.currentRevisionNo,
    appointmentId: o.appointmentId,
    treatmentId: o.treatmentId,
    orderTemplateId: o.orderTemplateId,
    submittedAt: o.submittedAt,
    acceptedAt: o.acceptedAt,
    completedAt: o.completedAt,
    cancelledAt: o.cancelledAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    version: o.version,
    patient: {
      id: o.patient.id,
      fullName: o.patient.fullName,
      patientNumber: o.patient.patientNumber,
    },
    doctor: o.doctor ? { id: o.doctor.id, fullName: o.doctor.fullName } : null,
    lab: { id: o.lab.id, name: o.lab.name, city: o.lab.city },
    totals: isDraft(o)
      ? null
      : {
          labCostPaisa: sum(b.items, (i) => i.labLineCostPaisa),
          patientPricePaisa: sum(b.items, (i) => i.patientLinePricePaisa),
        },
    items: b.items.map((i) => {
      const service = b.services.get(i.labServiceId);
      return {
        id: i.id,
        lineNo: i.lineNo,
        labServiceId: i.labServiceId,
        serviceCode: i.serviceCodeSnap ?? service?.code ?? null,
        serviceName: i.serviceNameSnap ?? service?.name ?? null,
        unitType: i.unitType ?? service?.unitType ?? null,
        quantity: i.quantity,
        rush: i.rush,
        optionIds: i.optionIds,
        options: i.optionsSnap,
        clinicTreatmentId: i.clinicTreatmentId,
        prices: isDraft(o)
          ? null
          : {
              currency: i.currency,
              labUnitCostPaisa: i.labUnitCostPaisa,
              labLineCostPaisa: i.labLineCostPaisa,
              patientUnitPricePaisa: i.patientUnitPricePaisa,
              patientLinePricePaisa: i.patientLinePricePaisa,
              pricedOn: i.pricedOn,
            },
        status: i.statusCode,
        form: formOf(b, i),
        answers: b.answers.get(i.id)?.data ?? {},
        validatedAt: b.answers.get(i.id)?.validatedAt ?? null,
        teeth: teethOf(b, i.id),
        details: detailsOf(b, i.id),
        workflowTemplateVersionId: i.workflowTemplateVersionId,
        version: i.version,
      };
    }),
    revisions: revisionsView(b),
    messages: messagesView(b),
    charges: chargesView(b),
    attachments: b.attachments.map((a) => attachmentView(b, a)),
    history: historyView(b.history),
    availableActions: extra.availableActions,
    warnings: extra.warnings,
  };
}

export type ClinicOrderResponse = ReturnType<typeof toClinicOrder>;

/** The patient as the lab may see them. */
export const patientForLab = (
  level: PatientDataLevel,
  p: { fullName: string; patientNumber: string },
) => ({
  ref: level === PatientDataLevel.CODE_ONLY ? p.patientNumber : p.fullName,
  patientNumber: p.patientNumber,
});

export function toLabOrder(b: OrderBundle, level: PatientDataLevel) {
  const o = b.order;
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.statusCode,
    priority: o.priority,
    requestedOn: o.requestedOn,
    labExpectedOn: o.labExpectedOn,
    notes: o.notes,
    currentRevisionNo: o.currentRevisionNo,
    submittedAt: o.submittedAt,
    acceptedAt: o.acceptedAt,
    completedAt: o.completedAt,
    cancelledAt: o.cancelledAt,
    version: o.version,
    clinic: { name: b.clinicName },
    patient: patientForLab(level, o.patient),
    doctor: o.doctor ? { fullName: o.doctor.fullName } : null,
    labCostPaisa: sum(b.items, (i) => i.labLineCostPaisa),
    items: b.items.map((i) => ({
      id: i.id,
      lineNo: i.lineNo,
      labServiceId: i.labServiceId,
      serviceCode: i.serviceCodeSnap,
      serviceName: i.serviceNameSnap,
      unitType: i.unitType,
      quantity: i.quantity,
      rush: i.rush,
      options: i.optionsSnap,
      currency: i.currency,
      labUnitCostPaisa: i.labUnitCostPaisa,
      labLineCostPaisa: i.labLineCostPaisa,
      status: i.statusCode,
      form: formOf(b, i),
      answers: b.answers.get(i.id)?.data ?? {},
      teeth: teethOf(b, i.id),
      details: detailsOf(b, i.id),
      version: i.version,
    })),
    revisions: revisionsView(b),
    messages: messagesView(b),
    charges: chargesView(b),
    attachments: b.attachments
      .filter((a) => a.visibility === AttachmentVisibility.LAB_SHARED)
      .map((a) => attachmentView(b, a)),
  };
}

export type LabOrderResponse = ReturnType<typeof toLabOrder>;

/** Human-readable answers for the printed work order (no teeth / files). */
export function answerRows(
  fields: FieldDef[],
  answers: Record<string, unknown>,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const f of fields) {
    const v = answers[f.key];
    if (v === undefined || v === null || v === '') continue;
    if (f.type === 'tooth_chart' || f.type === 'file') continue;
    let value: string;
    if (f.type === 'select') {
      value =
        f.options.find((o) => o.value === v)?.label ?? String(v as string);
    } else if (f.type === 'multi_select' && Array.isArray(v)) {
      value = v
        .map((x) => f.options.find((o) => o.value === x)?.label ?? String(x))
        .join(', ');
    } else if (f.type === 'boolean') {
      value = v ? 'Yes' : 'No';
    } else if (f.type === 'number') {
      value = `${String(v as number)}${f.unit ? ` ${f.unit}` : ''}`;
    } else {
      value = String(v as string);
    }
    rows.push({ label: f.label, value });
  }
  return rows;
}
