import { CheckCircle2 } from 'lucide-react'
import type { CollectResult } from '../../types/billing.types'
import { PrintButton } from '../print/PrintButton'
import { Money } from '../shared/billing-badges'

/** After a successful payment: numbers + print buttons (plan §8.2.7). */
export function CollectSuccess({ result }: { result: CollectResult }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <CheckCircle2 className="size-12 text-emerald" />
      <div>
        <p className="text-lg font-semibold">
          {result.payment ? (
            <>
              Received <Money value={result.payment.amount} />
            </>
          ) : (
            'Advance applied'
          )}
        </p>
        {result.payment && (
          <p className="text-sm text-muted-foreground">
            Receipt {result.payment.receiptNumber}
          </p>
        )}
        {result.invoiceNumber && (
          <p className="text-sm text-muted-foreground">
            Invoice {result.invoiceNumber} issued
          </p>
        )}
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-3 rounded-lg border border-border p-3 text-sm">
        <span className="text-muted-foreground">Still outstanding</span>
        <Money
          value={
            result.summary.invoicedOutstanding + result.summary.unbilledTotal
          }
          className="text-right font-semibold"
        />
        <span className="text-muted-foreground">Advance held</span>
        <Money value={result.summary.advance} className="text-right" />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {result.payment && (
          <PrintButton
            documentType="receipt"
            id={result.payment.id}
            label="Print receipt"
            variant="default"
          />
        )}
        {result.invoiceId && (
          <PrintButton
            documentType="invoice"
            id={result.invoiceId}
            label="Print invoice"
          />
        )}
      </div>
    </div>
  )
}
