import { createFileRoute } from '@tanstack/react-router'
import { PresetsPage } from '@/features/prescriptions/pages/PresetsPage'

/** Prescription presets: ready-made sets of medicines. Doctors read the library; managers edit it. */
export const Route = createFileRoute('/settings/prescription-presets')({
  staticData: { can: ['prescriptions.create', 'prescriptions.library.manage'] },
  component: PresetsPage,
})
