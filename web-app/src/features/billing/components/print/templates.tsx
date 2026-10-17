import type { ReactNode } from 'react'
import { formatCurrency } from '@/lib/formatters'
import type {
  CashClose,
  Invoice,
  PaymentDetail,
  PatientRef,
  PrintFormat,
  Refund,
  Statement,
} from '../../types/billing.types'

/**
 * Pure print templates (plan §9.3): props in, markup out, no fetching — so
 * a server-side renderer can reuse them later. Print-only CSS lives here
 * (inline styles are allowed only in print templates, plan §13.3).
 */

interface Header {
  clinicName: string
  locationName: string
  address: string | null
  phone: string | null
  logoUrl: string | null
  footerNote: string | null
  format: PrintFormat
  generatedAt: string
}

export type PrintPayload = Header &
  (
    | {
        document: 'INVOICE'
        invoice: Invoice
        revisionShown: number
        totalInWords: string
        otherOutstanding: number | null
        historic: unknown
      }
    | {
        document: 'RECEIPT'
        payment: PaymentDetail
        accountLast4: string | null
        bankName: string | null
        amountInWords: string
        remainingOutstanding: number
        advanceHeld: number
      }
    | { document: 'REFUND'; refund: Refund; amountInWords: string }
    | { document: 'STATEMENT'; patient: PatientRef; statement: Statement }
    | { document: 'CASH_CLOSE'; close: CashClose }
  )

export const PRINT_CSS = `
#print-root { display: none; }
@media print {
  body > *:not(#print-root) { display: none !important; }
  #print-root { display: block; }
}
#print-root .doc { font-family: system-ui, "Segoe UI", Arial, "Noto Naskh Arabic", sans-serif; color: #000; font-size: 11pt; }
#print-root .doc.thermal { width: 72mm; padding: 0 4mm; font-size: 11px; }
#print-root .typed { unicode-bidi: plaintext; }
#print-root h1 { font-size: 16pt; margin: 0; }
#print-root .thermal h1 { font-size: 14px; text-align: center; }
#print-root .muted { color: #555; }
#print-root .row { display: flex; justify-content: space-between; gap: 8px; }
#print-root .money { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
#print-root table { width: 100%; border-collapse: collapse; margin-top: 8px; }
#print-root th, #print-root td { padding: 4px 6px; border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; }
#print-root tr { break-inside: avoid; }
#print-root thead { display: table-header-group; }
#print-root .totals { margin-left: auto; width: 45%; margin-top: 8px; }
#print-root .thermal .totals { width: 100%; }
#print-root .bold { font-weight: 700; }
#print-root .thermal .bold { font-size: 13px; }
#print-root .rule { border-top: 1px dashed #000; margin: 6px 0; }
#print-root .watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 64pt; opacity: 0.12; transform: rotate(-20deg); }
#print-root .logo { max-height: 18mm; }
#print-root .thermal .logo { filter: grayscale(1); display: block; margin: 0 auto; }
#print-root .sign { display: flex; justify-content: space-between; margin-top: 48px; }
#print-root .sign div { border-top: 1px solid #000; padding-top: 4px; width: 40%; text-align: center; }
`

const money = (n: number) => formatCurrency(n)
const Typed = ({ children }: { children: ReactNode }) => (
  <span dir="auto" className="typed">
    {children}
  </span>
)

