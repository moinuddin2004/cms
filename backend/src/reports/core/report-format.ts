import { fromMinor } from 'src/billing/common/money';
import { displayDate } from './report-dates';
import type {
  ReportColumn,
  ReportColumnType,
  ReportRow,
  ReportSummaryItem,
  ReportView,
} from './report.types';

/** Minor → rupees for every money cell of a row (other cells untouched). */
export function rowToRupees(
  row: ReportRow,
  columns: ReportColumn[],
): ReportRow {
  const out: ReportRow = { ...row };
  for (const c of columns) {
    if (c.type === 'money' && out[c.key] != null) {
      out[c.key] = fromMinor(Number(out[c.key]));
    }
  }
  return out;
}

/**
 * Totals row: Σ of the `total` columns (money in minor units, so no float drift).
 * Null when no column is summable.
 */
export function totalsOf(
  rows: ReportRow[],
  columns: ReportColumn[],
): ReportRow | null {
  const summable = columns.filter((c) => c.total);
  if (!summable.length) return null;
  const totals: ReportRow = {};
  for (const c of summable) {
    totals[c.key] = rows.reduce((a, r) => a + Number(r[c.key] ?? 0), 0);
  }
  return totals;
}

export function summaryToRupees(
  items: ReportSummaryItem[],
): ReportSummaryItem[] {
  return items.map((s) =>
    s.type === 'money' ? { ...s, value: fromMinor(s.value) } : s,
  );
}

const moneyFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Display text of a cell (PDF; money already in rupees). */
export function formatCell(
  value: string | number | null | undefined,
  type: ReportColumnType,
): string {
  if (value == null || value === '') return type === 'text' ? '' : '—';
  switch (type) {
    case 'money':
      return moneyFmt.format(Number(value));
    case 'number':
      return intFmt.format(Number(value));
    case 'decimal':
      return Number(value).toFixed(1);
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'date':
      return displayDate(String(value).slice(0, 10));
    default:
      return String(value);
  }
}

/** "Period: 01 Oct 2026 – 21 Oct 2026 · Generated 21 Oct 2026, 14:05". */
export function periodLine(view: ReportView): string {
  const { meta } = view;
  const period = meta.asOf
    ? `As of ${displayDate(meta.to)}`
    : meta.from === meta.to
      ? `Period: ${displayDate(meta.from)}`
      : `Period: ${displayDate(meta.from)} – ${displayDate(meta.to)}`;
  return `${period} · Generated ${meta.generatedLabel}`;
}

/** One decimal percent of a part (0 when the whole is 0). */
export function percentOfTotal(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
