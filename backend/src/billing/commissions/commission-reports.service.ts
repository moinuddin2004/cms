import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccessResolver } from 'src/access/access.resolver';
import { noPermission } from 'src/access/decorators/access.decorators';
import { sqlRows } from 'src/common/database/sql';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingClock } from '../common/billing-clock.service';
import { notFound } from '../common/billing-errors';
import { CommissionSourceType, CompensationPlanType } from './commission.enums';
import { CommissionsQueryDto, EarningsQueryDto } from './dto/compensation.dto';

export interface CommissionEntryRow {
  id: string;
  createdAt: Date;
  assignmentId: string;
  doctorName: string;
  chargeId: string;
  chargeDescription: string;
  patientName: string;
  invoiceNumber: string | null;
  sourceType: CommissionSourceType;
  basePaisa: number;
  rateBps: number | null;
  amountPaisa: number;
  settled: boolean;
}

export interface DoctorEarningsRow {
  assignmentId: string;
  employeeId: string;
  doctorName: string;
  locationName: string;
  planType: CompensationPlanType | null;
  /** Patient money allocated (net of releases) to the doctor's charges. */
  collectedPaisa: number;
  /** Commission entries written in the range (signed). */
  earnedPaisa: number;
  /** …of which already in a settlement. */
  settledPaisa: number;
  /** …of which not settled yet. */
  pendingPaisa: number;
}

export interface DoctorEarningsReport {
  rows: DoctorEarningsRow[];
  totals: Pick<
    DoctorEarningsRow,
    'collectedPaisa' | 'earnedPaisa' | 'settledPaisa' | 'pendingPaisa'
  >;
}

const MAX_ENTRY_ROWS = 1000;

