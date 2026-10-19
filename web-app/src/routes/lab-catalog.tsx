import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { LabCatalogPage } from '@/features/lab-catalog'

/** The clinic's lab price list and treatment mappings. */
export const Route = createFileRoute('/lab-catalog')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <LabCatalogPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
