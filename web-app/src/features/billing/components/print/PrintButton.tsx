import { useState } from 'react'
import { ChevronDown, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastBillingError } from '../../lib/billing-errors'
import type { PrintDocumentType } from '../../services/billing-v2.api'
import type { PrintFormat } from '../../types/billing.types'
import { printDocument } from './print-document'

/**
 * Split button: Print (location default format) + A4 / Thermal choice for
 * invoices and receipts (plan §9.2). "Save as PDF" in the dialog downloads.
 */
export function PrintButton({
  documentType,
  id,
  label = 'Print',
  params,
  size = 'sm',
  variant = 'outline',
}: {
  documentType: PrintDocumentType
  id: string
  label?: string
  params?: Record<string, string | number | undefined>
  size?: 'sm' | 'default'
  variant?: 'outline' | 'default'
}) {
  const [busy, setBusy] = useState(false)
  const choosable = documentType === 'invoice' || documentType === 'receipt'

  const run = async (format?: PrintFormat) => {
    setBusy(true)
    try {
      await printDocument(documentType, id, { format, params })
    } catch (err) {
      toastBillingError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex">
      <Button
        size={size}
        variant={variant}
        onClick={() => run()}
        disabled={busy}
        className={choosable ? 'rounded-r-none' : ''}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Printer className="size-4" />
        )}
        {label}
      </Button>
      {choosable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size={size}
              variant={variant}
              className="rounded-l-none border-l-0 px-2"
              aria-label="Choose print format"
              disabled={busy}
            >
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => run('A4')}>A4</DropdownMenuItem>
            <DropdownMenuItem onClick={() => run('THERMAL_80')}>
              Thermal 80 mm
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
