import { PDFDocument } from 'pdf-lib';
import { PdfTextWriter } from './pdf-text';

describe('PdfTextWriter', () => {
  let pdf: PDFDocument;
  let writer: PdfTextWriter;

  beforeAll(async () => {
    pdf = await PDFDocument.create();
    writer = await PdfTextWriter.create(pdf);
  });

  it('measures Latin-only text exactly like Helvetica', () => {
    const s = 'Panadol 500mg × 5 days (After meal)';
    expect(writer.widthOf(s, 10)).toBeCloseTo(
      writer.font.widthOfTextAtSize(s, 10),
      6,
    );
    expect(writer.widthOf(s, 11, true)).toBeCloseTo(
      writer.bold.widthOfTextAtSize(s, 11),
      6,
    );
  });

  it('shapes and draws Urdu, mixed and non-WinAnsi text without throwing', async () => {
    const page = pdf.addPage();
    const samples = [
      'کھانے کے بعد',
      'دن میں دو بار ایک گولی',
      'صبح ۱ گولی، رات ۱ گولی',
      'Panadol 500mg — دن میں تین بار',
      // Words that hit NULL mark anchors in Noto Nastaliq Urdu.
      'زیادہ روزانہ',
      // Characters Helvetica can't encode fall back to '?'.
      'Rx ℞ 漢字',
    ];
    for (const s of samples) {
      const width = writer.draw(page, s, { x: 20, y: 400, size: 10 });
      expect(width).toBeGreaterThan(0);
      expect(width).toBeCloseTo(writer.widthOf(s, 10), 6);
    }
    const bytes = await pdf.save();
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('wraps a long Urdu paragraph within the given width', () => {
    const page = pdf.addPage();
    const text =
      'زیادہ پانی پئیں اور تین دن آرام کریں۔ اگر بخار 3 دن سے زیادہ رہے تو فوراً ڈاکٹر سے رابطہ کریں۔';
    const lines = writer.wrap(text, 120, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      if (line.includes(' ')) {
        expect(writer.widthOf(line, 10)).toBeLessThanOrEqual(120);
      }
    }
    const end = writer.paragraph(page, text, {
      x: 20,
      y: 700,
      width: 120,
      size: 10,
      lineHeight: 12,
    });
    // Each Urdu line takes more than the 12pt Latin line height.
    expect(700 - end).toBeGreaterThan(lines.length * 12);
  });

  it('keeps Latin paragraph metrics unchanged', () => {
    const page = pdf.addPage();
    const end = writer.paragraph(page, 'one two three\nfour', {
      x: 20,
      y: 700,
      width: 500,
      size: 10,
      lineHeight: 12,
    });
    expect(end).toBe(700 - 2 * 12);
  });
});
