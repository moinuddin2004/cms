import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { ChargeStatus } from 'src/lab-orders/enums/order.enums';
import { notFound } from '../common/lab-billing-errors';
import {
  ListInvoicesQueryDto,
  ListPaymentsQueryDto,
} from '../dto/lab-billing.dto';
import { LAB_BILLING_ENTITY } from '../enums/lab-billing.enums';
import { LabInvoicesService } from './lab-invoices.service';

const INVOICE_COLUMNS = `
  i.id, i.invoice_no, i.status, i.order_id, o.order_no, i.issued_on::text AS issued_on,
  i.due_on::text AS due_on, i.subtotal_paisa, i.discount_paisa, i.tax_paisa, i.total_paisa,
  i.credited_paisa, i.paid_paisa, i.balance_paisa, i.created_at, i.version,
  p.id AS patient_id, p.full_name AS patient_name, p.patient_number`;

interface InvoiceSqlRow {
  id: string;
  invoice_no: string | null;
  status: string;
  order_id: string | null;
  order_no: string | null;
  issued_on: string | null;
  due_on: string | null;
  subtotal_paisa: string;
  discount_paisa: string;
  tax_paisa: string;
  total_paisa: string;
  credited_paisa: string;
  paid_paisa: string;
  balance_paisa: string;
  created_at: Date;
  version: number;
  patient_id: string;
  patient_name: string;
  patient_number: string;
}

const PAYMENT_COLUMNS = `
  pm.id, pm.receipt_no, pm.amount_paisa, pm.method, pm.reference, pm.notes, pm.received_at,
  pm.received_on::text AS received_on, pm.status, pm.reversal_of_id, pm.reason,
  pm.allocated_paisa, pm.refunded_paisa, pm.created_at,
  p.id AS patient_id, p.full_name AS patient_name, p.patient_number,
  COALESCE(u.name, u.email) AS received_by_name,
  rv.id AS reversed_by_id, rv.receipt_no AS reversed_by_receipt, orig.receipt_no AS reversal_of_receipt`;

interface PaymentSqlRow {
  id: string;
  receipt_no: string;
  amount_paisa: string;
  method: string;
  reference: string | null;
  notes: string | null;
  received_at: Date;
  received_on: string;
  status: string;
  reversal_of_id: string | null;
  reason: string | null;
  allocated_paisa: string;
  refunded_paisa: string;
  created_at: Date;
  patient_id: string;
  patient_name: string;
  patient_number: string;
  received_by_name: string | null;
  reversed_by_id: string | null;
  reversed_by_receipt: string | null;
  reversal_of_receipt: string | null;
}

const n = (v: string | number | null | undefined): number => Number(v ?? 0);

