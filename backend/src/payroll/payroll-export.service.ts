import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PayrollRecord } from './entities/payroll-record.entity';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

function money(v: unknown): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  });
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
    row('Gross Salary', money(record.salaryAmount));
    row('Deductions', money(0));
    row('Net Pay', money(record.salaryAmount), true);
    y -= 10;
    row('Status', record.status);
    row('Payment Method', record.paymentMethod ?? '—');
    row(
      'Paid Date',
      record.paidAt ? new Date(record.paidAt).toDateString() : '—',
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

    const header = [
      'Employee Name',
      'Designation',
      'Gross Salary',
      'Deductions',
      'Net Pay',
      'Status',
      'Payment Method',
      'Paid Date',
    ];
    const lines = [header.map(csvCell).join(',')];

    for (const r of records) {
      const emp = r.employee as any;
      lines.push(
        [
          emp?.fullName ?? '',
          emp?.designation ?? emp?.jobTitle ?? '',
          money(r.salaryAmount),
          money(0),
          money(r.salaryAmount),
          r.status,
          r.paymentMethod ?? '',
          r.paidAt ? new Date(r.paidAt).toISOString().slice(0, 10) : '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
