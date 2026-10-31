import { createFileRoute } from '@tanstack/react-router'
import { LabCatalogPage } from '@/features/lab-catalog'

/** The clinic's lab price list and treatment mappings. */
export const Route = createFileRoute('/settings/lab-catalog')({
  staticData: { can: 'lab.catalog.manage' },
  component: LabCatalogPage,
})
