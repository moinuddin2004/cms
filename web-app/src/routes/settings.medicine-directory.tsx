import { createFileRoute } from '@tanstack/react-router'
import { MedicinesPage } from '@/features/prescriptions/pages/MedicinesPage'

/** Doctors read the library; managers edit it. */
export const Route = createFileRoute('/settings/medicine-directory')({
  staticData: { can: ['prescriptions.create', 'prescriptions.library.manage'] },
  component: MedicinesPage,
})
