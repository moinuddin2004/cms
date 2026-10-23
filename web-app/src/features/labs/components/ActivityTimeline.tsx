import { ActivityTimeline as SharedActivityTimeline } from '@/components/shared/ActivityTimeline'
import type { TimelineEntry } from '../types'

const FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  phone: 'Phone',
  whatsappPhone: 'WhatsApp',
  email: 'Email',
  city: 'City',
  address: 'Address',
  status: 'Status',
  role: 'Role',
  isActive: 'Active',
  paymentTermsDays: 'Payment terms (days)',
  patientDataLevel: 'Patient data shared',
  notes: 'Notes',
}

/** Newest-first history of one lab record: who changed what, and when. */
export function ActivityTimeline(props: {
  entries: TimelineEntry[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  return <SharedActivityTimeline {...props} fieldLabels={FIELD_LABEL} />
}
