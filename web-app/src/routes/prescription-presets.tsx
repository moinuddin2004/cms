import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { PresetsPage } from '@/features/prescriptions/pages/PresetsPage'

/**
 * Prescription presets — ready-made sets of medicines. (The backend still
 * calls these `treatment-plan-templates`; real treatment plans live at
 * `/plan-templates`.)
 */
export const Route = createFileRoute('/prescription-presets')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <PresetsPage />
    </RequireFeaturePage>
  ),
})
