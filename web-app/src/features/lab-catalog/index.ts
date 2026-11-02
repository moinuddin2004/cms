// Lab catalog (Sprint 5) — import from here across features.
export * from './types'
export { catalogKeys } from './query-keys'
export { formatMinor, minorToRupeesText, rupeesToMinor } from './lib/money'
export { LabServicesPanel } from './components/LabServicesPanel'
export { LabCatalogPage } from './pages/LabCatalogPage'
export { OrderTemplatesPage } from './pages/OrderTemplatesPage'

// Used by lab orders (Sprint 6): services with this clinic's prices, forms, quotes.
export {
  useClinicForms,
  useClinicServices,
  useOrderTemplates,
} from './hooks/useClinicCatalog'
export { clinicCatalogApi } from './services/lab-catalog.api'
