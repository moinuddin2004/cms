import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { PatientDataLevel } from 'src/labs/enums/lab.enums';
import {
  ProductionItemsQueryDto,
  ShipmentsQueryDto,
} from '../dto/production.dto';

/** Which side reads: the lab never sees patient prices or clinic-only data. */
export type ReaderSide = 'clinic' | 'lab';

const frontendBase = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

/** What the slip's QR code opens: the clinic's receive screen. */
export const shipmentQrValue = (token: string): string =>
  `${frontendBase()}/lab-orders/receive/${token}`;

interface StageRow {
  id: string;
  item_id: string;
  seq: number;
  round_no: number;
  code_snap: string;
  name_snap: string;
  is_final: boolean;
  requires_patient_visit: boolean;
  status_code: string;
  is_active: boolean;
  lab_expected_on: string | null;
  appointment_id: string | null;
  outcome: string | null;
  tryin_notes: string | null;
  correction_notes: string | null;
  decided_at: Date | null;
  decided_by_name: string | null;
  started_at: Date | null;
  version: number;
}

interface ShipmentRow {
  id: string;
  organization_id: string;
  lab_id: string;
  shipment_no: string;
  direction: string;
  status: string;
  courier_name: string | null;
  tracking_no: string | null;
  notes: string | null;
  dispatched_at: Date;
  received_at: Date | null;
  lost_at: Date | null;
  lost_reason: string | null;
  qr_token: string;
  version: number;
  clinic_name: string;
  lab_name: string;
}

interface LineRow {
  id: string;
  shipment_id: string;
  order_id: string;
  order_no: string | null;
  order_item_id: string;
  line_no: number;
  service_name_snap: string | null;
  item_status: string | null;
  item_stage_id: string | null;
  stage_name: string | null;
  stage_round: number | null;
  contents: string;
  quantity: number;
  received_qty: number | null;
  condition: string | null;
  qc_result: string | null;
  qc_notes: string | null;
  received_at: Date | null;
}

interface RemakeRow {
  id: string;
  order_id: string;
  order_no: string | null;
  original_item_id: string;
  original_line_no: number;
  service_name_snap: string | null;
  new_item_id: string | null;
  new_line_no: number | null;
  reason_code: string;
  notes: string | null;
  responsible_party: string;
  is_warranty_claim: boolean;
  lab_charge_paisa: string | null;
  patient_charge_paisa: string | null;
  status: string;
  decided_at: Date | null;
  decision_note: string | null;
  dispute_note: string | null;
  created_at: Date;
  version: number;
  clinic_name: string;
}

const num = (v: string | null) => (v === null ? null : Number(v));

const mapStage = (s: StageRow) => ({
  id: s.id,
  seq: s.seq,
  roundNo: s.round_no,
  code: s.code_snap,
  name: s.name_snap,
  isFinal: s.is_final,
  requiresPatientVisit: s.requires_patient_visit,
  status: s.status_code,
  isActive: s.is_active,
  labExpectedOn: s.lab_expected_on,
  appointmentId: s.appointment_id,
  outcome: s.outcome,
  tryinNotes: s.tryin_notes,
  correctionNotes: s.correction_notes,
  decidedAt: s.decided_at,
  decidedBy: s.decided_by_name,
  startedAt: s.started_at,
  version: s.version,
});

const mapLine = (l: LineRow) => ({
  id: l.id,
  orderId: l.order_id,
  orderNo: l.order_no,
  itemId: l.order_item_id,
  lineNo: l.line_no,
  serviceName: l.service_name_snap,
  itemStatus: l.item_status,
  stageId: l.item_stage_id,
  stageName: l.stage_name,
  stageRound: l.stage_round,
  contents: l.contents,
  quantity: l.quantity,
  receivedQty: l.received_qty,
  condition: l.condition,
  qcResult: l.qc_result,
  qcNotes: l.qc_notes,
  receivedAt: l.received_at,
});

const mapRemake = (r: RemakeRow, side: ReaderSide) => ({
  id: r.id,
  orderId: r.order_id,
  orderNo: r.order_no,
  originalItemId: r.original_item_id,
  originalLineNo: r.original_line_no,
  serviceName: r.service_name_snap,
  newItemId: r.new_item_id,
  newLineNo: r.new_line_no,
  reasonCode: r.reason_code,
  notes: r.notes,
  responsibleParty: r.responsible_party,
  isWarrantyClaim: r.is_warranty_claim,
  labChargePaisa: num(r.lab_charge_paisa),
  // The lab never sees what the patient pays (lab ERD §13).
  ...(side === 'clinic'
    ? { patientChargePaisa: num(r.patient_charge_paisa) }
    : {}),
  status: r.status,
  decidedAt: r.decided_at,
  decisionNote: r.decision_note,
  disputeNote: r.dispute_note,
  createdAt: r.created_at,
  version: r.version,
  clinic: { name: r.clinic_name },
});

