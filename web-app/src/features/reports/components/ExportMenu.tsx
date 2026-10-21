import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useReportExport } from '../hooks/use-reports'
import type { ReportQuery } from '../types/reports.types'

/** "Download ▾" → Excel / PDF of one report with the current filters. */
export function ExportMenu({
  reportKey,
  query,
  label = 'Download',
  size = 'sm',
  variant = 'outline',
}: {
  reportKey: string
  query: ReportQuery
  label?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'default'
}) {
  const exporter = useReportExport()
  if (!exporter.enabled) return null
  const busy = exporter.isBusy(reportKey)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={busy}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {busy ? 'Preparing…' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={() => exporter.run(reportKey, query, 'xlsx')}
        >
          <FileSpreadsheet className="size-4 text-emerald" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exporter.run(reportKey, query, 'pdf')}>
          <FileText className="size-4 text-danger" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
