import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionTemplate } from '../entities/prescription-template.entity';
import { PageSize } from '../enums/page-size.enum';
import { MealRelation } from '../enums/meal-relation.enum';
import { PrescriptionTemplateService } from './prescription-template.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from 'src/common/storage/storage-provider.interface';

const MM_TO_PT = 2.83465;

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
 * KNOWN LIMITATION: pdf-lib's standard fonts cover only WinAnsi — Urdu / Arabic
 * script doesn't shape correctly without an embedded Nastaliq font and a
 * shaping engine. The HTML live-preview in the frontend renders Urdu
 * correctly using the browser's font stack. For PDF print, Urdu strings are
 * emitted in a fallback font; they will render as boxed glyphs unless a
 * Nastaliq font file is embedded later (see TODO at the bottom of the file).
 *
 * The provider is wired through the existing StorageProvider (Cloudinary), so
 * generated PDFs upload via the same swappable abstraction the rest of the
 * app uses. If storage isn't configured, `generatePdfBuffer` still returns
 * the bytes and the controller streams them inline.
 */
@Injectable()
export class PrescriptionPdfService {
  constructor(
    @InjectRepository(Prescription)
    private readonly repo: Repository<Prescription>,
    @Inject(forwardRef(() => PrescriptionTemplateService))
    private readonly templateService: PrescriptionTemplateService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
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

    let template = p.prescriptionTemplate ?? null;
    if (!template) {
      template = await this.templateService.getDefaultForLocation(
        p.organizationId,
        p.locationId,
      );
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

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
    const clinicName =
      header.clinicName ?? p.location?.name ?? 'Clinic';
    const doctorLabel = p.doctor?.fullName
      ? `Dr. ${p.doctor.fullName}`
      : 'Doctor';
    const qualification = header.doctorQualification ?? '';

    page.drawText(doctorLabel, {
      x: contentLeft,
      y: cursorY,
      size: 16,
      font: bold,
      color: rgb(primary.r, primary.g, primary.b),
    });
    page.drawText(clinicName, {
      x: contentRight - widthOf(bold, clinicName, 14),
      y: cursorY,
      size: 14,
      font: bold,
      color: rgb(primary.r, primary.g, primary.b),
    });
    cursorY -= 18;
    if (qualification) {
      page.drawText(qualification, {
        x: contentLeft,
        y: cursorY,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    if (header.doctorPhone) {
      page.drawText(header.doctorPhone, {
        x: contentRight - widthOf(font, header.doctorPhone, 10),
        y: cursorY,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    cursorY -= 14;
    page.drawLine({
      start: { x: contentLeft, y: cursorY },
      end: { x: contentRight, y: cursorY },
      thickness: 1.2,
      color: rgb(primary.r, primary.g, primary.b),
    });
    cursorY -= 14;

    // ── Patient bar ───────────────────────────────────────────────
    const patient = p.patient;
    const dobAge = patient?.dob ? `Age: ${ageFromDob(patient.dob)}` : '';
    const patientLine = [
      `Name: ${patient?.fullName ?? '—'}`,
      dobAge,
      styling.showPatientGender !== false && patient?.gender
        ? `Gender: ${patient.gender}`
        : '',
      `Reg#: ${patient?.patientNumber ?? '—'}`,
      styling.showDate !== false
        ? `Date: ${new Date(p.createdAt).toLocaleDateString('en-GB')}`
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
    page.drawText(patientLine, {
      x: contentLeft + 4,
      y: cursorY - 10,
      size: 9,
      font,
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
        page.drawText(items.join('   '), {
          x: contentLeft,
          y: cursorY,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        cursorY -= 14;
      }
    }

    // ── Diagnosis / complaint ─────────────────────────────────────
    if (p.chiefComplaint) {
      cursorY = drawLabeledBlock(
        page,
        font,
        bold,
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
        font,
        bold,
        'Diagnosis',
        p.diagnosis,
        contentLeft,
        contentWidth,
        cursorY,
      );
    }

    // ── Medicines (Rx symbol + numbered list) ─────────────────────
    cursorY -= 8;
    page.drawText('Rx', {
      x: contentLeft,
      y: cursorY,
      size: 18,
      font: bold,
      color: rgb(primary.r, primary.g, primary.b),
    });
    cursorY -= 14;
    const medicines = (p.medicines ?? []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    medicines.forEach((m, idx) => {
      const lineParts: string[] = [];
      lineParts.push(`${idx + 1}. ${m.medicineName}`);
      const dosageBits: string[] = [];
      if (m.dosage) dosageBits.push(m.dosage);
      if (m.frequency) dosageBits.push(m.frequency);
      if (m.duration) dosageBits.push(`× ${m.duration}`);
      const meal = m.mealRelation ? MEAL_LABEL[m.mealRelation] : '';
      if (meal) dosageBits.push(`(${meal})`);
      const second = dosageBits.join('  ');

      page.drawText(lineParts.join(' '), {
        x: contentLeft,
        y: cursorY,
        size: 11,
        font: bold,
      });
      cursorY -= 13;
      page.drawText(second, {
        x: contentLeft + 14,
        y: cursorY,
        size: 10,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });
      cursorY -= 14;
      if (m.specialInstructions) {
        page.drawText(`• ${m.specialInstructions}`, {
          x: contentLeft + 14,
          y: cursorY,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        cursorY -= 12;
      }
    });

    // ── Instructions / further plan ───────────────────────────────
    if (p.instructionsEnglish) {
      cursorY -= 6;
      cursorY = drawLabeledBlock(
        page,
        font,
        bold,
        'Instructions',
        p.instructionsEnglish,
        contentLeft,
        contentWidth,
        cursorY,
      );
    }
    if (p.furtherPlan) {
      cursorY = drawLabeledBlock(
        page,
        font,
        bold,
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
    page.drawText(doctorLabel, {
      x: contentRight - 110,
      y: sigBottom - 16,
      size: 9,
      font,
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
      page.drawText(footerLine, {
        x: contentLeft,
        y: footerY + 6,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    if (footer.disclaimerText) {
      page.drawText(footer.disclaimerText, {
        x: contentLeft,
        y: footerY - 6,
        size: 7,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // ── Watermark (e.g. "COPY") ───────────────────────────────────
    if (styling.watermarkText) {
      page.drawText(styling.watermarkText, {
        x: pageW / 2 - 60,
        y: pageH / 2,
        size: 60,
        font: bold,
        color: rgb(0.9, 0.9, 0.9),
        rotate: { angle: -0.6, type: 'radians' } as any,
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
      const file = {
        buffer,
        originalname: `prescription-${prescriptionId}.pdf`,
        mimetype: 'application/pdf',
        size: buffer.length,
      } as Express.Multer.File;
      const result = await this.storage.upload(file, {
        folder: 'prescriptions',
      });
      return result.url;
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

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function ageFromDob(dob: Date | string): number {
  const d = dob instanceof Date ? dob : new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return years;
}

function drawLabeledBlock(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  label: string,
  body: string,
  x: number,
  width: number,
  y: number,
): number {
  page.drawText(label, { x, y, size: 9, font: bold });
  let cursor = y - 12;
  const lines = wrap(body, font, 10, width);
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size: 10, font });
    cursor -= 12;
  }
  return cursor - 4;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith('data:')) {
    const idx = url.indexOf(',');
    if (idx < 0) return null;
    const base64 = url.slice(idx + 1);
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return new Uint8Array(arr);
  } catch {
    return null;
  }
}
