import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { MedicinesPage } from '@/features/prescriptions/pages/MedicinesPage'

export const Route = createFileRoute('/medicine-directory')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <MedicinesPage />
    </RequireFeaturePage>
  ),
})
