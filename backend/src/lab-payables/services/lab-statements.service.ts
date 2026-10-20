import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import type { ClinicCall } from 'src/lab-orders/common/order-context';
import { payablesError } from '../common/payables-errors';
import { reconcile, SystemBill } from '../common/payables-math';
import { toStatement, toStatementLine } from '../common/payables-response';
import {
  CreateStatementDto,
  StatementsQueryDto,
  StatementStatusDto,
} from '../dto/payables.dto';
import {
  LabStatement,
  LabStatementLine,
} from '../entities/lab-statement.entity';
import { VendorBill } from '../entities/vendor-bill.entity';
import {
  PAYABLES_ENTITY,
  StatementMatch,
  StatementStatus,
} from '../enums/payables.enums';

/**
 * Monthly lab statements (lab ERD §6b, §6c "Statement matching"): the
 * clinic enters the lab's lines; they are matched to the period's bills
 * (drafts included — a statement often arrives before approval) by
 * reference and amount, and bills the lab left out are added as
 * `missing_in_statement` rows. Matched bills point at the statement.
 */
@Injectable()
export class LabStatementsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, q: StatementsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [rows, total] = await this.dataSource
      .getRepository(LabStatement)
      .findAndCount({
        where: {
          organizationId,
          ...(q.labId ? { labId: q.labId } : {}),
          ...(q.status ? { status: q.status } : {}),
        },
        relations: { lab: true },
        order: { periodStart: 'DESC', createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    const counts = await this.counts(
      this.dataSource.manager,
      rows.map((r) => r.id),
    );
    return PaginatedResponseDto.create(
      rows.map((s) =>
        toStatement(
          s,
          { labName: s.lab?.name, counts: counts.get(s.id) },
          'clinic',
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async detail(organizationId: string, id: string) {
    const m = this.dataSource.manager;
    const s = await m
      .getRepository(LabStatement)
      .findOne({ where: { id, organizationId }, relations: { lab: true } });
    if (!s)
      throw payablesError(
        'PAYABLES_STATEMENT_NOT_FOUND',
        'Statement not found',
      );
    return this.view(m, s, 'clinic');
  }

  async view(m: EntityManager, s: LabStatement, audience: 'clinic' | 'lab') {
    const lines = await m.getRepository(LabStatementLine).find({
      where: { statementId: s.id },
      order: { createdAt: 'ASC' },
    });
    const billIds = [
      ...new Set(
        lines.map((l) => l.matchedBillId).filter((x): x is string => !!x),
      ),
    ];
    const bills = billIds.length
      ? await sqlRows<{
          id: string;
          bill_no: string;
          order_no: string | null;
          status: string;
        }>(
          m,
          `SELECT b.id, b.bill_no, o.order_no, b.status FROM vendor_bills b
             LEFT JOIN lab_orders o ON o.id = b.lab_order_id WHERE b.id = ANY($1::uuid[])`,
          [billIds],
        )
      : [];
    const byId = new Map(bills.map((b) => [b.id, b]));
    const counts = (await this.counts(m, [s.id])).get(s.id);
    return {
      ...toStatement(s, { labName: s.lab?.name, counts }, audience),
      lines: lines.map((l) => {
        const b = l.matchedBillId ? byId.get(l.matchedBillId) : undefined;
        return {
          ...toStatementLine(l),
          billNo: b?.bill_no ?? null,
          orderNo: b?.order_no ?? null,
          billStatus: b?.status ?? null,
        };
      }),
    };
  }

  async create(c: ClinicCall, dto: CreateStatementDto) {
    const org = c.tenant.organizationId;
    if (dto.periodEnd < dto.periodStart)
      throw payablesError(
        'PAYABLES_INVALID',
        'The period ends before it starts',
      );
    return this.dataSource.transaction(async (m) => {
      const [link] = await sqlRows<{ id: string }>(
        m,
        `SELECT id FROM lab_clinic_links WHERE organization_id = $1 AND lab_id = $2`,
        [org, dto.labId],
      );
      if (!link)
        throw payablesError(
          'PAYABLES_LAB_NOT_FOUND',
          'Lab not linked to this clinic',
        );
      const bills = await this.periodBills(
        m,
        org,
        dto.labId,
        dto.periodStart,
        dto.periodEnd,
      );
      const result = reconcile(
        dto.lines.map((l) => ({
          labReference: l.labReference ?? null,
          amountPaisa: l.amountPaisa,
        })),
        bills,
      );
      const clean =
        result.missingInStatement.length === 0 &&
        result.lines.every((l) => l.matchStatus === StatementMatch.MATCHED);

      const repo = m.getRepository(LabStatement);
      const statement = await repo.save(
        repo.create({
          organizationId: org,
          labId: dto.labId,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          statementRef: dto.statementRef?.trim() || null,
          totalPaisa:
            dto.totalPaisa ?? dto.lines.reduce((a, l) => a + l.amountPaisa, 0),
          notes: dto.notes?.trim() || null,
          status: clean
            ? StatementStatus.RECONCILED
            : StatementStatus.RECONCILING,
          createdBy: c.actor.userId,
        }),
      );
      const lineRepo = m.getRepository(LabStatementLine);
      await lineRepo.insert([
        ...dto.lines.map((l, i) => ({
          organizationId: org,
          statementId: statement.id,
          labReference: l.labReference?.trim() || null,
          lineDate: l.lineDate ?? null,
          description: l.description?.trim() || null,
          amountPaisa: l.amountPaisa,
          ...result.lines[i],
        })),
        ...result.missingInStatement.map((b) => ({
          organizationId: org,
          statementId: statement.id,
          labReference: null,
          description: `Not on the statement: ${b.billNo}${b.orderNo ? ` (${b.orderNo})` : ''}`,
          amountPaisa: 0,
          systemAmountPaisa: b.totalPaisa,
          matchedBillId: b.billId,
          matchedBillLineId: b.firstLineId,
          matchStatus: StatementMatch.MISSING_IN_STATEMENT,
        })),
      ]);
      if (result.matchedBillIds.length) {
        await m
          .getRepository(VendorBill)
          .update(
            { id: In(result.matchedBillIds) },
            { statementId: statement.id },
          );
      }
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: PAYABLES_ENTITY.STATEMENT,
        entityId: statement.id,
        action: AuditAction.CREATE,
        after: {
          labId: dto.labId,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          totalPaisa: statement.totalPaisa,
          status: statement.status,
        },
      });
      const full = await repo.findOneOrFail({
        where: { id: statement.id },
        relations: { lab: true },
      });
      return this.view(m, full, 'clinic');
    });
  }

  /** The accountant closes the review: reconciled, or disputed with the lab. */
  async setStatus(c: ClinicCall, id: string, dto: StatementStatusDto) {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(LabStatement);
      const s = await repo.findOne({
        where: { id, organizationId: c.tenant.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!s)
        throw payablesError(
          'PAYABLES_STATEMENT_NOT_FOUND',
          'Statement not found',
        );
      assertVersion(s.version, dto.version);
      const before = { status: s.status, notes: s.notes };
      s.status = dto.status;
      if (dto.note?.trim())
        s.notes = [s.notes, dto.note.trim()].filter(Boolean).join('\n');
      await repo.save(s);
      await this.audit.record(m, c.ref, {
        organizationId: s.organizationId,
        entityType: PAYABLES_ENTITY.STATEMENT,
        entityId: s.id,
        action: AuditAction.UPDATE,
        before,
        after: { status: s.status, notes: s.notes },
      });
      const full = await repo.findOneOrFail({
        where: { id },
        relations: { lab: true },
      });
      return this.view(m, full, 'clinic');
    });
  }

  private async periodBills(
    m: EntityManager,
    organizationId: string,
    labId: string,
    from: string,
    to: string,
  ): Promise<SystemBill[]> {
    const rows = await sqlRows<{
      id: string;
      bill_no: string;
      vendor_invoice_no: string | null;
      order_no: string | null;
      total_paisa: string;
      first_line_id: string | null;
    }>(
      m,
      `SELECT b.id, b.bill_no, b.vendor_invoice_no, o.order_no, b.total_paisa,
              (SELECT l.id FROM vendor_bill_lines l WHERE l.vendor_bill_id = b.id
                ORDER BY l.created_at, l.id LIMIT 1) AS first_line_id
         FROM vendor_bills b LEFT JOIN lab_orders o ON o.id = b.lab_order_id
        WHERE b.organization_id = $1 AND b.lab_id = $2 AND b.status <> 'void'
          AND b.bill_date BETWEEN $3 AND $4 AND b.total_paisa > 0
        ORDER BY b.bill_date, b.bill_no`,
      [organizationId, labId, from, to],
    );
    return rows.map((r) => ({
      billId: r.id,
      billNo: r.bill_no,
      vendorInvoiceNo: r.vendor_invoice_no,
      orderNo: r.order_no,
      totalPaisa: Number(r.total_paisa),
      firstLineId: r.first_line_id,
    }));
  }

  private async counts(m: EntityManager, ids: string[]) {
    const out = new Map<string, Record<string, number>>();
    if (!ids.length) return out;
    const rows = await sqlRows<{
      statement_id: string;
      match_status: string;
      n: number;
    }>(
      m,
      `SELECT statement_id, match_status, count(*)::int AS n FROM lab_statement_lines
        WHERE statement_id = ANY($1::uuid[]) GROUP BY statement_id, match_status`,
      [ids],
    );
    for (const r of rows) {
      const c = out.get(r.statement_id) ?? {};
      c[r.match_status] = r.n;
      out.set(r.statement_id, c);
    }
    return out;
  }
}
