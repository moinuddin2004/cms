import type { Appointment } from '../types'

/**
 * Opens a self-contained printable window for an appointment receipt and
 * triggers the browser print dialog. Receptionists hand this to the patient
 * with their token number on it. No external dependencies — the document
 * is a complete `<html>` we write into a popup.
 */
export function printAppointmentReceipt(
  appt: Appointment,
  opts: { clinicName?: string; locationName?: string } = {},
) {
  const win = window.open('', '_blank', 'width=520,height=720')
  if (!win) return

  const start = new Date(appt.startTime)
  const end = new Date(appt.endTime)
  const dateLabel = start.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeLabel = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  const tokenDisplay =
    appt.tokenNumber != null ? String(appt.tokenNumber).padStart(3, '0') : '—'

  const flags: string[] = []
  if (appt.isEmergency) flags.push('EMERGENCY')
  if (appt.isWalkIn) flags.push('WALK-IN')

  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Appointment Receipt · ${esc(appt.patient?.fullName ?? '')}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: #0f172a;
        margin: 0;
        background: #f8fafc;
        padding: 24px;
      }
      .receipt {
        max-width: 380px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
      }
      .header {
        background: #0f172a;
        color: #f8fafc;
        padding: 18px 24px;
        text-align: center;
      }
      .header .clinic { font-size: 13px; opacity: 0.7; letter-spacing: 0.04em; text-transform: uppercase; }
      .header h1 { margin: 4px 0 0; font-size: 18px; letter-spacing: 0.01em; font-weight: 600; }
      .header .loc { font-size: 11px; opacity: 0.65; margin-top: 4px; }

      .token {
        text-align: center;
        padding: 24px 16px 18px;
        border-bottom: 1px dashed #cbd5e1;
      }
      .token .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #64748b;
      }
      .token .value {
        font-size: 56px;
        font-weight: 700;
        line-height: 1;
        margin-top: 6px;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
      }
      .token .flags {
        margin-top: 8px;
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .flag {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        background: #fee2e2;
        color: #991b1b;
        letter-spacing: 0.04em;
      }
      .flag.walkin { background: #ede9fe; color: #5b21b6; }

      .body { padding: 18px 24px 20px; }
      .row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
      .row:last-child { border-bottom: none; }
      .row .k { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
      .row .v { font-size: 13px; font-weight: 500; color: #0f172a; text-align: right; max-width: 60%; }
      .notes { margin-top: 12px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; font-size: 12px; color: #475569; font-style: italic; }

      .footer {
        text-align: center;
        padding: 12px 16px 16px;
        font-size: 10px;
        color: #94a3b8;
        border-top: 1px dashed #cbd5e1;
      }

      @media print {
        body { background: #ffffff; padding: 0; }
        .receipt { border: none; max-width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <div class="clinic">${esc(opts.clinicName ?? 'Clinic')}</div>
        <h1>Appointment Receipt</h1>
        ${opts.locationName ? `<div class="loc">${esc(opts.locationName)}</div>` : ''}
      </div>

      <div class="token">
        <div class="label">Token</div>
        <div class="value">${esc(tokenDisplay)}</div>
        ${
          flags.length
            ? `<div class="flags">${flags
                .map(
                  (f) =>
                    `<span class="flag ${f === 'WALK-IN' ? 'walkin' : ''}">${esc(f)}</span>`,
                )
                .join('')}</div>`
            : ''
        }
      </div>

      <div class="body">
        <div class="row"><span class="k">Patient</span><span class="v">${esc(appt.patient?.fullName ?? '—')}</span></div>
        ${appt.patient?.patientNumber ? `<div class="row"><span class="k">Patient #</span><span class="v">${esc(appt.patient.patientNumber)}</span></div>` : ''}
        ${appt.patient?.phone ? `<div class="row"><span class="k">Phone</span><span class="v">${esc(appt.patient.phone)}</span></div>` : ''}
        <div class="row"><span class="k">Doctor</span><span class="v">${appt.doctor?.fullName ? 'Dr. ' + esc(appt.doctor.fullName) : 'Unassigned'}</span></div>
        <div class="row"><span class="k">Date</span><span class="v">${esc(dateLabel)}</span></div>
        <div class="row"><span class="k">Time</span><span class="v">${esc(timeLabel)}</span></div>
        <div class="row"><span class="k">Duration</span><span class="v">${appt.durationMinutes} min</span></div>
        <div class="row"><span class="k">Type</span><span class="v" style="text-transform: capitalize">${esc(appt.type.replace('_', ' '))}</span></div>
        ${appt.notes ? `<div class="notes">${esc(appt.notes)}</div>` : ''}
      </div>

      <div class="footer">
        Please present this slip at reception.
      </div>
    </div>
  </body>
</html>`)
  win.document.close()
  win.focus()
  win.setTimeout(() => win.print(), 250)
}

function esc(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
