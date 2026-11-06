import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument, PDFPage, radians, rgb } from 'pdf-lib';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionTemplate } from '../entities/prescription-template.entity';
import { PageSize } from '../enums/page-size.enum';
import { MealRelation } from '../enums/meal-relation.enum';
import { PrescriptionTemplateService } from './prescription-template.service';
import { PdfTextWriter } from '../pdf/pdf-text';
import { ClockService } from 'src/common/clock/clock.service';
import { StorageService } from 'src/common/storage/storage.service';

const MM_TO_PT = 2.83465;

/** Gap between a medicine's English column and its Urdu column (pt). */
const URDU_COLUMN_GAP = 8;

const PAGE_SIZES_PT: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  LETTER: [612, 792],
};

const MEAL_LABEL: Record<MealRelation, string> = {
  [MealRelation.BEFORE_MEAL]: 'Before meal',
  [MealRelation.AFTER_MEAL]: 'After meal',
  [MealRelation.WITH_MEAL]: 'With meal',
  [MealRelation.EMPTY_STOMACH]: 'Empty stomach',
  [MealRelation.NONE]: '',
};

/**
 * Renders a finalized prescription to PDF via pdf-lib.
 *
 * Latin text is set in the standard Helvetica fonts. Urdu (any Arabic-script
 * text — the Urdu medicine name / instructions columns, or Urdu typed into
 * any other field) goes through PdfTextWriter: shaped with fontkit in Noto
 * Nastaliq Urdu, laid out right-to-left with numbers and Latin words kept
 * left-to-right, and drawn as vector outlines (see ../pdf/pdf-text.ts).
 *
 * Generated PDFs are stored through StorageService (provider chosen in
 * common/storage/storage.config.ts). If storage isn't configured, `generatePdfBuffer` still returns
 * the bytes and the controller streams them inline.
 */
@Injectable()
export class PrescriptionPdfService {
  constructor(
    @InjectRepository(Prescription)
    private readonly repo: Repository<Prescription>,
    @Inject(forwardRef(() => PrescriptionTemplateService))
    private readonly templateService: PrescriptionTemplateService,
    private readonly storage: StorageService,
    private readonly clock: ClockService,
  ) {}

