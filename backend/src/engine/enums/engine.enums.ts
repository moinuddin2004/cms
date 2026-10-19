export enum DefinitionStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

/** Audit `entity_type` values written by the engine. */
export const ENGINE_ENTITY = {
  SPECIALTY: 'specialty',
  ORGANIZATION_SPECIALTY: 'organization_specialty',
  FORM_SCHEMA: 'form_schema',
  FORM_SCHEMA_VERSION: 'form_schema_version',
  WORKFLOW_TEMPLATE: 'workflow_template',
  WORKFLOW_VERSION: 'workflow_template_version',
  STAGE_TEMPLATE: 'stage_template',
} as const;
