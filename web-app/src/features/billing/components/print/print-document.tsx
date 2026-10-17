import { createRoot } from 'react-dom/client'
import { printApi } from '../../services/billing-v2.api'
import type { PrintDocumentType } from '../../services/billing-v2.api'
import type { PrintFormat } from '../../types/billing.types'
import { PRINT_CSS, PrintTemplate } from './templates'
import type { PrintPayload } from './templates'

const ROOT_ID = 'print-root'
const PAGE_STYLE_ID = 'print-page'
const BASE_STYLE_ID = 'print-base'

const PAGE_RULE: Record<PrintFormat, string> = {
  A4: '@page { size: A4; margin: 12mm; }',
  THERMAL_80: '@page { size: 80mm auto; margin: 0; }',
}

function ensureStyle(id: string, css: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = css
  return el
}

async function waitForAssets(root: HTMLElement): Promise<void> {
  await document.fonts.ready
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(
            (r) => ((img.onload = () => r()), (img.onerror = () => r())),
          ),
    ),
  )
}

/**
 * Prints a billing document through a portal on the current page (plan
 * §9.2): fetch the frozen payload, render the template into `#print-root`,
 * inject the `@page` rule, name the PDF after the document number, print,
 * then clean up on `afterprint`. No extra routes, no second app instance.
 */
export async function printDocument(
  type: PrintDocumentType,
  id: string,
  opts: {
    format?: PrintFormat
    params?: Record<string, string | number | undefined>
  } = {},
): Promise<void> {
  const payload = (await printApi.load(
    type,
    id,
    opts.params,
  )) as unknown as PrintPayload
  const format: PrintFormat =
    type === 'refund' || type === 'statement'
      ? 'A4'
      : (opts.format ?? payload.format)

  let host = document.getElementById(ROOT_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = ROOT_ID
    document.body.appendChild(host)
  }
  ensureStyle(BASE_STYLE_ID, PRINT_CSS)
  const pageStyle = ensureStyle(PAGE_STYLE_ID, PAGE_RULE[format])
  const previousTitle = document.title
  document.title = documentTitle(payload)

  const root = createRoot(host)
  root.render(<PrintTemplate payload={payload} format={format} />)
  await new Promise((r) => setTimeout(r, 50))
  await waitForAssets(host)

  const cleanup = () => {
    root.unmount()
    pageStyle.remove()
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}

function documentTitle(p: PrintPayload): string {
  switch (p.document) {
    case 'INVOICE':
      return p.invoice.invoiceNumber
    case 'RECEIPT':
      return p.payment.receiptNumber
    case 'REFUND':
      return p.refund.refundNumber
    case 'STATEMENT':
      return `Statement ${p.patient.name}`
    case 'CASH_CLOSE':
      return `Cash close ${p.close.businessDate}`
  }
}