  async generatePdfBuffer(
    prescriptionId: string,
    organizationId: string,
  ): Promise<Buffer> {
    const p = await this.repo.findOne({
      where: { id: prescriptionId, organizationId },
      relations: ['patient', 'doctor', 'prescriptionTemplate'],
    });
    if (!p) throw new NotFoundException('Prescription not found');
    // Dates on the PDF are the clinic's (location) dates, not the server's.
    const tz = await this.clock.timezoneFor(p.locationId);

    let template = p.prescriptionTemplate ?? null;
    if (!template) {
      template = await this.templateService.getDefaultForLocation(
        p.organizationId,
        p.locationId,
      );
    }

    const pdf = await PDFDocument.create();
    // Latin text uses Helvetica as before; Urdu runs are shaped and drawn
    // in Noto Nastaliq Urdu by the writer.
    const text = await PdfTextWriter.create(pdf);

    const [pageW, pageH] = this.pageDimensions(template);
    const page = pdf.addPage([pageW, pageH]);

    const styling = (template?.styling ?? {}) as any;
    const header = (template?.header ?? {}) as any;
    const footer = (template?.footer ?? {}) as any;

    const marginLeft = (styling.marginLeftMm ?? 12) * MM_TO_PT;
    const marginRight = (styling.marginRightMm ?? 12) * MM_TO_PT;
    const marginTop = (styling.marginTopMm ?? 15) * MM_TO_PT;
    const marginBottom = (styling.marginBottomMm ?? 15) * MM_TO_PT;
    const contentLeft = marginLeft;
    const contentRight = pageW - marginRight;
    const contentWidth = contentRight - contentLeft;

    let cursorY = pageH - marginTop;

    // ── Header ─────────────────────────────────────────────────────
    const primary = parseHexColor(styling.primaryColor ?? '#0d9488');
    const primaryColor = rgb(primary.r, primary.g, primary.b);
    const clinicName =
      header.clinicName ?? p.location?.name ?? 'Clinic';
    const doctorLabel = p.doctor?.fullName
      ? `Dr. ${p.doctor.fullName}`
      : 'Doctor';
    const qualification = header.doctorQualification ?? '';

    text.draw(page, doctorLabel, {
      x: contentLeft,
      y: cursorY,
      size: 16,
      bold: true,
      color: primaryColor,
    });
    text.drawRight(page, clinicName, {
      right: contentRight,
      y: cursorY,
      size: 14,
      bold: true,
      color: primaryColor,
    });
    cursorY -= 18;
    if (header.clinicNameUrdu) {
      // Urdu clinic name under the English one, as in the web preview.
      cursorY -= 4;
      text.drawRight(page, header.clinicNameUrdu, {
        right: contentRight,
        y: cursorY,
        size: 11,
        color: primaryColor,
      });
      cursorY -= 18;
    }
    if (qualification) {
      text.draw(page, qualification, {
        x: contentLeft,
        y: cursorY,
        size: 10,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    if (header.doctorPhone) {
      text.drawRight(page, header.doctorPhone, {
        right: contentRight,
        y: cursorY,
        size: 10,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    cursorY -= 14;
    page.drawLine({
      start: { x: contentLeft, y: cursorY },
      end: { x: contentRight, y: cursorY },
      thickness: 1.2,
      color: primaryColor,
    });
    cursorY -= 14;

    // ── Patient bar ───────────────────────────────────────────────
    const patient = p.patient;
    const dobAge = patient?.dob
      ? `Age: ${ageFromDob(patient.dob, this.clock.today(tz))}`
      : '';
    const patientLine = [
      `Name: ${patient?.fullName ?? '—'}`,
      dobAge,
      styling.showPatientGender !== false && patient?.gender
        ? `Gender: ${patient.gender}`
        : '',
      `Reg#: ${patient?.patientNumber ?? '—'}`,
      styling.showDate !== false
        ? `Date: ${new Date(p.createdAt).toLocaleDateString('en-GB', { timeZone: tz })}`
        : '',
      `RX: ${p.prescriptionNumber}`,
    ]
      .filter(Boolean)
      .join('   ');
    page.drawRectangle({
      x: contentLeft,
      y: cursorY - 14,
      width: contentWidth,
      height: 16,
      color: rgb(0.96, 0.97, 0.98),
    });
    text.draw(page, patientLine, {
      x: contentLeft + 4,
      y: cursorY - 10,
      size: 9,
      color: rgb(0.15, 0.15, 0.15),
    });
    cursorY -= 24;

    // ── Vitals row ────────────────────────────────────────────────
    if (styling.showVitals !== false && p.vitals) {
      const v = p.vitals as Record<string, any>;
      const items = [
        v.bp && `BP: ${v.bp}`,
        v.pulse && `Pulse: ${v.pulse}`,
        v.temperature && `Temp: ${v.temperature}`,
        v.spo2 && `SpO2: ${v.spo2}`,
        v.weight && `Wt: ${v.weight}`,
        v.height && `Ht: ${v.height}`,
      ].filter(Boolean) as string[];
      if (items.length) {
        text.draw(page, items.join('   '), {
          x: contentLeft,
          y: cursorY,
          size: 9,
          color: rgb(0.3, 0.3, 0.3),
        });
        cursorY -= 14;
      }
    }

    // ── Diagnosis / complaint ─────────────────────────────────────
    if (p.chiefComplaint) {
      cursorY = drawLabeledBlock(
        page,
        text,
        'Chief Complaint',
        p.chiefComplaint,
        contentLeft,
        contentWidth,
        cursorY,
      );
    }
    if (p.diagnosis) {
      cursorY = drawLabeledBlock(
        page,
        text,
        'Diagnosis',
        p.diagnosis,
        contentLeft,
        contentWidth,
        cursorY,
      );
    }

    // ── Medicines (Rx symbol + numbered list) ─────────────────────
    cursorY -= 8;
    text.draw(page, 'Rx', {
      x: contentLeft,
      y: cursorY,
      size: 18,
      bold: true,
      color: primaryColor,
    });
    cursorY -= 14;
    const medicines = (p.medicines ?? []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    const showUrdu = styling.showMedicineUrdu !== false;
    medicines.forEach((m, idx) => {
      const dosageBits: string[] = [];
      if (m.dosage) dosageBits.push(m.dosage);
      if (m.frequency) dosageBits.push(m.frequency);
      if (m.duration) dosageBits.push(`× ${m.duration}`);
      const meal = m.mealRelation ? MEAL_LABEL[m.mealRelation] : '';
      if (meal) dosageBits.push(`(${meal})`);
      const second = dosageBits.join('  ');

      // Urdu name / instructions sit in a right-hand column (7:5 split,
      // like the web preview); without them the row is full width.
      const urduName = showUrdu ? m.medicineNameUrdu?.trim() : '';
      const urduNote = showUrdu ? m.specialInstructionsUrdu?.trim() : '';
      const urduColumn = !!(urduName || urduNote);
      const leftWidth = urduColumn
        ? (contentWidth * 7) / 12 - URDU_COLUMN_GAP
        : contentWidth;
      const rowTop = cursorY;

      let left = text.paragraph(page, `${idx + 1}. ${m.medicineName}`, {
        x: contentLeft,
        y: rowTop,
        width: leftWidth,
        size: 11,
        lineHeight: 13,
        bold: true,
        align: 'left',
      });
      left = second
        ? text.paragraph(page, second, {
            x: contentLeft + 14,
            y: left,
            width: leftWidth - 14,
            size: 10,
            lineHeight: 14,
            color: rgb(0.25, 0.25, 0.25),
            align: 'left',
          })
        : left - 14;
      if (m.specialInstructions) {
        left = text.paragraph(page, `• ${m.specialInstructions}`, {
          x: contentLeft + 14,
          y: left,
          width: leftWidth - 14,
          size: 9,
          lineHeight: 12,
          color: rgb(0.4, 0.4, 0.4),
          align: 'left',
        });
      }

      let right = rowTop;
      if (urduColumn) {
        const colX = contentLeft + (contentWidth * 7) / 12;
        const colWidth = contentRight - colX;
        if (urduName) {
          right = text.paragraph(page, urduName, {
            x: colX,
            y: right,
            width: colWidth,
            size: 11,
            lineHeight: 13,
            bold: true,
            align: 'right',
          });
        }
        if (urduNote) {
          right = text.paragraph(page, urduNote, {
            x: colX,
            y: right,
            width: colWidth,
            size: 10,
            lineHeight: 12,
            color: rgb(0.25, 0.25, 0.25),
            align: 'right',
          });
        }
      }
      cursorY = Math.min(left, right);
    });

    // ── Instructions / further plan ───────────────────────────────
    if (p.instructionsEnglish || p.instructionsUrdu) cursorY -= 6;
    if (p.instructionsEnglish) {
      cursorY = drawLabeledBlock(
        page,
        text,
        'Instructions',
        p.instructionsEnglish,
        contentLeft,
        contentWidth,
        cursorY,
      );
    }
    if (p.instructionsUrdu) {
      cursorY = drawLabeledBlock(
        page,
        text,
        'ہدایات',
        p.instructionsUrdu,
        contentLeft,
        contentWidth,
        cursorY,
        'right',
      );
    }
    if (p.furtherPlan) {
      cursorY = drawLabeledBlock(
        page,
        text,
        'Further Plan',
        p.furtherPlan,
        contentLeft,
        contentWidth,
        cursorY,
      );
    }

    // ── Signature (bottom right) ──────────────────────────────────
    const sigBottom = marginBottom + 50;
    if (p.signatureImageUrl) {
      try {
        const sigBytes = await fetchImageBytes(p.signatureImageUrl);
        if (sigBytes) {
          const ext = p.signatureImageUrl.toLowerCase();
          const img = ext.includes('jpeg') || ext.includes('jpg')
            ? await pdf.embedJpg(sigBytes)
            : await pdf.embedPng(sigBytes);
          const sigW = 100;
          const sigH = (img.height / img.width) * sigW;
          page.drawImage(img, {
            x: contentRight - sigW,
            y: sigBottom,
            width: sigW,
            height: sigH,
          });
        }
      } catch {
        // skip — render without image if embedding failed
      }
    }
    page.drawLine({
      start: { x: contentRight - 110, y: sigBottom - 4 },
      end: { x: contentRight, y: sigBottom - 4 },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
    text.draw(page, doctorLabel, {
      x: contentRight - 110,
      y: sigBottom - 16,
      size: 9,
    });

    // ── Footer ────────────────────────────────────────────────────
    const footerY = marginBottom;
    page.drawLine({
      start: { x: contentLeft, y: footerY + 18 },
      end: { x: contentRight, y: footerY + 18 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    const footerLine = [
      footer.address,
      footer.timings,
      footer.phone,
      footer.website,
    ]
      .filter(Boolean)
      .join('  ·  ');
    if (footerLine) {
      text.draw(page, footerLine, {
        x: contentLeft,
        y: footerY + 6,
        size: 8,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    let disclaimerWidth = 0;
    if (footer.disclaimerText) {
      disclaimerWidth = text.draw(page, footer.disclaimerText, {
        x: contentLeft,
        y: footerY - 6,
        size: 7,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    if (footer.disclaimerTextUrdu) {
      // Right-aligned beside the English disclaimer, or below it if the two
      // don't fit on one line.
      const urduWidth = text.widthOf(footer.disclaimerTextUrdu, 8);
      const sameLine = disclaimerWidth + 16 + urduWidth <= contentWidth;
      text.drawRight(page, footer.disclaimerTextUrdu, {
        right: contentRight,
        y: sameLine ? footerY - 6 : footerY - 20,
        size: 8,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // ── Watermark (e.g. "COPY") ───────────────────────────────────
    if (styling.watermarkText) {
      text.draw(page, styling.watermarkText, {
        x: pageW / 2 - 60,
        y: pageH / 2,
        size: 60,
        bold: true,
        color: rgb(0.9, 0.9, 0.9),
        rotate: radians(-0.6),
        opacity: 0.4,
      });
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  /**
   * Upload the generated PDF and return a public URL. Returns null when the
   * storage provider can't be reached (so finalize() doesn't block).
   */
  async generatePdfUrl(
    prescriptionId: string,
    organizationId: string,
  ): Promise<string | null> {
    try {
      const buffer = await this.generatePdfBuffer(prescriptionId, organizationId);
      const stored = await this.storage.put(
        `org/${organizationId}/prescriptions/${prescriptionId}-${Date.now()}.pdf`,
        buffer,
        'application/pdf',
        'public',
      );
      return stored.url;
    } catch {
      return null;
    }
  }

  private pageDimensions(
    template: PrescriptionTemplate | null,
  ): [number, number] {
    if (
      template?.pageSize === PageSize.CUSTOM &&
      template.customWidthMm &&
      template.customHeightMm
    ) {
      return [
        Number(template.customWidthMm) * MM_TO_PT,
        Number(template.customHeightMm) * MM_TO_PT,
      ];
    }
    const size = template?.pageSize ?? PageSize.A4;
    return PAGE_SIZES_PT[size] ?? PAGE_SIZES_PT.A4;
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0.05, g: 0.58, b: 0.53 };
  const n = parseInt(m[1], 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/** Whole years from a calendar DOB to the clinic's `today` ('YYYY-MM-DD'). */
function ageFromDob(dob: Date | string, today: string): number {
  const born =
    dob instanceof Date ? dob.toISOString().slice(0, 10) : String(dob);
  const [by, bm, bd] = born.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let years = ty - by;
  if (tm < bm || (tm === bm && td < bd)) years--;
  return years;
}

/**
 * Small bold label, then the word-wrapped body. Latin text keeps the old
 * metrics (label, body lines every 12pt, 4pt after); Urdu lines get the extra
 * room Nastaliq needs. 'auto' right-aligns a body that starts in Urdu.
 */
function drawLabeledBlock(
  page: PDFPage,
  text: PdfTextWriter,
  label: string,
  body: string,
  x: number,
  width: number,
  y: number,
  align: 'left' | 'right' | 'auto' = 'auto',
): number {
  const labelAlign = align === 'right' ? 'right' : 'left';
  let cursor = text.paragraph(page, label, {
    x,
    y,
    width,
    size: 9,
    lineHeight: 12,
    bold: true,
    align: labelAlign,
  });
  cursor = text.paragraph(page, body, {
    x,
    y: cursor,
    width,
    size: 10,
    lineHeight: 12,
    align,
  });
  return cursor - 4;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith('data:')) {
    const idx = url.indexOf(',');
    if (idx < 0) return null;
    const base64 = url.slice(idx + 1);
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
  // The URL comes from user input: never let the server fetch internal
  // addresses (SSRF). Only public https hosts, small images, short timeout.
  if (!(await isPublicHttpsUrl(url))) return null;
  try {
    const res = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_REMOTE_IMAGE_BYTES) return null;
    const arr = await res.arrayBuffer();
    if (arr.byteLength > MAX_REMOTE_IMAGE_BYTES) return null;
    return new Uint8Array(arr);
  } catch {
    return null;
  }
}

const MAX_REMOTE_IMAGE_BYTES = 2 * 1024 * 1024;

/** https only, and the host must not resolve to a private/loopback/link-local address. */
async function isPublicHttpsUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  try {
    const addrs = await lookup(url.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
    return (
      v === '::1' ||
      v === '::' ||
      v.startsWith('fc') ||
      v.startsWith('fd') ||
      v.startsWith('fe8') ||
      v.startsWith('fe9') ||
      v.startsWith('fea') ||
      v.startsWith('feb')
    );
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}
