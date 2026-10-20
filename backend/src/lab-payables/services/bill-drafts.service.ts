import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import {
  billTotals,
  DraftLineRef,
  ExpectedCost,
  planDraftLines,
} from '../common/payables-math';
import { VendorBill, VendorBillLine } from '../entities/vendor-bill.entity';
import {
  BillLineKind,
  PAYABLES_ENTITY,
  VendorBillStatus,
} from '../enums/payables.enums';

export const BILL_SEQUENCE = { key: 'vendor_bill', prefix: 'VB' };

/** Item state at which the lab has taken the work on (lab ERD §9a). */
export const ACCEPTED_STATE = 'accepted';

const CHARGE_KIND: Record<string, BillLineKind> = {
  rush: BillLineKind.RUSH,
  material: BillLineKind.MATERIAL,
  shipping: BillLineKind.SHIPPING,
  other: BillLineKind.OTHER,
};

const lineKey = (l: {
  order_item_id: string | null;
  charge_request_id: string | null;
}) =>
  l.charge_request_id
    ? `charge:${l.charge_request_id}`
    : `item:${l.order_item_id}`;

export interface SyncResult {
  billId: string | null;
  changed: boolean;
}

/**
 * The per-order draft bill (lab ERD §6c "Vendor bill draft", §10 "Lab
 * accept"): every item the lab accepted, at its frozen lab cost (approved
 * item charges are already in it), plus approved order-level charges. A
 * remake line carries its responsibility's cost — 0 for the lab's fault.
 * Idempotent: run on every accept, and again before approval.
 */
@Injectable()
export class BillDraftsService {
  constructor(
    private readonly sequences: NumberSequenceService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
  ) {}

  async sync(m: EntityManager, orderId: string): Promise<SyncResult> {
    const [order] = await sqlRows<{
      id: string;
      organization_id: string;
      location_id: string;
      lab_id: string;
      order_no: string | null;
    }>(
      m,
      `SELECT o.id, o.organization_id, o.location_id, o.lab_id, o.order_no
         FROM lab_orders o WHERE o.id = $1 FOR UPDATE`,
      [orderId],
    );
    if (!order?.order_no) return { billId: null, changed: false };

    const expected = await this.expectedCosts(m, orderId);
    const billedRows = await sqlRows<{
      order_item_id: string | null;
      charge_request_id: string | null;
      total: string;
    }>(
      m,
      `SELECT l.order_item_id, l.charge_request_id, SUM(l.line_total_paisa) AS total
         FROM vendor_bill_lines l JOIN vendor_bills b ON b.id = l.vendor_bill_id
        WHERE b.lab_order_id = $1 AND NOT l.is_manual
          AND b.status IN ('approved', 'partially_paid', 'paid')
        GROUP BY l.order_item_id, l.charge_request_id`,
      [orderId],
    );
    const billed = new Map(
      billedRows.map((r) => [lineKey(r), Number(r.total)]),
    );

    const repo = m.getRepository(VendorBill);
    let draft = await repo.findOne({
      where: { labOrderId: orderId, status: VendorBillStatus.DRAFT },
      lock: { mode: 'pessimistic_write' },
    });
    const draftLines: DraftLineRef[] = draft
      ? (
          await sqlRows<{
            id: string;
            order_item_id: string | null;
            charge_request_id: string | null;
            line_total_paisa: string;
          }>(
            m,
            `SELECT id, order_item_id, charge_request_id, line_total_paisa
               FROM vendor_bill_lines WHERE vendor_bill_id = $1 AND NOT is_manual`,
            [draft.id],
          )
        ).map((l) => ({
          id: l.id,
          key: lineKey(l),
          lineTotalPaisa: Number(l.line_total_paisa),
        }))
      : [];

    const plan = planDraftLines(expected, billed, draftLines, !!draft);
    if (!plan.inserts.length && !plan.updates.length) {
      return { billId: draft?.id ?? null, changed: false };
    }
    const created = !draft;
    if (!draft) {
      const tz = await this.clock.timezoneFor(order.location_id);
      draft = await repo.save(
        repo.create({
          organizationId: order.organization_id,
          locationId: order.location_id,
          labId: order.lab_id,
          labOrderId: order.id,
          billNo: await this.sequences.next(
            m,
            order.organization_id,
            BILL_SEQUENCE,
          ),
          status: VendorBillStatus.DRAFT,
          billDate: this.clock.today(tz),
          createdBy: null,
        }),
      );
    }
    const lineRepo = m.getRepository(VendorBillLine);
    if (plan.inserts.length) {
      await lineRepo.insert(
        plan.inserts.map((e) => ({
          organizationId: order.organization_id,
          vendorBillId: draft.id,
          lineKind: e.kind,
          labOrderId: order.id,
          orderItemId: e.orderItemId,
          chargeRequestId: e.chargeRequestId,
          remakeRequestId: e.remakeRequestId,
          description: e.description.slice(0, 300),
          quantity: e.quantity,
          unitCostPaisa: e.unitCostPaisa,
          lineTotalPaisa: e.linePaisa,
        })),
      );
    }
    for (const u of plan.updates) {
      await lineRepo.update(u.id, {
        lineTotalPaisa: u.linePaisa,
        quantity: u.quantity,
        unitCostPaisa: u.unitCostPaisa,
      });
    }
    await this.retotal(m, draft);
    if (created) {
      await this.audit.record(
        m,
        { userId: null, side: ActorSide.SYSTEM },
        {
          organizationId: draft.organizationId,
          entityType: PAYABLES_ENTITY.BILL,
          entityId: draft.id,
          action: AuditAction.CREATE,
          after: {
            billNo: draft.billNo,
            labOrderId: order.id,
            totalPaisa: draft.totalPaisa,
          },
        },
      );
    }
    return { billId: draft.id, changed: true };
  }

