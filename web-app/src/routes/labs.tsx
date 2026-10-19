import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { LabLinksPage } from '@/features/labs'

/** The clinic's lab list. */
export const Route = createFileRoute('/labs')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <LabLinksPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
