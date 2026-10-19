// Configuration Studio (lab ERD §18) — import from here across features.
export * from './types'
export { studioKeys } from './query-keys'
export { FormSchemasPage, WorkflowsPage } from './pages/DefinitionsListPage'
export { FormSchemaDetailPage } from './pages/FormSchemaDetailPage'
export { WorkflowDetailPage } from './pages/WorkflowDetailPage'
export { StageTemplatesPage } from './pages/StageTemplatesPage'

// Shared with order forms (Sprint 6): the same renderer the Studio previews with.
export { DynamicFormFields } from './components/DynamicFormFields'
export type { RenderFile } from './components/DynamicFormFields'
export { ToothChartInput } from './components/ToothChartInput'
export {
  answersToSend,
  initialAnswers,
  readFields,
  visibleKeys,
} from './lib/form-preview'
