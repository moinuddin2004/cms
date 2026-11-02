import { createRoot } from 'react-dom/client'
import { formatInClinic } from '@/lib/datetime'
import { labOrdersApi } from '../services/lab-orders.api'
import type { WorkOrder } from '../types'
import { QrCode } from './QrCode'

const ROOT_ID = 'print-root'
const STYLE_ID = 'lab-work-order-print'

// Print-only stylesheet, same approach as billing's print templates.
const CSS = `
#print-root { display: none; }
@media print {
  @page { size: A4; margin: 12mm; }
  body > *:not(#print-root) { display: none !important; }
  #print-root { display: block; }
}
#print-root .wo { font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #000; font-size: 11pt; }
#print-root .wo h1 { font-size: 18pt; margin: 0; }
#print-root .wo .muted { color: #555; font-size: 9pt; }
#print-root .wo .head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
#print-root .wo .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 10px 0; }
#print-root .wo table { width: 100%; border-collapse: collapse; margin-top: 8px; }
#print-root .wo th, #print-root .wo td { padding: 4px 6px; border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; }
#print-root .wo tr { break-inside: avoid; }
#print-root .wo .urgent { border: 2px solid #000; padding: 2px 8px; font-weight: 700; }
`

function WorkOrderDoc({ w }: { w: WorkOrder }) {
  return (
    <div className="wo">
      <div className="head">
        <div>
          <h1>Lab work order {w.orderNo}</h1>
          <p className="muted">
            {w.clinic.name}
            {w.clinic.location ? ` · ${w.clinic.location}` : ''} → {w.lab.name}
            {w.lab.city ? `, ${w.lab.city}` : ''}
          </p>
          {w.priority === 'urgent' && <span className="urgent">URGENT</span>}
        </div>
        <QrCode value={w.qrValue} size={120} label={`Order ${w.orderNo}`} />
      </div>
      <div className="grid">
        <span>Patient: {w.patient.ref}</span>
        <span>Doctor: {w.doctor?.fullName ?? '—'}</span>
        <span>
          Submitted:{' '}
          {formatInClinic(w.submittedAt, 'dd/MM/yyyy')}
        </span>
        <span>Due back: {w.labExpectedOn ?? w.requestedOn ?? '—'}</span>
        <span>Revision: {w.revisionNo}</span>
      </div>
      {w.notes && <p>Instructions: {w.notes}</p>}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Work</th>
            <th>Teeth</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {w.items.map((i) => (
            <tr key={i.lineNo}>
              <td>{i.lineNo}</td>
              <td>
                {i.serviceName} × {i.quantity}
                {i.rush ? ' (rush)' : ''}
                {i.options.length > 0 && (
                  <div className="muted">{i.options.join(', ')}</div>
                )}
              </td>
              <td>
                {i.teeth
                  .map((t) =>
                    t.role && t.role !== 'crown'
                      ? `${t.tooth} (${t.role})`
                      : t.tooth,
                  )
                  .join(', ') || '—'}
              </td>
              <td>
                {i.answers.map((a) => (
                  <div key={a.label}>
                    {a.label}: {a.value}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Scan the code to open this order in the lab portal.
      </p>
    </div>
  )
}

/** Fetches the work-order payload and prints it (no extra route). */
export async function printWorkOrder(orderId: string): Promise<void> {
  const w = await labOrdersApi.workOrder(orderId)
  let host = document.getElementById(ROOT_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = ROOT_ID
    document.body.appendChild(host)
  }
  let style = document.getElementById(STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = CSS
  const previousTitle = document.title
  document.title = `Work order ${w.orderNo}`
  const root = createRoot(host)
  root.render(<WorkOrderDoc w={w} />)
  await new Promise((r) => setTimeout(r, 50))
  const cleanup = () => {
    root.unmount()
    style.remove()
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