  /** Recompute a draft's totals from its lines (bumps its version). */
  async retotal(m: EntityManager, bill: VendorBill): Promise<VendorBill> {
    const lines = await m
      .getRepository(VendorBillLine)
      .findBy({ vendorBillId: bill.id });
    Object.assign(bill, billTotals(lines, bill.taxBp));
    bill.paidPaisa = 0;
    bill.balancePaisa = 0;
    return m.getRepository(VendorBill).save(bill);
  }

  private async expectedCosts(
    m: EntityManager,
    orderId: string,
  ): Promise<ExpectedCost[]> {
    const items = await sqlRows<{
      id: string;
      line_no: number;
      service_name_snap: string | null;
      quantity: number;
      lab_unit_cost_paisa: string;
      lab_line_cost_paisa: string;
      remake_of_item_id: string | null;
      remake_id: string | null;
    }>(
      m,
      `SELECT i.id, i.line_no, i.service_name_snap, i.quantity, i.lab_unit_cost_paisa,
              i.lab_line_cost_paisa, i.remake_of_item_id,
              (SELECT r.id FROM remake_requests r WHERE r.new_item_id = i.id LIMIT 1) AS remake_id
         FROM lab_order_items i
        WHERE i.order_id = $1
          AND EXISTS (SELECT 1 FROM status_history h
                       WHERE h.entity_type = 'item' AND h.entity_id = i.id AND h.to_state = $2)
        ORDER BY i.line_no`,
      [orderId, ACCEPTED_STATE],
    );
    const charges = await sqlRows<{
      id: string;
      kind: string;
      amount_paisa: string;
      reason: string;
    }>(
      m,
      `SELECT id, kind, amount_paisa, reason FROM order_charge_requests
        WHERE order_id = $1 AND item_id IS NULL AND status = 'approved'
        ORDER BY created_at`,
      [orderId],
    );
    return [
      ...items.map(
        (i): ExpectedCost => ({
          key: `item:${i.id}`,
          kind: i.remake_of_item_id
            ? BillLineKind.REMAKE
            : BillLineKind.SERVICE,
          orderItemId: i.id,
          chargeRequestId: null,
          remakeRequestId: i.remake_id,
          description: `${i.remake_of_item_id ? 'Remake: ' : ''}${i.service_name_snap ?? `Line ${i.line_no}`}`,
          quantity: i.quantity,
          unitCostPaisa: Number(i.lab_unit_cost_paisa),
          totalPaisa: Number(i.lab_line_cost_paisa),
        }),
      ),
      ...charges.map(
        (c): ExpectedCost => ({
          key: `charge:${c.id}`,
          kind: CHARGE_KIND[c.kind] ?? BillLineKind.OTHER,
          orderItemId: null,
          chargeRequestId: c.id,
          remakeRequestId: null,
          description: c.reason,
          quantity: 1,
          unitCostPaisa: Number(c.amount_paisa),
          totalPaisa: Number(c.amount_paisa),
        }),
      ),
    ];
  }
}
