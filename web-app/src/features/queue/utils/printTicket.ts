import { toast } from 'sonner'
import { fetchTicket } from '../services/queue.api'
import type { QueueTicket } from '../types'

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )

/**
 * Print the patient's token ticket: clinic, location, doctor, service date,
 * the doctor-wise token (A-007) and roughly how many people are ahead.
 * Opens a self-contained popup and triggers the browser print dialog.
 */
export async function printQueueTicket(entryId: string): Promise<void> {
  // Open synchronously (inside the click) so popup blockers allow it.
  const win = window.open('', '_blank', 'width=420,height=640')
  if (!win) {
    toast.error('Allow pop-ups to print the ticket')
    return
  }
  win.document.write(
    '<p style="font-family:sans-serif;padding:24px">Preparing ticket…</p>',
  )

  let ticket: QueueTicket
  try {
    ticket = await fetchTicket(entryId)
  } catch {
    win.close()
    toast.error('Could not load the ticket')
    return
  }

  const date = new Date(`${ticket.serviceDate}T00:00:00`).toLocaleDateString(
    'en-US',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  )
  const appt = ticket.scheduledStart
    ? new Date(ticket.scheduledStart).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  win.document.open()
  win.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>Token ${esc(ticket.token)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;color:#0f172a;text-align:center}
  .clinic{font-size:16px;font-weight:700}
  .muted{color:#64748b;font-size:12px}
  .token{font-size:64px;font-weight:800;letter-spacing:2px;margin:16px 0 4px;font-variant-numeric:tabular-nums}
  .doctor{font-size:15px;font-weight:600;margin-top:4px}
  .row{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-top:1px dashed #cbd5e1}
  .box{margin:16px auto 0;max-width:300px;text-align:left}
  @media print{body{padding:8px}}
</style></head><body>
  <div class="clinic">${esc(ticket.clinicName)}</div>
  <div class="muted">${esc(ticket.locationName)}</div>
  <div class="token">${esc(ticket.token)}</div>
  <div class="doctor">Dr. ${esc(ticket.doctorName)}</div>
  <div class="muted">${esc(date)}</div>
  <div class="box">
    <div class="row"><span>Patient</span><strong>${esc(ticket.patientName)}</strong></div>
    <div class="row"><span>Type</span><span>${ticket.queueType === 'appointment' ? `Appointment${appt ? ' ' + esc(appt) : ''}` : 'Walk-in'}</span></div>
    ${ticket.peopleAhead != null ? `<div class="row"><span>About ahead of you</span><strong>${ticket.peopleAhead}</strong></div>` : ''}
  </div>
  <p class="muted" style="margin-top:20px">Please wait for your token to be called.</p>
  <script>window.onload=function(){window.print()}</script>
</body></html>`)
  win.document.close()
}
