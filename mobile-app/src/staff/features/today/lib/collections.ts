import type { DailyFinancialSummary, InvoiceStats, TodayCollections } from '../types/today.types';

export const fromDailySummary = (d: DailyFinancialSummary): TodayCollections => ({
  source: 'daily',
  collected: d.totalCollections,
  outstanding: d.outstandingAmount,
  overdueCount: d.overdueCount,
  invoicesGenerated: d.invoicesGenerated,
  unpaidCount: null,
});

export const fromInvoiceStats = (s: InvoiceStats): TodayCollections => ({
  source: 'invoices',
  collected: s.totals.collected,
  outstanding: s.totals.outstanding,
  overdueCount: s.counts.OVERDUE,
  invoicesGenerated: null,
  unpaidCount: s.counts.UNPAID + s.counts.PARTIALLY_PAID + s.counts.OVERDUE,
});
