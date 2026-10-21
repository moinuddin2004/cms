import { isAxiosError } from 'axios'
import api from '@/lib/api'
import type {
  ClinicOverview,
  ExportFormat,
  FinanceOverview,
  ReportCatalogItem,
  ReportQuery,
  ReportView,
} from '../types/reports.types'

/** Drops empty filters so the URL only carries what is set. */
function params(q: ReportQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(q).filter(
      ([, v]) => v !== undefined && v !== '' && v !== 'all',
    ),
  ) as Record<string, string>
}

export async function fetchReportCatalog(): Promise<ReportCatalogItem[]> {
  const { data } = await api.get('/reports')
  return data.data
}

export async function fetchReport(
  key: string,
  q: ReportQuery,
): Promise<ReportView> {
  const { data } = await api.get(`/reports/${key}`, {
    params: params(q),
    timeout: 60_000,
  })
  return data.data
}

export async function fetchFinanceOverview(
  q: ReportQuery,
): Promise<FinanceOverview> {
  const { data } = await api.get('/reports/finance/overview', {
    params: params(q),
    timeout: 60_000,
  })
  return data.data
}

export async function fetchClinicOverview(
  q: ReportQuery,
): Promise<ClinicOverview> {
  const { data } = await api.get('/reports/clinic/overview', {
    params: params(q),
    timeout: 60_000,
  })
  return data.data
}

/** The file name from `Content-Disposition`, if the server sent one. */
function fileNameOf(disposition: string | undefined): string | null {
  const m = /filename="?([^";]+)"?/i.exec(disposition ?? '')
  return m ? m[1] : null
}

/**
 * Downloads a report as Excel / PDF and saves it. A failed export comes
 * back as a JSON blob — its message is re-thrown as a plain Error.
 */
export async function downloadReport(
  key: string,
  q: ReportQuery,
  format: ExportFormat,
): Promise<void> {
  try {
    const res = await api.get(`/reports/${key}/export`, {
      params: { ...params(q), format },
      responseType: 'blob',
      timeout: 120_000,
    })
    const name =
      fileNameOf(res.headers['content-disposition']) ??
      `${key}_${q.from ?? ''}_${q.to ?? ''}.${format}`
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (err) {
    if (isAxiosError(err) && err.response?.data instanceof Blob) {
      let message = 'Could not download the report.'
      try {
        const body = JSON.parse(await err.response.data.text())
        message = body?.message ?? message
      } catch {
        // not JSON — keep the generic message
      }
      throw new Error(Array.isArray(message) ? message.join(', ') : message)
    }
    throw err
  }
}
