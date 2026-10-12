import type { QueueEntry } from '../types'

/** Case-insensitive match on token, patient name, phone or patient number. */
export function matchesQueueSearch(entry: QueueEntry, query: string): boolean {
  if (!query) return true
  const s = query.toLowerCase()
  return (
    entry.token.toLowerCase().includes(s) ||
    (entry.patient?.fullName.toLowerCase().includes(s) ?? false) ||
    (entry.patient?.phone?.toLowerCase().includes(s) ?? false) ||
    (entry.patient?.patientNumber?.toLowerCase().includes(s) ?? false)
  )
}