/** Read models for lab billing screens. Every query is organization-scoped. */
@Injectable()
export class LabBillingQueries {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
    private readonly invoices: LabInvoicesService,
  ) {}

  private async today(c: ClinicCall): Promise<string> {
    return this.clock.today(await this.clock.timezoneFor(c.tenant.locationId));
  }

  private invoiceRow(r: InvoiceSqlRow, today: string) {
    const balancePaisa = n(r.balance_paisa);
    return {
      id: r.id,
      invoiceNo: r.invoice_no,
      status: r.status,
      overdue:
        (r.status === 'issued' || r.status === 'partially_paid') &&
        !!r.due_on &&
        r.due_on < today,
      patient: {
        id: r.patient_id,
        fullName: r.patient_name,
        patientNumber: r.patient_number,
      },
      order: r.order_id ? { id: r.order_id, orderNo: r.order_no } : null,
      issuedOn: r.issued_on,
      dueOn: r.due_on,
      subtotalPaisa: n(r.subtotal_paisa),
      discountPaisa: n(r.discount_paisa),
      taxPaisa: n(r.tax_paisa),
      totalPaisa: n(r.total_paisa),
      creditedPaisa: n(r.credited_paisa),
      paidPaisa: n(r.paid_paisa),
      balancePaisa,
      createdAt: r.created_at,
      version: r.version,
    };
  }

  async listInvoices(c: ClinicCall, q: ListInvoicesQueryDto) {
    const today = await this.today(c);
    const where = ['i.organization_id = $1'];
    const params: unknown[] = [c.tenant.organizationId];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (q.status === 'overdue') {
      add(`i.status IN ('issued','partially_paid') AND i.due_on < ?`, today);
    } else if (q.status) add('i.status = ?', q.status);
    if (q.patientId) add('i.patient_id = ?', q.patientId);
    if (q.orderId) add('i.order_id = ?', q.orderId);
    if (q.from) add('COALESCE(i.issued_on, i.created_at::date) >= ?', q.from);
    if (q.to) add('COALESCE(i.issued_on, i.created_at::date) <= ?', q.to);
    if (q.search?.trim())
      add(
        '(i.invoice_no ILIKE ? OR p.full_name ILIKE ? OR p.patient_number ILIKE ? OR o.order_no ILIKE ?)',
        `%${q.search.trim()}%`,
      );
    const from = `FROM lab_invoices i JOIN patients p ON p.id = i.patient_id
                  LEFT JOIN lab_orders o ON o.id = i.order_id WHERE ${where.join(' AND ')}`;
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [{ total }] = await sqlRows<{ total: string }>(
      this.dataSource,
      `SELECT count(*) AS total ${from}`,
      params,
    );
    const rows = await sqlRows<InvoiceSqlRow>(
      this.dataSource,
      `SELECT ${INVOICE_COLUMNS} ${from}
        ORDER BY COALESCE(i.issued_on, i.created_at::date) DESC, i.id DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    return {
      data: rows.map((r) => this.invoiceRow(r, today)),
      total: n(total),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(n(total) / limit)),
    };
  }

  async invoice(c: ClinicCall, id: string) {
    const org = c.tenant.organizationId;
    const today = await this.today(c);
    const [r] = await sqlRows<
      InvoiceSqlRow & {
        notes: string | null;
        void_reason: string | null;
        voided_at: Date | null;
        issued_at: Date | null;
        location_id: string;
      }
    >(
      this.dataSource,
      `SELECT ${INVOICE_COLUMNS}, i.notes, i.void_reason, i.voided_at, i.issued_at, i.location_id
         FROM lab_invoices i JOIN patients p ON p.id = i.patient_id
         LEFT JOIN lab_orders o ON o.id = i.order_id
        WHERE i.id = $1 AND i.organization_id = $2`,
      [id, org],
    );
    if (!r) throw notFound('Invoice');
    const [lines, allocations, creditNotes, refunds, summary, history] =
      await Promise.all([
        sqlRows<Record<string, string | number | null>>(
          this.dataSource,
          `SELECT l.id, l.line_no, l.line_kind, l.lab_order_item_id, l.order_charge_request_id,
                l.description, l.quantity, l.unit_price_paisa, l.discount_paisa, l.tax_rate_bp,
                l.tax_paisa, l.line_total_paisa, l.doctor_id, e.full_name AS doctor_name
           FROM lab_invoice_lines l LEFT JOIN employees e ON e.id = l.doctor_id
          WHERE l.invoice_id = $1 ORDER BY l.line_no`,
          [id],
        ),
        sqlRows<Record<string, string | Date | null>>(
          this.dataSource,
          `SELECT a.id, a.payment_id, pm.receipt_no, pm.method, pm.received_at, pm.status AS payment_status,
                a.amount_paisa, a.created_at, a.reversed_at, a.release_reason
           FROM lab_payment_allocations a JOIN lab_payments pm ON pm.id = a.payment_id
          WHERE a.invoice_id = $1 ORDER BY a.created_at, a.id`,
          [id],
        ),
        sqlRows<Record<string, string | Date>>(
          this.dataSource,
          `SELECT id, credit_note_no, amount_paisa, released_paisa, refunded_paisa, status, reason, created_at
           FROM lab_credit_notes WHERE invoice_id = $1 ORDER BY created_at`,
          [id],
        ),
        sqlRows<Record<string, string | Date | null>>(
          this.dataSource,
          `SELECT r.id, r.refund_no, r.amount_paisa, r.method, r.refunded_at, r.credit_note_id
           FROM lab_refunds r JOIN lab_credit_notes c ON c.id = r.credit_note_id
          WHERE c.invoice_id = $1 ORDER BY r.refunded_at`,
          [id],
        ),
        this.patientSummary(c, r.patient_id),
        this.audit.timeline(
          this.dataSource.manager,
          LAB_BILLING_ENTITY.INVOICE,
          id,
          org,
        ),
      ]);
    return {
      ...this.invoiceRow(r, today),
      notes: r.notes,
      voidReason: r.void_reason,
      voidedAt: r.voided_at,
      issuedAt: r.issued_at,
      lines: lines.map((l) => ({
        id: l.id,
        lineNo: l.line_no,
        kind: l.line_kind,
        labOrderItemId: l.lab_order_item_id,
        chargeRequestId: l.order_charge_request_id,
        description: l.description,
        quantity: l.quantity,
        unitPricePaisa: n(l.unit_price_paisa),
        discountPaisa: n(l.discount_paisa),
        taxRateBp: l.tax_rate_bp,
        taxPaisa: n(l.tax_paisa),
        lineTotalPaisa: n(l.line_total_paisa),
        doctor: l.doctor_id
          ? { id: l.doctor_id, fullName: l.doctor_name }
          : null,
      })),
      allocations: allocations.map((a) => ({
        id: a.id,
        paymentId: a.payment_id,
        receiptNo: a.receipt_no,
        method: a.method,
        receivedAt: a.received_at,
        paymentStatus: a.payment_status,
        amountPaisa: n(a.amount_paisa as string),
        createdAt: a.created_at,
        reversedAt: a.reversed_at,
        releaseReason: a.release_reason,
      })),
      creditNotes: creditNotes.map((x) => ({
        id: x.id,
        creditNoteNo: x.credit_note_no,
        amountPaisa: n(x.amount_paisa as string),
        releasedPaisa: n(x.released_paisa as string),
        refundedPaisa: n(x.refunded_paisa as string),
        status: x.status,
        reason: x.reason,
        createdAt: x.created_at,
      })),
      refunds: refunds.map((x) => ({
        id: x.id,
        refundNo: x.refund_no,
        amountPaisa: n(x.amount_paisa as string),
        method: x.method,
        refundedAt: x.refunded_at,
        creditNoteId: x.credit_note_id,
      })),
      patientSummary: summary,
      history,
    };
  }

  /** §15: invoiced, collected, credited, receivable and advance — always shown apart. */
  async patientSummary(c: ClinicCall, patientId: string) {
    const org = c.tenant.organizationId;
    const [inv] = await sqlRows<Record<string, string>>(
      this.dataSource,
      `SELECT COALESCE(SUM(total_paisa), 0) AS invoiced, COALESCE(SUM(credited_paisa), 0) AS credited,
              COALESCE(SUM(paid_paisa), 0) AS paid, COALESCE(SUM(balance_paisa), 0) AS balance
         FROM lab_invoices
        WHERE organization_id = $1 AND patient_id = $2 AND status NOT IN ('draft', 'void')`,
      [org, patientId],
    );
    const [pay] = await sqlRows<Record<string, string>>(
      this.dataSource,
      `SELECT COALESCE(SUM(amount_paisa) FILTER (WHERE status = 'posted' AND amount_paisa > 0), 0) AS collected,
              COALESCE(SUM(amount_paisa - allocated_paisa - refunded_paisa)
                       FILTER (WHERE status = 'posted' AND amount_paisa > 0), 0) AS advance,
              COALESCE(SUM(refunded_paisa), 0) AS refunded
         FROM lab_payments WHERE organization_id = $1 AND patient_id = $2`,
      [org, patientId],
    );
    return {
      patientId,
      invoicedPaisa: n(inv.invoiced),
      creditedPaisa: n(inv.credited),
      paidPaisa: n(inv.paid),
      receivablePaisa: n(inv.balance),
      collectedPaisa: n(pay.collected),
      refundedPaisa: n(pay.refunded),
      advancePaisa: n(pay.advance),
    };
  }

  /** The Billing panel of a lab order: its invoices + what is not billed yet. */
  async order(c: ClinicCall, orderId: string) {
    const org = c.tenant.organizationId;
    const [o] = await sqlRows<{
      id: string;
      patient_id: string;
      status_code: string;
    }>(
      this.dataSource,
      `SELECT id, patient_id, status_code FROM lab_orders WHERE id = $1 AND organization_id = $2`,
      [orderId, org],
    );
    if (!o) throw notFound('Lab order');
    const m = this.dataSource.manager;
    const [list, items, charges, summary] = await Promise.all([
      this.listInvoices(c, { orderId, page: 1, limit: 100 }),
      // Draft items have no status yet, so a draft order lists nothing.
      this.invoices.billableItems(m, orderId),
      this.invoices.billableCharges(m, orderId),
      this.patientSummary(c, o.patient_id),
    ]);
    const live = list.data.filter(
      (i) => i.status !== 'void' && i.status !== 'draft',
    );
    return {
      orderId,
      patientId: o.patient_id,
      invoices: list.data,
      unbilledItems: items
        .filter(
          (i) =>
            !i.billed && !['cancelled', 'rejected'].includes(i.status_code),
        )
        .map((i) => ({
          id: i.id,
          description:
            i.service_name_snap + (i.teeth ? ` — teeth ${i.teeth}` : ''),
          quantity: i.quantity,
          patientLinePricePaisa: n(i.patient_line_price_paisa),
          status: i.status_code,
        })),
      unbilledCharges: charges
        .filter((x) => !x.billed && x.status === ChargeStatus.APPROVED)
        .map((x) => ({
          id: x.id,
          kind: x.kind,
          reason: x.reason,
          amountPaisa: n(x.amount_paisa),
        })),
      totals: {
        billedPaisa: live.reduce((s, i) => s + i.totalPaisa, 0),
        creditedPaisa: live.reduce((s, i) => s + i.creditedPaisa, 0),
        paidPaisa: live.reduce((s, i) => s + i.paidPaisa, 0),
        balancePaisa: live.reduce((s, i) => s + i.balancePaisa, 0),
      },
      patientSummary: summary,
    };
  }

  private paymentRow(r: PaymentSqlRow) {
    const amount = n(r.amount_paisa);
    const allocated = n(r.allocated_paisa);
    const refunded = n(r.refunded_paisa);
    return {
      id: r.id,
      receiptNo: r.receipt_no,
      patient: {
        id: r.patient_id,
        fullName: r.patient_name,
        patientNumber: r.patient_number,
      },
      amountPaisa: amount,
      method: r.method,
      reference: r.reference,
      notes: r.notes,
      receivedAt: r.received_at,
      receivedOn: r.received_on,
      receivedBy: r.received_by_name,
      status: r.status,
      isReversal: !!r.reversal_of_id,
      reversalOf: r.reversal_of_id
        ? { id: r.reversal_of_id, receiptNo: r.reversal_of_receipt }
        : null,
      reversedBy: r.reversed_by_id
        ? { id: r.reversed_by_id, receiptNo: r.reversed_by_receipt }
        : null,
      reason: r.reason,
      allocatedPaisa: allocated,
      refundedPaisa: refunded,
      advancePaisa:
        r.status === 'posted' && amount > 0 ? amount - allocated - refunded : 0,
    };
  }

  private paymentFrom(where: string) {
    return `FROM lab_payments pm JOIN patients p ON p.id = pm.patient_id
            LEFT JOIN users u ON u.uuid = pm.received_by
            LEFT JOIN lab_payments rv ON rv.reversal_of_id = pm.id
            LEFT JOIN lab_payments orig ON orig.id = pm.reversal_of_id
            WHERE ${where}`;
  }

  async listPayments(c: ClinicCall, q: ListPaymentsQueryDto) {
    const where = ['pm.organization_id = $1'];
    const params: unknown[] = [c.tenant.organizationId];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (q.status) add('pm.status = ?', q.status);
    if (q.method) add('pm.method = ?', q.method);
    if (q.patientId) add('pm.patient_id = ?', q.patientId);
    if (q.from) add('pm.received_on >= ?', q.from);
    if (q.to) add('pm.received_on <= ?', q.to);
    if (q.search?.trim())
      add(
        '(pm.receipt_no ILIKE ? OR p.full_name ILIKE ? OR p.patient_number ILIKE ? OR pm.reference ILIKE ?)',
        `%${q.search.trim()}%`,
      );
    const from = this.paymentFrom(where.join(' AND '));
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [{ total }] = await sqlRows<{ total: string }>(
      this.dataSource,
      `SELECT count(*) AS total ${from}`,
      params,
    );
    const rows = await sqlRows<PaymentSqlRow>(
      this.dataSource,
      `SELECT ${PAYMENT_COLUMNS} ${from}
        ORDER BY pm.received_at DESC, pm.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    return {
      data: rows.map((r) => this.paymentRow(r)),
      total: n(total),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(n(total) / limit)),
    };
  }

  async payment(c: ClinicCall, id: string) {
    const [r] = await sqlRows<PaymentSqlRow>(
      this.dataSource,
      `SELECT ${PAYMENT_COLUMNS} ${this.paymentFrom('pm.id = $1 AND pm.organization_id = $2')}`,
      [id, c.tenant.organizationId],
    );
    if (!r) throw notFound('Payment');
    const [allocations, refunds] = await Promise.all([
      sqlRows<Record<string, string | Date | null>>(
        this.dataSource,
        `SELECT a.id, a.invoice_id, i.invoice_no, a.amount_paisa, a.created_at, a.reversed_at, a.release_reason
           FROM lab_payment_allocations a JOIN lab_invoices i ON i.id = a.invoice_id
          WHERE a.payment_id = $1 ORDER BY a.created_at, a.id`,
        [id],
      ),
      sqlRows<Record<string, string | Date>>(
        this.dataSource,
        `SELECT r.id, r.refund_no, s.amount_paisa, r.refunded_at
           FROM lab_refund_sources s JOIN lab_refunds r ON r.id = s.refund_id
          WHERE s.payment_id = $1 ORDER BY r.refunded_at`,
        [id],
      ),
    ]);
    return {
      ...this.paymentRow(r),
      allocations: allocations.map((a) => ({
        id: a.id,
        invoiceId: a.invoice_id,
        invoiceNo: a.invoice_no,
        amountPaisa: n(a.amount_paisa as string),
        createdAt: a.created_at,
        reversedAt: a.reversed_at,
        releaseReason: a.release_reason,
      })),
      refunds: refunds.map((x) => ({
        id: x.id,
        refundNo: x.refund_no,
        amountPaisa: n(x.amount_paisa as string),
        refundedAt: x.refunded_at,
      })),
    };
  }
}
