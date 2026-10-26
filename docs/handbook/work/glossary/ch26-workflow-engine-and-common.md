# Glossary — ch26-workflow-engine-and-common

- **Specialty** — a clinical specialty the engine is configured for, e.g. DENTAL (`specialties`).
- **Organization specialty** — whether one organization works in one specialty (`organization_specialties`).
- **Form schema** — the stable identity of an order form (`form_schemas`); **form schema version** — its versioned content (`form_schema_versions`).
- **Stage template** — the try-in rounds a kind of work goes through (`stage_templates`); **stage template step** — one round (`stage_template_steps`).
- **Workflow template** — a state machine for orders, items or stages (`workflow_templates`); **workflow template version** — a draft, published or retired version (`workflow_template_versions`).
- **Workflow state** — a state of a published version (`workflow_states`).
- **Workflow transition** — an allowed move between states under an action (`workflow_transitions`).
- **Workflow effect** — a code handler a transition can run, from the registry (`workflow_effects`).
- **Transition effect** — which effects a transition runs, in order (`transition_effects`).
- **Platform default** — a form, stage or workflow template with no organization, used unless an organization overrides it.
- **Audit log** — the generic append-only change history (`audit_logs`).
- **Status history** — the append-only log of status changes (`status_history`).
- **Number sequence** — per-organization counter for numbers such as LAB-0001 (`number_sequences`).
- **Chair** — a treatment chair of a location; entity only (`chairs`).
