import { Workbook } from 'exceljs';
import type { ReportView } from '../core/report.types';
import { exportPdf } from './pdf.exporter';
import { exportXlsx } from './xlsx.exporter';

const view: ReportView = {
  key: 'collections',
  title: 'Payments received',
  description: '',
  columns: [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'patient', header: 'Patient', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'money', total: true },
    { key: 'share', header: 'Share', type: 'percent' },
  ],
  rows: [
    { date: '2026-10-20', patient: 'Ayesha Khan', amount: 1500.5, share: 60 },
    { date: '2026-10-21', patient: 'Bilal Ahmed', amount: 1000, share: 40 },
  ],
  totals: { amount: 2500.5 },
  summary: [{ label: 'Received', value: 2500.5, type: 'money' }],
  notes: ['A note.'],
  truncated: false,
  totalRows: 2,
  meta: {
    organizationName: 'Smile Dental',
    scopeLabel: 'Main branch',
    from: '2026-10-01',
    to: '2026-10-21',
    asOf: false,
    basis: 'collected',
    generatedAt: '2026-10-21T09:00:00.000Z',
    generatedLabel: '21 Oct 2026, 14:00',
  },
};

describe('report exporters', () => {
  it('writes an Excel sheet with real numbers, formats and a totals row', async () => {
    const buffer = await exportXlsx(view);
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Payments received');
    expect(ws.getCell('A1').value).toBe('Payments received');

    // find the header row, then check the data under it
    let headerRow = 0;
    ws.eachRow((row, n) => {
      if (row.getCell(1).value === 'Date') headerRow = n;
    });
    expect(headerRow).toBeGreaterThan(0);
    const first = ws.getRow(headerRow + 1);
    expect(first.getCell(2).value).toBe('Ayesha Khan');
    expect(first.getCell(3).value).toBe(1500.5);
    expect(first.getCell(3).numFmt).toContain('#,##0.00');
    expect(first.getCell(4).value).toBeCloseTo(0.6);
    expect(first.getCell(1).value).toBeInstanceOf(Date);
    const totals = ws.getRow(headerRow + 3);
    expect(totals.getCell(1).value).toBe('Total');
    expect(totals.getCell(3).value).toBe(2500.5);
  });

  it('writes a PDF', async () => {
    const buffer = await exportPdf(view, true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
