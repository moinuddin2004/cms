import { AlertTriangle, Loader2 } from 'lucide-react'
import { Money } from '../shared/billing-badges'
import { formatMinor } from '../../lib/commission-math'
import { hasTax, taxLabel } from '../../lib/tax'
import { useCollect } from './collect-context'

/** Server-computed outcome of the payment (plan §8.2.6). */
export function CollectSummary() {
  const { preview, previewPending, previewError } = useCollect()

  if (previewError) {
    return (
      <div
        className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {previewError}
      </div>
    )
  }
  if (!preview) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Calculating…
      </div>
    )
  }

  const rows: Array<[string, number, string?]> = [
    ['Selected balance', preview.totalSelectedBalance],
    ['Advance used', preview.advanceUsed],
    ['Paying now', preview.payingNow, 'font-semibold'],
    ['Going to advance', preview.toAdvance, 'text-emerald'],
  ]
  return (
    <div
      className={`space-y-2 rounded-lg border border-border bg-panel p-3 text-sm ${previewPending ? 'opacity-60' : ''}`}
    >
      {rows.map(([label, value, cls]) => (
        <div key={label} className="flex justify-between">
          <span className="text-muted-foreground">{label}</span>
          <Money value={value} className={cls} />
        </div>
      ))}
      {preview.invoiceWillBeIssued && (
        <p className="border-t border-border-soft pt-2 text-xs text-muted-foreground">
          An invoice will be issued for {preview.willInvoice.length} charge
          {preview.willInvoice.length > 1 ? 's' : ''} (
          <Money value={preview.willInvoiceTotal} />
          {hasTax(preview.willInvoiceTaxRate) && (
            <>
              {' '}
              incl. {taxLabel(preview.willInvoiceTaxRate)}{' '}
              <Money value={preview.willInvoiceTax} />
            </>
          )}
          ).
        </p>
      )}
      {preview.doctorShare && preview.doctorShare.byDoctor.length > 0 && (
        <div className="space-y-1 border-t border-border-soft pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Doctor share{' '}
              <span className="text-[11px]">(internal, admin only)</span>
            </span>
            <span className="tabular-nums font-medium">
              {formatMinor(preview.doctorShare.totalMinor)}
            </span>
          </div>
          {preview.doctorShare.byDoctor.length > 1 &&
            preview.doctorShare.byDoctor.map((d) => (
              <div
                key={d.assignmentId}
                className="flex justify-between pl-3 text-muted-foreground"
              >
                <span>Dr. {d.doctorName}</span>
                <span className="tabular-nums">
                  {formatMinor(d.amountMinor)}
                </span>
              </div>
            ))}
        </div>
      )}
      {preview.blockers.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber">
          <AlertTriangle className="size-3.5" />
          Set a price for:{' '}
          {preview.blockers.map((b) => b.description).join(', ')}
        </p>
      )}
    </div>
  )
}
