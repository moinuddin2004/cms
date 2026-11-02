import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PayrollRecord } from './entities/payroll-record.entity';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { ClockService } from 'src/common/clock/clock.service';
import { localDate } from 'src/common/clock/tz.util';

function money(v: unknown): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  });
}

/** Integer minor units → "50,000.50" (no float math). */
function minorMoney(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
}

/** Breakdown of a record; rows from before the breakdown count as salary. */
function breakdown(r: PayrollRecord): {
  base: number;
  commission: number;
  total: number;
} {
  if (r.totalMinor) {
    return {
      base: r.baseSalaryMinor,
      commission: r.commissionMinor,
      total: r.totalMinor,
    };
  }
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(r.salaryAmount ?? '0'));
  const total = m
    ? (m[1] ? -1 : 1) *
      (Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0')))
    : 0;
  return { base: total, commission: 0, total };
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@Injectable()
export class PayrollExportService {
  constructor(
    @InjectRepository(PayrollRecord)
    private readonly payrollRepo: Repository<PayrollRecord>,
    private readonly clock: ClockService,
  ) {}

  async generatePayslipPdf(
    recordId: string,
    organizationId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const record = await this.payrollRepo.findOne({
      where: { id: recordId, organizationId },
      relations: ['employee'],
    });
    if (!record) throw new NotFoundException('Payroll record not found');

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let y = 790;
    const draw = (
      text: string,
      opts: { size?: number; bold?: boolean; x?: number } = {},
    ) => {
      page.drawText(text ?? '', {
        x: opts.x ?? 50,
        y,
        size: opts.size ?? 11,
        font: opts.bold ? bold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    draw('PAYSLIP', { size: 20, bold: true });
    y -= 30;
    draw(`Period: ${record.periodLabel}`, { bold: true });
    y -= 20;
    draw(`Employee: ${(record.employee as any)?.fullName ?? '—'}`);
    y -= 18;
    const designation =
      (record.employee as any)?.designation ??
      (record.employee as any)?.jobTitle ??
      '';
    if (designation) {
      draw(`Designation: ${designation}`);
      y -= 18;
    }
    y -= 10;
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 24;

    const row = (label: string, value: string, b = false) => {
      page.drawText(label, { x: 50, y, size: 11, font: b ? bold : font });
      const f = b ? bold : font;
      const w = f.widthOfTextAtSize(value, 11);
      page.drawText(value, { x: 545 - w, y, size: 11, font: f });
      y -= 20;
    };
    const pay = breakdown(record);
    row('Base Salary', minorMoney(pay.base));
    row('Commission', minorMoney(pay.commission));
    row('Gross Pay', minorMoney(pay.total));
    row('Deductions', money(0));
    row('Net Pay', minorMoney(pay.total), true);
    y -= 10;
    row('Status', record.status);
    row('Payment Method', record.paymentMethod ?? '—');
    // Paid date as the clinic (record's location) saw it, not the server.
    const tz = await this.clock.timezoneFor(record.locationId);
    row(
      'Paid Date',
      record.paidAt
        ? new Date(record.paidAt).toLocaleDateString('en-GB', {
            timeZone: tz,
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '—',
    );

    const bytes = await pdf.save();
    return {
      buffer: Buffer.from(bytes),
      fileName: `payslip-${record.periodLabel.replace(/\s+/g, '-')}.pdf`,
    };
  }

  async generatePayrollSummaryCsv(
    ctx: TenantContext,
    month: number,
    year: number,
  ): Promise<string> {
    const records = await this.payrollRepo.find({
      where: {
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        month,
        year,
      },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    const tz = await this.clock.timezoneFor(ctx.locationId);
    const header = [
      'Employee Name',
      'Designation',
      'Base Salary',
      'Commission',
      'Gross Pay',
      'Deductions',
      'Net Pay',
      'Status',
      'Payment Method',
      'Paid Date',
    ];
    const lines = [header.map(csvCell).join(',')];

    for (const r of records) {
      const emp = r.employee as any;
      const pay = breakdown(r);
      lines.push(
        [
          emp?.fullName ?? '',
          emp?.designation ?? emp?.jobTitle ?? '',
          minorMoney(pay.base),
          minorMoney(pay.commission),
          minorMoney(pay.total),
          money(0),
          minorMoney(pay.total),
          r.status,
          r.paymentMethod ?? '',
          r.paidAt ? localDate(tz, new Date(r.paidAt)) : '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
