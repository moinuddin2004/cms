import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PlanTemplatesPage } from '@/features/plan-templates'

/** Predefined treatment plans (Root Canal, Implant…). Prescription Presets are separate. */
export const Route = createFileRoute('/plan-templates')({
  staticData: { can: 'plans.templates.manage' },
  component: () => (
    <DashboardLayout>
      <PlanTemplatesPage />
    </DashboardLayout>
  ),
})
