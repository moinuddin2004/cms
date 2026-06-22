import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/patients/new')({
  beforeLoad: () => {
    throw redirect({ to: '/patients' })
  },
  component: () => null,
})