function ClinicHeader({
  p,
  title,
  number,
  sub,
}: {
  p: Header
  title: string
  number: string
  sub?: string
}) {
  return (
    <div>
      {p.logoUrl && <img src={p.logoUrl} alt="" className="logo" />}
      <div className="row">
        <div>
          <h1>{p.clinicName}</h1>
          <div className="muted">{p.locationName}</div>
          {p.address && (
            <div className="muted">
              <Typed>{p.address}</Typed>
            </div>
          )}
          {p.phone && <div className="muted">{p.phone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="bold">{title}</div>
          <div>{number}</div>
          {sub && <div className="muted">{sub}</div>}
        </div>
      </div>
      <div className="rule" />
    </div>
  )
}

function PatientBlock({
  patient,
  extra,
}: {
  patient: PatientRef
  extra?: ReactNode
}) {
  return (
    <div className="row">
      <div>
        <div className="bold">
          <Typed>{patient.name}</Typed>
        </div>
        <div className="muted">
          {[patient.mrn, patient.phone].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>{extra}</div>
    </div>
  )
}

function MoneyRow({
  label,
  value,
  bold,
}: {
  label: string
  value: number
  bold?: boolean
}) {
  return (
    <div className={`row ${bold ? 'bold' : ''}`}>
      <span>{label}</span>
      <span className="money">{money(value)}</span>
    </div>
  )
}

function Footer({ p }: { p: Header }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="rule" />
      {p.footerNote && (
        <div>
          <Typed>{p.footerNote}</Typed>
        </div>
      )}
      <div className="muted">Computer-generated document · {p.generatedAt}</div>
    </div>
  )
}

interface PrintLine {
  id: string
  description: string
  doctorName: string | null
  quantity: number
  unitPrice: number
  netAmount: number
  discount: { name: string; amount: number } | null
}

interface HistoricSnapshot {
  invoice: Record<string, number | string>
  charges: Array<{
    id: string
    status: string
    description: string
    quantity: number
    unitPrice: number | string
    netAmount: number | string
    discountName: string | null
    discountAmount: number | string
  }>
}

const pickTotals = (h: Record<string, number | string>) => ({
  subtotal: Number(h.subtotal),
  discountTotal: Number(h.discountTotal),
  totalAmount: Number(h.totalAmount),
  paidAmount: Number(h.paidAmount),
  balanceDue: Number(h.balanceDue),
})

function InvoiceDoc({
  p,
  thermal,
}: {
  p: Extract<PrintPayload, { document: 'INVOICE' }>
  thermal: boolean
}) {
  const inv = p.invoice
  const snap = p.historic as HistoricSnapshot | null
  // A historic revision prints its own lines and totals from the audit snapshot.
  const totals = snap ? { ...inv, ...pickTotals(snap.invoice) } : inv
  const lines: PrintLine[] = snap
    ? snap.charges
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({
          id: c.id,
          description: c.description,
          doctorName: null,
          quantity: c.quantity,
          unitPrice: Number(c.unitPrice),
          netAmount: Number(c.netAmount),
          discount: c.discountName
            ? { name: c.discountName, amount: Number(c.discountAmount) }
            : null,
        }))
    : (inv.charges ?? []).filter((c) => c.status === 'ACTIVE')
  const refunded = inv.refundStatus === 'FULLY_REFUNDED'
  return (
    <>
      {(inv.status === 'CANCELLED' || refunded) && (
        <div className="watermark">
          {inv.status === 'CANCELLED' ? 'CANCELLED' : 'REFUNDED'}
        </div>
      )}
      <ClinicHeader
        p={p}
        title="INVOICE"
        number={inv.invoiceNumber}
        sub={p.revisionShown > 1 ? `Revision ${p.revisionShown}` : undefined}
      />
      <PatientBlock
        patient={inv.patient}
        extra={
          <>
            <div>Date {inv.issueDate}</div>
            <div>Due {inv.dueDate}</div>
          </>
        }
      />
      {thermal ? (
        <div style={{ marginTop: 8 }}>
          {lines.map((c) => (
            <div key={c.id} style={{ marginBottom: 4 }}>
              <div>
                <Typed>{c.description}</Typed>
              </div>
              <div className="row">
                <span>
                  {c.quantity} × {money(c.unitPrice)}
                  {c.discount ? ` − ${money(c.discount.amount)}` : ''}
                </span>
                <span className="money">{money(c.netAmount)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Doctor</th>
              <th>Qty</th>
              <th className="money">Price</th>
              <th className="money">Discount</th>
              <th className="money">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td>
                  <Typed>{c.description}</Typed>
                </td>
                <td>{c.doctorName ?? ''}</td>
                <td>{c.quantity}</td>
                <td className="money">{money(c.unitPrice)}</td>
                <td className="money">
                  {c.discount
                    ? `${c.discount.name} −${money(c.discount.amount)}`
                    : ''}
                </td>
                <td className="money">{money(c.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="totals">
        <MoneyRow label="Subtotal" value={totals.subtotal} />
        {totals.discountTotal > 0 && (
          <MoneyRow label="Discount" value={-totals.discountTotal} />
        )}
        <MoneyRow label="Total" value={totals.totalAmount} bold />
        {inv.status !== 'CANCELLED' && (
          <>
            <MoneyRow label="Paid" value={totals.paidAmount} />
            <MoneyRow label="Balance due" value={totals.balanceDue} bold />
          </>
        )}
        {inv.refundedAmount > 0 && (
          <MoneyRow label="Refunded" value={inv.refundedAmount} />
        )}
        {p.otherOutstanding ? (
          <MoneyRow label="Previous balance" value={p.otherOutstanding} />
        ) : null}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        {p.totalInWords}
      </div>
      {inv.refunds && inv.refunds.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="bold">Refunds</div>
          {inv.refunds.map((r) => (
            <div key={r.refundId} className="row">
              <span>
                {r.refundNumber} · {r.refundDate}
              </span>
              <span className="money">{money(r.amount)}</span>
            </div>
          ))}
          <MoneyRow
            label="Net paid after refunds"
            value={inv.paidAmount}
            bold
          />
        </div>
      )}
      <div className="muted" style={{ marginTop: 6 }}>
        Issued by {inv.issuedByName ?? '—'}
      </div>
      <Footer p={p} />
    </>
  )
}

function ReceiptDoc({
  p,
}: {
  p: Extract<PrintPayload, { document: 'RECEIPT' }>
}) {
  const pay = p.payment
  const applied = pay.allocations.filter((a) => a.reason === 'PAYMENT')
  return (
    <>
      <ClinicHeader
        p={p}
        title="PAYMENT RECEIPT"
        number={pay.receiptNumber}
        sub={pay.paymentDate}
      />
      <PatientBlock patient={pay.patient} />
      <div style={{ marginTop: 8 }}>
        <MoneyRow label="Amount received" value={pay.amount} bold />
        <div className="muted">{p.amountInWords}</div>
        <div className="row">
          <span>Paid via</span>
          <span>
            {pay.paymentAccountName}
            {p.accountLast4 ? ` ••${p.accountLast4}` : ''}
          </span>
        </div>
        {pay.referenceNumber && (
          <div className="row">
            <span>Reference</span>
            <span>{pay.referenceNumber}</span>
          </div>
        )}
      </div>
      {applied.length > 0 && (
        <>
          <div className="rule" />
          <div className="bold">Applied to</div>
          {applied.map((a) => (
            <div key={a.id} className="row">
              <span>
                {a.invoiceNumber} · <Typed>{a.chargeDescription}</Typed>
              </span>
              <span className="money">{money(a.amount)}</span>
            </div>
          ))}
        </>
      )}
      <div className="rule" />
      <MoneyRow label="Kept as advance" value={pay.advance} />
      <MoneyRow
        label="Remaining outstanding"
        value={p.remainingOutstanding}
        bold
      />
      {pay.notes && (
        <div>
          <Typed>{pay.notes}</Typed>
        </div>
      )}
      <div className="muted">Received by {pay.receivedByName ?? '—'}</div>
      <Footer p={p} />
    </>
  )
}

function RefundDoc({
  p,
}: {
  p: Extract<PrintPayload, { document: 'REFUND' }>
}) {
  const r = p.refund
  return (
    <>
      <ClinicHeader
        p={p}
        title="REFUND VOUCHER"
        number={r.refundNumber}
        sub={r.refundDate}
      />
      <PatientBlock
        patient={r.patient}
        extra={
          r.invoiceNumber ? <div>Invoice {r.invoiceNumber}</div> : undefined
        }
      />
      <div style={{ marginTop: 8 }}>
        <MoneyRow label="Amount refunded" value={r.amount} bold />
        <div className="muted">{p.amountInWords}</div>
        <div className="row">
          <span>Paid out via</span>
          <span>{r.paymentAccountName}</span>
        </div>
        {r.referenceNumber && (
          <div className="row">
            <span>Reference</span>
            <span>{r.referenceNumber}</span>
          </div>
        )}
        <div className="row">
          <span>Reason</span>
          <span>
            <Typed>{r.reason}</Typed>
          </span>
        </div>
        <div className="muted">Refunded by {r.refundedByName ?? '—'}</div>
      </div>
      <div className="sign">
        <div>Patient / guardian</div>
        <div>Refunded by</div>
      </div>
      <Footer p={p} />
    </>
  )
}

function StatementDoc({
  p,
}: {
  p: Extract<PrintPayload, { document: 'STATEMENT' }>
}) {
  const s = p.statement
  return (
    <>
      <ClinicHeader
        p={p}
        title="PATIENT STATEMENT"
        number={`${s.from ?? 'Start'} – ${s.to ?? 'Today'}`}
      />
      <PatientBlock patient={p.patient} />
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th className="money">Debit</th>
            <th className="money">Credit</th>
            <th className="money">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td />
            <td className="bold">Opening balance</td>
            <td />
            <td />
            <td className="money">{money(s.openingBalance)}</td>
          </tr>
          {s.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.entryDate}</td>
              <td>{r.description}</td>
              <td className="money">{r.debit ? money(r.debit) : ''}</td>
              <td className="money">{r.credit ? money(r.credit) : ''}</td>
              <td className="money">{money(r.balance)}</td>
            </tr>
          ))}
          <tr>
            <td />
            <td className="bold">Closing balance</td>
            <td />
            <td />
            <td className="money bold">{money(s.closingBalance)}</td>
          </tr>
        </tbody>
      </table>
      <div className="totals">
        <MoneyRow label="Advance held" value={s.advance} />
      </div>
      <Footer p={p} />
    </>
  )
}

function CashCloseDoc({
  p,
}: {
  p: Extract<PrintPayload, { document: 'CASH_CLOSE' }>
}) {
  const c = p.close
  return (
    <>
      <ClinicHeader
        p={p}
        title="CASH CLOSE"
        number={c.businessDate}
        sub={`${new Date(c.periodStart).toLocaleString()} – ${new Date(c.periodEnd).toLocaleString()}`}
      />
      {(c.lines ?? []).map((l) => (
        <div key={l.paymentAccountId} style={{ marginBottom: 4 }}>
          <div className="bold">{l.paymentAccountName}</div>
          <MoneyRow label="Expected" value={l.expected} />
          {l.counted != null && <MoneyRow label="Counted" value={l.counted} />}
          {l.counted != null && (
            <MoneyRow label="Variance" value={l.variance} />
          )}
        </div>
      ))}
      <div className="rule" />
      <MoneyRow label="Total expected" value={c.totalExpected} bold />
      <MoneyRow label="Total variance" value={c.totalVariance} />
      {c.note && (
        <div>
          <Typed>{c.note}</Typed>
        </div>
      )}
      <div className="muted">Closed by {c.closedByName ?? '—'}</div>
      <div className="sign">
        <div>Cash received by</div>
        <div>Closed by</div>
      </div>
      <Footer p={p} />
    </>
  )
}

export function PrintTemplate({
  payload,
  format,
}: {
  payload: PrintPayload
  format: PrintFormat
}) {
  const thermal = format === 'THERMAL_80'
  return (
    <div className={`doc ${thermal ? 'thermal' : ''}`}>
      {payload.document === 'INVOICE' && (
        <InvoiceDoc p={payload} thermal={thermal} />
      )}
      {payload.document === 'RECEIPT' && <ReceiptDoc p={payload} />}
      {payload.document === 'REFUND' && <RefundDoc p={payload} />}
      {payload.document === 'STATEMENT' && <StatementDoc p={payload} />}
      {payload.document === 'CASH_CLOSE' && <CashCloseDoc p={payload} />}
    </div>
  )
}