/** Commission ledger reads: entries, doctor earnings, a doctor's own earnings. */
@Injectable()
export class CommissionReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly access: AccessResolver,
  ) {}

  /** Ledger lines of one location (admin), newest first. */
  async entries(
    tenant: TenantContext,
    userId: string,
    q: CommissionsQueryDto,
  ): Promise<CommissionEntryRow[]> {
    const locationId = await this.adminLocation(tenant, userId, q.locationId);
    const { start, end } = await this.range(locationId, q.from, q.to);
    return this.entryRows(
      `ce.organization_id = $1 AND ce.location_id = $2
       AND ce.created_at >= $3 AND ce.created_at < $4
       AND ($5::uuid IS NULL OR ce.assignment_id = $5::uuid)`,
      [tenant.organizationId, locationId, start, end, q.assignmentId ?? null],
    );
  }

  /** Per doctor at one location: collected, earned, settled, pending (admin). */
  async doctorEarnings(
    tenant: TenantContext,
    userId: string,
    q: EarningsQueryDto,
  ): Promise<DoctorEarningsReport> {
    const locationId = await this.adminLocation(tenant, userId, q.locationId);
    const { start, end, today } = await this.range(locationId, q.from, q.to);
    return this.earnings(`a.organization_id = $1 AND a.location_id = $2`, [
      tenant.organizationId,
      locationId,
      start,
      end,
      today,
    ]);
  }

  /**
   * The signed-in doctor's own earnings across their assignments in this
   * organization — never anyone else's (filtered by user id server-side).
   */
  async myEarnings(
    tenant: TenantContext,
    userId: string,
    q: EarningsQueryDto,
  ): Promise<DoctorEarningsReport & { entries: CommissionEntryRow[] }> {
    const { start, end, today } = await this.range(
      tenant.locationId,
      q.from,
      q.to,
    );
    const report = await this.earnings(
      `a.organization_id = $1 AND a.user_id = $2
       AND ($6::uuid IS NULL OR a.location_id = $6::uuid)`,
      [tenant.organizationId, userId, start, end, today, q.locationId ?? null],
    );
    const entries = await this.entryRows(
      `ce.organization_id = $1 AND a.user_id = $2
       AND ce.created_at >= $3 AND ce.created_at < $4
       AND ($5::uuid IS NULL OR ce.location_id = $5::uuid)`,
      [tenant.organizationId, userId, start, end, q.locationId ?? null],
    );
    return { ...report, entries };
  }

  private async earnings(
    assignmentFilter: string,
    args: unknown[],
  ): Promise<DoctorEarningsReport> {
    // $3/$4 = UTC range, $5 = clinic today (current plan type).
    const rows = await sqlRows<{
      assignment_id: string;
      employee_id: string;
      doctor_name: string;
      location_name: string;
      plan_type: CompensationPlanType | null;
      collected: string;
      earned: string;
      settled: string;
    }>(
      this.dataSource,
      `SELECT a.id AS assignment_id, a.employee_id, e.full_name AS doctor_name,
              l.name AS location_name,
              (SELECT p.type FROM compensation_plans p
                WHERE p.assignment_id = a.id AND p.effective_from <= $5::date
                  AND (p.effective_to IS NULL OR p.effective_to >= $5::date)) AS plan_type,
              COALESCE((SELECT (SUM(pa.amount) * 100)::bigint
                          FROM payment_allocations pa
                          JOIN charges c ON c.id = pa.charge_id
                         WHERE c.performing_assignment_id = a.id
                           AND pa.created_at >= $3 AND pa.created_at < $4), 0) AS collected,
              COALESCE((SELECT SUM(ce.amount_paisa) FROM commission_entries ce
                         WHERE ce.assignment_id = a.id
                           AND ce.created_at >= $3 AND ce.created_at < $4), 0) AS earned,
              COALESCE((SELECT SUM(ce.amount_paisa) FROM commission_entries ce
                         WHERE ce.assignment_id = a.id AND ce.settlement_id IS NOT NULL
                           AND ce.created_at >= $3 AND ce.created_at < $4), 0) AS settled
         FROM employee_org_location_assignments a
         JOIN employees e ON e.id = a.employee_id
         JOIN locations l ON l.id = a.location_id
        WHERE ${assignmentFilter}
          AND (EXISTS (SELECT 1 FROM compensation_plans p
                        WHERE p.assignment_id = a.id AND p.type <> 'SALARY')
               OR EXISTS (SELECT 1 FROM commission_entries ce WHERE ce.assignment_id = a.id))
        ORDER BY e.full_name`,
      args,
    );
    const out = rows.map((r) => {
      const earned = Number(r.earned);
      const settled = Number(r.settled);
      return {
        assignmentId: r.assignment_id,
        employeeId: r.employee_id,
        doctorName: r.doctor_name,
        locationName: r.location_name,
        planType: r.plan_type,
        collectedPaisa: Number(r.collected),
        earnedPaisa: earned,
        settledPaisa: settled,
        pendingPaisa: earned - settled,
      };
    });
    const sum = (k: keyof DoctorEarningsReport['totals']) =>
      out.reduce((a, r) => a + r[k], 0);
    return {
      rows: out,
      totals: {
        collectedPaisa: sum('collectedPaisa'),
        earnedPaisa: sum('earnedPaisa'),
        settledPaisa: sum('settledPaisa'),
        pendingPaisa: sum('pendingPaisa'),
      },
    };
  }

  private async entryRows(
    where: string,
    args: unknown[],
  ): Promise<CommissionEntryRow[]> {
    const rows = await sqlRows<{
      id: string;
      created_at: Date;
      assignment_id: string;
      doctor_name: string;
      charge_id: string;
      description: string;
      patient_name: string;
      invoice_number: string | null;
      source_type: CommissionSourceType;
      base_paisa: string;
      rate_bps: number | null;
      amount_paisa: string;
      settlement_id: string | null;
    }>(
      this.dataSource,
      `SELECT ce.id, ce.created_at, ce.assignment_id, e.full_name AS doctor_name,
              COALESCE(ce.charge_id, ce.lab_invoice_line_id) AS charge_id,
              COALESCE(c.description, ll.description) AS description,
              pt.full_name AS patient_name,
              COALESCE(i.invoice_number, li.invoice_no) AS invoice_number,
              ce.source_type, ce.base_paisa, ce.rate_bps,
              ce.amount_paisa, ce.settlement_id
         FROM commission_entries ce
         JOIN employee_org_location_assignments a ON a.id = ce.assignment_id
         JOIN employees e ON e.id = a.employee_id
         LEFT JOIN charges c ON c.id = ce.charge_id
         LEFT JOIN invoices i ON i.id = c.invoice_id
         -- lab work earns on lab invoice lines (lab ERD §6c)
         LEFT JOIN lab_invoice_lines ll ON ll.id = ce.lab_invoice_line_id
         LEFT JOIN lab_invoices li ON li.id = ll.invoice_id
         JOIN patients pt ON pt.id = COALESCE(c.patient_id, li.patient_id)
        WHERE ${where}
        ORDER BY ce.created_at DESC, ce.id
        LIMIT ${MAX_ENTRY_ROWS}`,
      args,
    );
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      assignmentId: r.assignment_id,
      doctorName: r.doctor_name,
      chargeId: r.charge_id,
      chargeDescription: r.description,
      patientName: r.patient_name,
      invoiceNumber: r.invoice_number,
      sourceType: r.source_type,
      basePaisa: Number(r.base_paisa),
      rateBps: r.rate_bps,
      amountPaisa: Number(r.amount_paisa),
      settled: !!r.settlement_id,
    }));
  }

  /** Clinic-date range (default: this month so far) as UTC instants. */
  private async range(locationId: string, from?: string, to?: string) {
    const { tz, today } = await this.clock.read(locationId);
    const f = from ?? `${today.slice(0, 8)}01`;
    const t = to ?? today;
    return { ...this.clock.range(tz, f, t < f ? f : t), today };
  }

  /**
   * The active location, or another location of the organization where
   * the caller also holds `earnings.all.view` (resolved like any request
   * there: owner / super admin, or the role of their assignment).
   */
  private async adminLocation(
    tenant: TenantContext,
    userId: string,
    locationId?: string,
  ): Promise<string> {
    if (!locationId || locationId === tenant.locationId)
      return tenant.locationId;
    const [row] = await sqlRows<{ in_org: boolean }>(
      this.dataSource,
      `SELECT EXISTS (SELECT 1 FROM locations WHERE id = $2 AND organization_id = $1) AS in_org`,
      [tenant.organizationId, locationId],
    );
    if (!row?.in_org) throw notFound('Location');
    const there = await this.access.resolve(
      userId,
      tenant.organizationId,
      locationId,
    );
    if (!there.can('earnings.all.view')) {
      throw noPermission(
        ['earnings.all.view'],
        'You cannot see earnings at that location',
      );
    }
    return locationId;
  }
}
