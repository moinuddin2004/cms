import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PlanTemplatesPage } from '@/features/plan-templates'

/** Predefined treatment plans (Root Canal, Implant…). Prescription Presets are separate. */
export const Route = createFileRoute('/plan-templates')({
  component: () => (
    <RequireFeaturePage feature="patients.treatment_plans">
      <DashboardLayout>
        <PlanTemplatesPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
