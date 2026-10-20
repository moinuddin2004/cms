import { createFileRoute } from '@tanstack/react-router'
import { LabBillingPage } from '@/features/lab-portal'

/** The lab's bills, payments and statements (read-only). */
export const Route = createFileRoute('/lab-portal/billing')({
  component: LabBillingPage,
})
