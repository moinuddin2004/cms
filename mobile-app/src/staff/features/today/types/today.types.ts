import type { EntryStatus, SessionStatus } from '@/staff/features/queue';

/**
 * `GET /financial-summary/daily` — mirrors `FinancialSummaryService.getDailySummary`.
 * Money is a DECIMAL amount (rupees), NOT minor units.
 */
export interface DailyFinancialSummary {
  totalCollections: number;
  invoicesGenerated: number;
  /** Payment account name → amount collected today. */
  paymentMethodBreakdown: Record<string, number>;
  outstandingAmount: number;
  overdueCount: number;
}

/** `GET /invoices/stats` — mirrors `InvoiceStats` (decimal amounts). */
export interface InvoiceStats {
  counts: {
    UNPAID: number;
    PARTIALLY_PAID: number;
    OVERDUE: number;
    PAID: number;
    REFUNDED: number;
    CANCELLED: number;
  };
  totals: {
    invoiced: number;
    collected: number;
    outstanding: number;
    overdue: number;
    refunded: number;
  };
}

/** Which backend answer the collections tile was built from. */
export type CollectionsSource = 'daily' | 'invoices';

/** What the Today screen shows for money. Decimal amounts; format with `formatMoney`. */
export interface TodayCollections {
  source: CollectionsSource;
  collected: number;
  outstanding: number;
  /** Daily summary: overdue invoices. Invoice stats: `counts.OVERDUE`. */
  overdueCount: number;
  /** Only the daily summary knows it (invoices issued today). */
  invoicesGenerated: number | null;
  /** Only invoice stats know it (UNPAID + PARTIALLY_PAID + OVERDUE). */
  unpaidCount: number | null;
}

/** One "Doctors now" row. `status: 'no_session'` = no session for the day yet. */
export interface DoctorNow {
  doctorId: string;
  doctorName: string;
  status: SessionStatus | 'no_session';
  /** Token of the entry being called / seen; null when nobody is. */
  nowServing: string | null;
  nowServingStatus: Extract<EntryStatus, 'called' | 'in_consultation'> | null;
  waitingCount: number;
}
