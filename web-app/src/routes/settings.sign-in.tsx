import { createFileRoute } from '@tanstack/react-router'
import { SignInPolicyPage } from '@/features/clinic-access'

/** Owner only: the page itself tells everyone else. */
export const Route = createFileRoute('/settings/sign-in')({
  component: SignInPolicyPage,
})
