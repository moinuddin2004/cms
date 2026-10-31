import { createFileRoute } from '@tanstack/react-router'
import { PlanTemplatesPage } from '@/features/plan-templates'

/** Predefined treatment plans (Root Canal, Implant…). Prescription presets are separate. */
export const Route = createFileRoute('/settings/plan-templates')({
  staticData: { can: 'plans.templates.manage' },
  component: PlanTemplatesPage,
})
