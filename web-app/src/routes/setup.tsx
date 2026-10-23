import { createFileRoute } from '@tanstack/react-router'
import { SetupWizardPage } from '@/features/account'

export const Route = createFileRoute('/setup')({
  component: () => <SetupWizardPage />,
})
