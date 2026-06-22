import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import { Invoice } from './entities/invoice.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(v: unknown): string {
  return num(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

@Injectable()
export class ReceiptPdfService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async generateReceiptPdf(
    invoiceId: string,
    ctx: TenantContext,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const invoice = await this.invoiceRepo.findOne({
      where: {
        id: invoiceId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
      relations: ['items', 'payments', 'patient'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const org = await this.orgRepo.findOne({
      where: { id: ctx.organizationId },
    });
    const orgName = (org as any)?.name ?? 'Clinic';

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let y = 800;
    const line = (
      text: string,
      opts: { size?: number; font?: PDFFont; x?: number; color?: any } = {},
    ) => {
      page.drawText(text ?? '', {
        x: opts.x ?? margin,
        y,
        size: opts.size ?? 10,
        font: opts.font ?? font,
        color: opts.color ?? rgb(0.1, 0.1, 0.1),
      });
    };
    const right = (
      text: string,
      xRight: number,
      opts: { size?: number; font?: PDFFont } = {},
    ) => {
      const f = opts.font ?? font;
      const size = opts.size ?? 10;
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: xRight - w, y, size, font: f });
    };

    // Header
    line(orgName, { size: 18, font: bold });
    y -= 18;
    if ((org as any)?.address) {
      line(String((org as any).address), { size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    }
    if ((org as any)?.phone) {
      line(`Phone: ${(org as any).phone}`, {
        size: 9,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 14;
    }

    y -= 10;
    line('PAYMENT RECEIPT', { size: 14, font: bold });
    y -= 22;

    const paymentIndex = invoice.payments?.length ?? 0;
    const lastPayment = (invoice.payments ?? []).sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    )[0];

    line(`Receipt #: REC-${invoice.invoiceNumber}-${paymentIndex}`);
    y -= 14;
    line(`Invoice #: ${invoice.invoiceNumber}`);
    y -= 14;
    line(
      `Date: ${(lastPayment?.paymentDate ?? new Date()).toString().slice(0, 15)}`,
    );
    y -= 14;
    const patientName = (invoice.patient as any)?.fullName ?? '—';
    const patientPhone = (invoice.patient as any)?.phone ?? '';
    line(`Patient: ${patientName}  ${patientPhone}`);
    y -= 24;

    // Items table header
    line('Description', { font: bold });
    right('Qty', 360, { font: bold });
    right('Unit', 450, { font: bold });
    right('Total', 545, { font: bold });
    y -= 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: 545, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;

    for (const it of invoice.items ?? []) {
      line(it.description.slice(0, 50));
      right(String(it.quantity), 360);
      right(money(it.unitPrice), 450);
      right(money(it.totalPrice), 545);
      y -= 14;
      if (y < 160) {
        y = 800;
        pdf.addPage([595, 842]);
      }
    }

    y -= 6;
    page.drawLine({
      start: { x: 330, y },
      end: { x: 545, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 16;

    const totalRow = (label: string, value: string, b = false) => {
      const f = b ? bold : font;
      page.drawText(label, { x: 360, y, size: 10, font: f });
      const w = f.widthOfTextAtSize(value, 10);
      page.drawText(value, { x: 545 - w, y, size: 10, font: f });
      y -= 15;
    };
    totalRow('Subtotal', money(invoice.subtotal));
    if (num(invoice.discountAmount) > 0)
      totalRow('Discount', `- ${money(invoice.discountAmount)}`);
    if (num(invoice.taxAmount) > 0) totalRow('Tax', money(invoice.taxAmount));
    totalRow('Total', money(invoice.totalAmount), true);
    totalRow('Paid', money(invoice.paidAmount));
    totalRow('Balance', money(invoice.balanceDue), true);

    y -= 14;
    if (lastPayment) {
      line('Payment Details', { font: bold });
      y -= 14;
      line(
        `Amount: ${money(lastPayment.amount)}   Method: ${lastPayment.paymentMethod}`,
      );
      y -= 14;
      if (lastPayment.referenceNumber) {
        line(`Reference: ${lastPayment.referenceNumber}`);
        y -= 14;
      }
    }

    y -= 20;
    line(`Thank you for choosing ${orgName}`, {
      size: 10,
      font: bold,
      color: rgb(0.3, 0.3, 0.3),
    });

    const bytes = await pdf.save();
    return {
      buffer: Buffer.from(bytes),
      fileName: `receipt-${invoice.invoiceNumber}.pdf`,
    };
  }
}