export type ProductionShipment = ReturnType<
  ProductionReaderService['mapShipment']
>;

/** Read models of production data for both sides (lab ERD §5b). */
@Injectable()
export class ProductionReaderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Stages (every round), assignee, warranty, shipments and remakes of one order. */
  async orderProduction(orderId: string, side: ReaderSide) {
    const db = this.dataSource;
    const items = await sqlRows<{
      id: string;
      line_no: number;
      service_name_snap: string | null;
      quantity: number;
      status_code: string | null;
      current_stage_seq: number | null;
      remake_of_item_id: string | null;
      version: number;
      assignee_member_id: string | null;
      assignee_name: string | null;
      assigned_at: Date | null;
      w_id: string | null;
      w_starts_on: string | null;
      w_ends_on: string | null;
      w_terms: string | null;
      w_voided_at: Date | null;
    }>(
      db,
      `SELECT i.id, i.line_no, i.service_name_snap, i.quantity, i.status_code, i.current_stage_seq,
              i.remake_of_item_id, i.version,
              a.lab_member_id AS assignee_member_id, u.name AS assignee_name, a.assigned_at,
              w.id AS w_id, to_char(w.starts_on, 'YYYY-MM-DD') AS w_starts_on,
              to_char(w.ends_on, 'YYYY-MM-DD') AS w_ends_on, w.terms AS w_terms, w.voided_at AS w_voided_at
         FROM lab_order_items i
         LEFT JOIN item_assignments a ON a.item_id = i.id AND a.unassigned_at IS NULL
         LEFT JOIN lab_members lm ON lm.id = a.lab_member_id
         LEFT JOIN users u ON u.uuid = lm.user_id
         LEFT JOIN item_warranties w ON w.item_id = i.id
        WHERE i.order_id = $1 AND i.status_code IS NOT NULL
        ORDER BY i.line_no`,
      [orderId],
    );
    const stages = await this.stagesOf(`s.order_id = $1`, [orderId]);
    const shipments = await this.shipmentsWhere(
      `s.id IN (SELECT shipment_id FROM shipment_items WHERE order_id = $1)`,
      [orderId],
      { limit: 200, offset: 0 },
    );
    const remakes = await this.remakesWhere(`r.order_id = $1`, [orderId]);
    return {
      items: items.map((i) => ({
        id: i.id,
        lineNo: i.line_no,
        serviceName: i.service_name_snap,
        quantity: i.quantity,
        status: i.status_code,
        currentStageSeq: i.current_stage_seq,
        remakeOfItemId: i.remake_of_item_id,
        version: i.version,
        assignee: i.assignee_member_id
          ? {
              labMemberId: i.assignee_member_id,
              name: i.assignee_name,
              assignedAt: i.assigned_at,
            }
          : null,
        warranty: i.w_id
          ? {
              id: i.w_id,
              startsOn: i.w_starts_on,
              endsOn: i.w_ends_on,
              terms: i.w_terms,
              voidedAt: i.w_voided_at,
            }
          : null,
        stages: stages.filter((s) => s.item_id === i.id).map(mapStage),
        shipmentLines: shipments.rows.flatMap((s) =>
          s.lines
            .filter((l) => l.itemId === i.id)
            .map((l) => ({
              ...l,
              shipmentId: s.id,
              shipmentNo: s.shipmentNo,
              direction: s.direction,
              shipmentStatus: s.status,
            })),
        ),
      })),
      shipments: shipments.rows,
      remakeRequests: remakes.map((r) => mapRemake(r, side)),
    };
  }

  /** Items in production at a lab (the lab's work queue). */
  async labItems(labId: string, q: ProductionItemsQueryDto) {
    const params: unknown[] = [labId];
    const where = [
      'o.lab_id = $1',
      'i.status_code IS NOT NULL',
      `o.status_code <> 'draft'`,
    ];
    if (q.status) {
      params.push(q.status);
      where.push(`i.status_code = $${params.length}`);
    }
    if (q.search?.trim()) {
      params.push(`%${q.search.trim()}%`);
      where.push(
        `(o.order_no ILIKE $${params.length} OR org.name ILIKE $${params.length} OR i.service_name_snap ILIKE $${params.length})`,
      );
    }
    if (q.assigneeId) {
      params.push(q.assigneeId);
      where.push(`a.lab_member_id = $${params.length}`);
    }
    const from = `FROM lab_order_items i
         JOIN lab_orders o ON o.id = i.order_id
         JOIN organizations org ON org.id = o.organization_id
         JOIN patients p ON p.id = o.patient_id
         JOIN lab_clinic_links l ON l.id = o.lab_clinic_link_id
         LEFT JOIN order_item_stages s ON s.item_id = i.id AND s.is_active
         LEFT JOIN item_assignments a ON a.item_id = i.id AND a.unassigned_at IS NULL
         LEFT JOIN lab_members lm ON lm.id = a.lab_member_id
         LEFT JOIN users u ON u.uuid = lm.user_id
        WHERE ${where.join(' AND ')}`;
    const [{ total }] = await sqlRows<{ total: number }>(
      this.dataSource,
      `SELECT count(*)::int AS total ${from}`,
      params,
    );
    const rows = await sqlRows<{
      id: string;
      order_id: string;
      order_no: string | null;
      priority: string;
      line_no: number;
      service_name_snap: string | null;
      quantity: number;
      status_code: string;
      remake_of_item_id: string | null;
      version: number;
      lab_expected_on: string | null;
      clinic_name: string;
      full_name: string;
      patient_number: string;
      data_level: PatientDataLevel;
      stage_id: string | null;
      stage_name: string | null;
      stage_round: number | null;
      stage_status: string | null;
      stage_final: boolean | null;
      stage_count: number;
      assignee_member_id: string | null;
      assignee_name: string | null;
    }>(
      this.dataSource,
      `SELECT i.id, i.order_id, o.order_no, o.priority, i.line_no, i.service_name_snap, i.quantity,
              i.status_code, i.remake_of_item_id, i.version,
              to_char(o.lab_expected_on, 'YYYY-MM-DD') AS lab_expected_on,
              org.name AS clinic_name, p.full_name, p.patient_number,
              l.patient_data_level AS data_level,
              s.id AS stage_id, s.name_snap AS stage_name, s.round_no AS stage_round,
              s.status_code AS stage_status, s.is_final AS stage_final,
              (SELECT count(DISTINCT x.seq)::int FROM order_item_stages x WHERE x.item_id = i.id) AS stage_count,
              a.lab_member_id AS assignee_member_id, u.name AS assignee_name
         ${from}
        ORDER BY o.lab_expected_on ASC NULLS LAST, o.order_no, i.line_no
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      params,
    );
    return {
      data: rows.map((r) => ({
        id: r.id,
        orderId: r.order_id,
        orderNo: r.order_no,
        priority: r.priority,
        lineNo: r.line_no,
        serviceName: r.service_name_snap,
        quantity: r.quantity,
        status: r.status_code,
        remakeOfItemId: r.remake_of_item_id,
        version: r.version,
        labExpectedOn: r.lab_expected_on,
        clinic: { name: r.clinic_name },
        patient: {
          ref:
            r.data_level === PatientDataLevel.CODE_ONLY
              ? r.patient_number
              : r.full_name,
        },
        activeStage: r.stage_id
          ? {
              id: r.stage_id,
              name: r.stage_name,
              roundNo: r.stage_round,
              status: r.stage_status,
              isFinal: r.stage_final,
            }
          : null,
        stageCount: r.stage_count,
        assignee: r.assignee_member_id
          ? { labMemberId: r.assignee_member_id, name: r.assignee_name }
          : null,
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  /** Stage rounds of one item (lab detail drawer). */
  async itemStages(itemId: string) {
    return (await this.stagesOf(`s.item_id = $1`, [itemId])).map(mapStage);
  }

  async shipments(
    scope: { organizationId?: string; labId?: string },
    q: ShipmentsQueryDto,
  ) {
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (scope.organizationId)
      add('s.organization_id = ?', scope.organizationId);
    if (scope.labId) add('s.lab_id = ?', scope.labId);
    if (q.direction) add('s.direction = ?', q.direction);
    if (q.status) add('s.status = ?', q.status);
    if (q.orderId) {
      add(
        's.id IN (SELECT shipment_id FROM shipment_items WHERE order_id = ?)',
        q.orderId,
      );
    }
    return this.shipmentsWhere(where.join(' AND ') || 'TRUE', params, {
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    }).then((r) => ({
      data: r.rows,
      total: r.total,
      page: q.page,
      limit: q.limit,
    }));
  }

  async shipment(id: string) {
    const r = await this.shipmentsWhere(`s.id = $1`, [id], {
      limit: 1,
      offset: 0,
    });
    return r.rows[0] ?? null;
  }

  async remakes(scope: { labId: string }, status?: string) {
    const params: unknown[] = [scope.labId];
    let where = `r.lab_id = $1`;
    if (status) {
      params.push(status);
      where += ` AND r.status::text = $2`;
    }
    return (await this.remakesWhere(where, params)).map((r) =>
      mapRemake(r, 'lab'),
    );
  }

  mapShipment(s: ShipmentRow, lines: LineRow[]) {
    return {
      id: s.id,
      shipmentNo: s.shipment_no,
      direction: s.direction,
      status: s.status,
      courierName: s.courier_name,
      trackingNo: s.tracking_no,
      notes: s.notes,
      dispatchedAt: s.dispatched_at,
      receivedAt: s.received_at,
      lostAt: s.lost_at,
      lostReason: s.lost_reason,
      qrToken: s.qr_token,
      qrValue: shipmentQrValue(s.qr_token),
      version: s.version,
      clinic: { name: s.clinic_name },
      lab: { id: s.lab_id, name: s.lab_name },
      lines: lines.filter((l) => l.shipment_id === s.id).map(mapLine),
    };
  }

  // ── queries ──────────────────────────────────────────────────────────

  private stagesOf(where: string, params: unknown[]): Promise<StageRow[]> {
    return sqlRows<StageRow>(
      this.dataSource,
      `SELECT s.id, s.item_id, s.seq, s.round_no, s.code_snap, s.name_snap, s.is_final,
              s.requires_patient_visit, s.status_code, s.is_active,
              to_char(s.lab_expected_on, 'YYYY-MM-DD') AS lab_expected_on,
              s.appointment_id, s.outcome, s.tryin_notes, s.correction_notes, s.decided_at,
              u.name AS decided_by_name, s.started_at, s.version
         FROM order_item_stages s
         LEFT JOIN users u ON u.uuid = s.decided_by
        WHERE ${where}
        ORDER BY s.seq, s.round_no`,
      params,
    );
  }

  private async shipmentsWhere(
    where: string,
    params: unknown[],
    page: { limit: number; offset: number },
  ) {
    const [{ total }] = await sqlRows<{ total: number }>(
      this.dataSource,
      `SELECT count(*)::int AS total FROM shipments s WHERE ${where}`,
      params,
    );
    const shipments = await sqlRows<ShipmentRow>(
      this.dataSource,
      `SELECT s.id, s.organization_id, s.lab_id, s.shipment_no, s.direction, s.status, s.courier_name,
              s.tracking_no, s.notes, s.dispatched_at, s.received_at, s.lost_at, s.lost_reason,
              s.qr_token, s.version, org.name AS clinic_name, l.name AS lab_name
         FROM shipments s
         JOIN organizations org ON org.id = s.organization_id
         JOIN labs l ON l.id = s.lab_id
        WHERE ${where}
        ORDER BY s.dispatched_at DESC, s.id DESC
        LIMIT ${page.limit} OFFSET ${page.offset}`,
      params,
    );
    const lines = shipments.length
      ? await sqlRows<LineRow>(
          this.dataSource,
          `SELECT sl.id, sl.shipment_id, sl.order_id, o.order_no, sl.order_item_id, i.line_no,
                  i.service_name_snap, i.status_code AS item_status, sl.item_stage_id,
                  st.name_snap AS stage_name, st.round_no AS stage_round, sl.contents,
                  sl.quantity, sl.received_qty, sl.condition, sl.qc_result, sl.qc_notes, sl.received_at
             FROM shipment_items sl
             JOIN lab_orders o ON o.id = sl.order_id
             JOIN lab_order_items i ON i.id = sl.order_item_id
             LEFT JOIN order_item_stages st ON st.id = sl.item_stage_id
            WHERE sl.shipment_id = ANY($1::uuid[])
            ORDER BY o.order_no, i.line_no`,
          [shipments.map((s) => s.id)],
        )
      : [];
    return { rows: shipments.map((s) => this.mapShipment(s, lines)), total };
  }

  private remakesWhere(where: string, params: unknown[]) {
    return sqlRows<RemakeRow>(
      this.dataSource,
      `SELECT r.id, r.order_id, o.order_no, r.original_item_id, oi.line_no AS original_line_no,
              oi.service_name_snap, r.new_item_id, ni.line_no AS new_line_no, r.reason_code, r.notes,
              r.responsible_party, r.is_warranty_claim, r.lab_charge_paisa, r.patient_charge_paisa,
              r.status, r.decided_at, r.decision_note, r.dispute_note, r.created_at, r.version,
              org.name AS clinic_name
         FROM remake_requests r
         JOIN lab_orders o ON o.id = r.order_id
         JOIN organizations org ON org.id = r.organization_id
         JOIN lab_order_items oi ON oi.id = r.original_item_id
         LEFT JOIN lab_order_items ni ON ni.id = r.new_item_id
        WHERE ${where}
        ORDER BY r.created_at DESC`,
      params,
    );
  }
}
