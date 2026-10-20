import { createRoot } from 'react-dom/client'
import { QrCode } from '@/features/lab-orders'
import type { Shipment } from './types'

const ROOT_ID = 'print-root'
const STYLE_ID = 'lab-shipment-slip-print'

// Print-only stylesheet, same approach as the work order print.
const CSS = `
#print-root { display: none; }
@media print {
  @page { size: A5; margin: 10mm; }
  body > *:not(#print-root) { display: none !important; }
  #print-root { display: block; }
}
#print-root .slip { font-family: system-ui, "Segoe UI", Arial, sans-serif; color: #000; font-size: 11pt; }
#print-root .slip h1 { font-size: 16pt; margin: 0; }
#print-root .slip .muted { color: #555; font-size: 9pt; }
#print-root .slip .head { display: flex; justify-content: space-between; gap: 12px; }
#print-root .slip table { width: 100%; border-collapse: collapse; margin-top: 8px; }
#print-root .slip th, #print-root .slip td { padding: 4px 6px; border-bottom: 1px solid #ccc; text-align: left; }
`

function Slip({ s }: { s: Shipment }) {
  return (
    <div className="slip">
      <div className="head">
        <div>
          <h1>Shipment {s.shipmentNo}</h1>
          <p className="muted">
            {s.lab.name} → {s.clinic.name}
          </p>
          <p className="muted">
            {s.courierName ?? ''} {s.trackingNo ? `#${s.trackingNo}` : ''}
          </p>
        </div>
        <QrCode
          value={s.qrValue}
          size={110}
          label={`Shipment ${s.shipmentNo}`}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Work</th>
            <th>Contents</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l) => (
            <tr key={l.id}>
              <td>
                {l.orderNo} / {l.lineNo}
              </td>
              <td>
                {l.serviceName}
                {l.stageName ? ` — ${l.stageName}` : ''}
                {l.stageRound && l.stageRound > 1
                  ? ` (round ${l.stageRound})`
                  : ''}
              </td>
              <td>{l.contents}</td>
              <td>{l.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Clinic: scan the code to receive this shipment.</p>
    </div>
  )
}

/** Prints the shipment slip with its QR code (no extra route). */
export async function printShipmentSlip(s: Shipment): Promise<void> {
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
  document.title = `Shipment ${s.shipmentNo}`
  const root = createRoot(host)
  root.render(<Slip s={s} />)
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
