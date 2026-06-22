import type {
  Patient,
  PatientPrescription,
  PatientConsent,
} from '../types'

/**
 * Lightweight client-side printing: open a new window with a self-contained,
 * print-styled HTML document and trigger the browser print dialog. Avoids a
 * PDF dependency while still giving a clean printout / "Save as PDF".
 */
function openPrintWindow(title: string, bodyHtml: string) {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) {
    // Popup blocked — surface nothing here; caller can decide. Most browsers
    // allow popups triggered directly by a click handler.
    return
  }
  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 32px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin: 24px 0 8px; }
      .muted { color: #64748b; font-size: 12px; }
      .row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; }
      th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; }
      .block { margin-top: 16px; font-size: 13px; }
      .label { font-weight: 600; }
      .sig { margin-top: 48px; }
      .sig img { max-height: 90px; border: 1px solid #e2e8f0; padding: 4px; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`)
  win.document.close()
  win.focus()
  // Give the layout a tick (and images a chance) before printing.
  win.setTimeout(() => win.print(), 300)
}

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function patientHeader(patient: Patient, docTitle: string, docMeta: string) {
  return `
    <div class="row">
      <div>
        <h1>${escapeHtml(docTitle)}</h1>
        <div class="muted">${escapeHtml(docMeta)}</div>
      </div>
      <div style="text-align:right">
        <div class="label">${escapeHtml(patient.fullName)}</div>
        <div class="muted">${escapeHtml(patient.patientNumber)}</div>
        <div class="muted">${escapeHtml(patient.phone)}</div>
      </div>
    </div>`
}

export function printPrescription(rx: PatientPrescription, patient: Patient) {
  const meds = (rx.medications || [])
    .map(
      (m: any) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.dosage)}</td>
        <td>${escapeHtml(m.frequency)}</td>
        <td>${escapeHtml(m.instructions)}</td>
      </tr>`,
    )
    .join('')

  const extra = [
    rx.chiefComplaint
      ? `<div class="block"><span class="label">Chief Complaint:</span> ${escapeHtml(rx.chiefComplaint)}</div>`
      : '',
    rx.diagnosis
      ? `<div class="block"><span class="label">Diagnosis:</span> ${escapeHtml(rx.diagnosis)}</div>`
      : '',
    rx.specialInstructions
      ? `<div class="block"><span class="label">Special Instructions:</span> ${escapeHtml(rx.specialInstructions)}</div>`
      : '',
  ].join('')

  openPrintWindow(
    `Prescription ${rx.prescriptionNumber}`,
    `
      ${patientHeader(
        patient,
        'Prescription',
        `${rx.prescriptionNumber} · ${new Date(rx.prescriptionDate).toLocaleDateString()}`,
      )}
      <h2>Medications</h2>
      <table>
        <thead>
          <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Instructions</th></tr>
        </thead>
        <tbody>${meds || '<tr><td colspan="4">No medications listed.</td></tr>'}</tbody>
      </table>
      ${extra}
    `,
  )
}

export function printConsent(consent: PatientConsent, patient: Patient) {
  const sig = consent.signatureUrl
    ? `<div class="sig"><div class="label">Signature</div><img src="${escapeHtml(consent.signatureUrl)}" alt="Signature" /></div>`
    : ''

  openPrintWindow(
    `Consent ${consent.consentType}`,
    `
      ${patientHeader(
        patient,
        'Consent Form',
        `${consent.consentType.replace(/_/g, ' ')} · v${consent.consentVersion}`,
      )}
      <h2>Consent Terms</h2>
      <div class="block" style="white-space:pre-wrap">${escapeHtml(consent.consentText)}</div>
      <h2>Agreement</h2>
      <div class="block"><span class="label">Status:</span> ${consent.isAgreed ? 'Agreed' : 'Pending / Revoked'}</div>
      <div class="block"><span class="label">Signed by:</span> ${escapeHtml(consent.signedByName)} (${escapeHtml(consent.signedByType)})</div>
      <div class="block"><span class="label">Date:</span> ${consent.agreedAt ? new Date(consent.agreedAt).toLocaleString() : 'N/A'}</div>
      ${sig}
    `,
  )
}
