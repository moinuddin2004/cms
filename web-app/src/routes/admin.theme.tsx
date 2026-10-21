import { createFileRoute } from '@tanstack/react-router'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { ThemeBuilderPage } from '@/features/theme'

export const Route = createFileRoute('/admin/theme')({
  component: () => (
    <RequireRolePage roles={['clinic_admin']}>
      <ThemeBuilderPage />
    </RequireRolePage>
  ),
})
