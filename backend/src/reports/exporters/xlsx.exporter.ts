import { Workbook } from 'exceljs';
import type { Worksheet } from 'exceljs';
import { periodLine } from '../core/report-format';
import type {
  ReportColumn,
  ReportColumnType,
  ReportView,
} from '../core/report.types';

const NUM_FMT: Partial<Record<ReportColumnType, string>> = {
  money: '#,##0.00;[Red]-#,##0.00',
  number: '#,##0',
  decimal: '#,##0.0',
  percent: '0.0%',
  date: 'dd-mmm-yyyy',
};

const HEADER_FILL = 'FFEFF3F8';
const TITLE_COLOR = 'FF0F172A';
const MUTED_COLOR = 'FF64748B';

/** Excel's sheet-name rules: ≤ 31 chars, none of : \ / ? * [ ]. */
function sheetName(title: string): string {
  return title.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Report';
}

/** Typed cell value: real numbers and dates so Excel can sum and sort them. */
function cellValue(
  value: string | number | null | undefined,
  type: ReportColumnType,
): string | number | Date | null {
  if (value == null || value === '') return null;
  switch (type) {
    case 'money':
    case 'number':
    case 'decimal':
      return Number(value);
    case 'percent':
      return Number(value) / 100;
    case 'date':
      return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
    default:
      return String(value);
  }
}

function columnWidth(c: ReportColumn, view: ReportView): number {
  if (c.type === 'date') return 13;
  if (c.type === 'money') return 16;
  if (c.type === 'number' || c.type === 'decimal' || c.type === 'percent')
    return Math.max(10, c.header.length + 2);
  const longest = view.rows
    .slice(0, 500)
    .reduce(
      (a, r) => Math.max(a, String(r[c.key] ?? '').length),
      c.header.length,
    );
  return Math.min(48, Math.max(12, longest + 2));
}

/**
 * One sheet: title + period block, optional summary, the table (frozen,
 * filterable header; real numbers with formats) and a totals row.
 */
export async function exportXlsx(view: ReportView): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = 'DentalFlow';
  wb.created = new Date(view.meta.generatedAt);
  const ws = wb.addWorksheet(sheetName(view.title), {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const cols = view.columns;
  ws.columns = cols.map((c) => ({ key: c.key, width: columnWidth(c, view) }));

  const title = ws.addRow([view.title]);
  title.font = { bold: true, size: 14, color: { argb: TITLE_COLOR } };
  ws.addRow([`${view.meta.organizationName} · ${view.meta.scopeLabel}`]).font =
    { color: { argb: MUTED_COLOR } };
  ws.addRow([periodLine(view)]).font = { color: { argb: MUTED_COLOR } };

  if (view.summary.length) {
    ws.addRow([]);
    for (const s of view.summary) {
      const row = ws.addRow([s.label, cellValue(s.value, s.type)]);
      row.getCell(1).font = { color: { argb: MUTED_COLOR } };
      row.getCell(2).font = { bold: true };
      const fmt = NUM_FMT[s.type];
      if (fmt) row.getCell(2).numFmt = fmt;
    }
  }
  ws.addRow([]);

  const header = ws.addRow(cols.map((c) => c.header));
  const headerRowNo = header.number;
  header.eachCell((cell, i) => {
    cell.font = { bold: true, color: { argb: TITLE_COLOR } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    cell.alignment = {
      horizontal: isNumeric(cols[i - 1].type) ? 'right' : 'left',
    };
  });

  for (const r of view.rows) {
    const row = ws.addRow(cols.map((c) => cellValue(r[c.key], c.type)));
    if (isEmphasized(r._kind)) row.font = { bold: true };
  }
  applyFormats(ws, cols, headerRowNo + 1, headerRowNo + view.rows.length);

  if (view.totals) {
    const totals = ws.addRow(
      cols.map((c, i) =>
        i === 0 && view.totals?.[c.key] == null
          ? 'Total'
          : cellValue(view.totals?.[c.key], c.type),
      ),
    );
    totals.font = { bold: true };
    totals.eachCell((cell) => {
      cell.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } };
    });
    applyFormats(ws, cols, totals.number, totals.number);
  }

  if (view.truncated) {
    ws.addRow([]);
    ws.addRow([
      `Only the first ${view.rows.length} rows are included. Narrow the date range for the rest.`,
    ]).font = { italic: true, color: { argb: 'FFB45309' } };
  }
  for (const note of view.notes) {
    ws.addRow([note]).font = { italic: true, color: { argb: MUTED_COLOR } };
  }

  ws.views = [{ state: 'frozen', ySplit: headerRowNo }];
  if (view.rows.length) {
    ws.autoFilter = {
      from: { row: headerRowNo, column: 1 },
      to: { row: headerRowNo + view.rows.length, column: cols.length },
    };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

/** Section / subtotal / total lines of a statement (the P&L) are bold. */
export function isEmphasized(kind: unknown): boolean {
  return kind === 'section' || kind === 'subtotal' || kind === 'total';
}

function isNumeric(type: ReportColumnType): boolean {
  return (
    type === 'money' ||
    type === 'number' ||
    type === 'decimal' ||
    type === 'percent'
  );
}

function applyFormats(
  ws: Worksheet,
  cols: ReportColumn[],
  from: number,
  to: number,
) {
  if (to < from) return;
  cols.forEach((c, i) => {
    const fmt = NUM_FMT[c.type];
    for (let r = from; r <= to; r++) {
      const cell = ws.getRow(r).getCell(i + 1);
      if (fmt) cell.numFmt = fmt;
      if (isNumeric(c.type)) cell.alignment = { horizontal: 'right' };
    }
  });
}
