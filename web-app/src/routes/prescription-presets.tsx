import { createFileRoute } from '@tanstack/react-router'
import { PresetsPage } from '@/features/prescriptions/pages/PresetsPage'

/**
 * Prescription presets — ready-made sets of medicines. (The backend still
 * calls these `treatment-plan-templates`; real treatment plans live at
 * `/plan-templates`.)
 */
export const Route = createFileRoute('/prescription-presets')({
  // Doctors read the library; managers edit it.
  staticData: { can: ['prescriptions.create', 'prescriptions.library.manage'] },
  component: () => <PresetsPage />,
})
