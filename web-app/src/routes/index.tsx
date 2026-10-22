import { createFileRoute } from '@tanstack/react-router'
import { HomeRedirect } from '@/features/access'

// No explicit destination: forward to the user's home page.
export const Route = createFileRoute('/')({
  component: HomeRedirect,
})
