import { createFileRoute } from '@tanstack/react-router'
import { MedicinesPage } from '@/features/prescriptions/pages/MedicinesPage'

export const Route = createFileRoute('/medicine-directory')({
  // Doctors read the library; managers edit it.
  staticData: { can: ['prescriptions.create', 'prescriptions.library.manage'] },
  component: () => <MedicinesPage />,
})
