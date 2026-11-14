import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import type { DailyFinancialSummary, InvoiceStats } from '../types/today.types';

/** `GET /financial-summary/daily?date=YYYY-MM-DD` — needs `reports.financial.view` + feature `billing.financial_summary`. */
export async function fetchDailySummary(ymd: string): Promise<DailyFinancialSummary> {
  const res = await staffApi.get<ApiResponse<DailyFinancialSummary>>('/financial-summary/daily', {
    params: { date: ymd },
  });
  return res.data.data;
}

/**
 * `GET /invoices/stats?from&to` — `billing.invoice.view`. `from`/`to` are invoice
 * ISSUE dates (plain `YYYY-MM-DD`), so for one day pass the same value twice.
 */
export async function fetchInvoiceStats(from: string, to: string): Promise<InvoiceStats> {
  const res = await staffApi.get<ApiResponse<InvoiceStats>>('/invoices/stats', {
    params: { from, to },
  });
  return res.data.data;
}
