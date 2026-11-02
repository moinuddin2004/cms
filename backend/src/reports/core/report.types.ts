/**
 * Report engine types. A report is a definition (columns + filters + one
 * `run`), so the same rows feed the on-screen table, the Excel file and the
 * PDF. Money crosses the API as rupees (2 decimals); `run` works in minor units
 * and the engine converts (billing v2 6.1).
 */

export type ReportCategory =
  | 'finance'
  | 'revenue'
  | 'expenses'
  | 'staff'
  | 'lab'
  | 'patients'
  | 'appointments'
  | 'operations'
  | 'clinical';

/** `decimal` = one decimal place (minutes, days). */
export type ReportColumnType =
  | 'text'
  | 'money'
  | 'number'
  | 'decimal'
  | 'date'
  | 'percent';

export interface ReportColumn {
  key: string;
  header: string;
  type: ReportColumnType;
  /** Summed into the totals row (money / number columns). */
  total?: boolean;
  /** Relative PDF width; text columns default to 2, the rest to 1. */
  weight?: number;
}

/** Which filter controls the screen shows for a report. */
export interface ReportFilterSpec {
  /** `range` = from/to; `asOf` = a single "as of today" snapshot (no dates). */
  dates: 'range' | 'asOf';
  doctor?: boolean;
  expenseCategory?: boolean;
  /** Revenue basis toggle (P&L). */
  basis?: boolean;
}

/** Money values in a row are integer minor units until the engine converts them. */
export type ReportRow = Record<string, string | number | null>;

export interface ReportSummaryItem {
  label: string;
  value: number;
  type: ReportColumnType;
}

export interface ReportRunResult {
  rows: ReportRow[];
  /** Overrides the computed totals row (e.g. P&L has no summable column). */
  totals?: ReportRow | null;
  summary?: ReportSummaryItem[];
  notes?: string[];
}

export type RevenueBasis = 'collected' | 'billed';

/** Who and where a report runs for, resolved once per request. */
export interface ReportScope {
  organizationId: string;
  organizationName: string;
  locationIds: string[];
  /** "Main branch" or "All locations (3)". */
  label: string;
  /** Every location of the organization (org-wide grant). */
  wholeOrg: boolean;
  /** Set for an `own`-scoped caller: every report runs for this doctor only. */
  doctorId?: string;
  /** Active location's timezone (timestamp columns → clinic days). */
  tz: string;
  /** Clinic-local today. */
  today: string;
}

export interface ReportParams {
  from: string;
  to: string;
  /** UTC instants of [from 00:00, to+1 00:00) in the clinic timezone. */
  start: Date;
  end: Date;
  doctorId?: string;
  category?: string;
  basis: RevenueBasis;
  /** Max rows to fetch (export cap + 1, to detect truncation). */
  limit: number;
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  category: ReportCategory;
  /** Feature flag the report needs; default `reports.financial`. */
  feature?: string;
  filters: ReportFilterSpec;
  columns: ReportColumn[];
  /** PDF page orientation; wide registers go landscape. */
  landscape?: boolean;
  run(scope: ReportScope, params: ReportParams): Promise<ReportRunResult>;
}

/** What the API returns for a report (money in rupees). */
export interface ReportView {
  key: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals: ReportRow | null;
  summary: ReportSummaryItem[];
  notes: string[];
  /** More rows exist than were returned. */
  truncated: boolean;
  totalRows: number;
  meta: {
    organizationName: string;
    scopeLabel: string;
    from: string;
    to: string;
    /** A snapshot "as of today" report (from = to = today). */
    asOf: boolean;
    basis: RevenueBasis;
    generatedAt: string;
    /** Clinic-local "21 Oct 2026, 14:05". */
    generatedLabel: string;
  };
}
