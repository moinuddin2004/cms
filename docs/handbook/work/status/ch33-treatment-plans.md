| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 33 | Browse and filter plan templates | [Implemented] | Card grid, search + category; fees stripped without price.view |
| 33 | Create a plan template | [Implemented] | Up to 50 procedures in jsonb; not audited |
| 33 | Edit a plan template | [Implemented] | Replaces procedure list |
| 33 | Hide or show a plan template | [Implemented] | is_active switch |
| 33 | Delete a plan template | [Implemented] | Hard delete; treatments.plan_template_id SET NULL |
| 33 | Starter templates for a new clinic | [Implemented] | 12 defaults seeded when org has zero templates (re-seeds if all deleted) |
| 33 | Use a template when recording a treatment | [Implemented] | Prefills name/cost, tags treatment; button needs price.view |
| 33 | Create a patient treatment plan | [Partial] | Backend only; web hooks unused |
| 33 | Update a plan (status, acceptance, costs) | [Partial] | Backend only; free status changes |
| 33 | Add items to a plan | [Partial] | Backend only |
| 33 | Track progress of plan items | [Partial] | Backend only; nothing automatic |
| 33 | Start a patient plan from a template | [Not implemented] | Only UI text/comment claim it |
| 33 | Turn plan items into charges | [Partial] | Backend only; no web caller |
| 33 | Plan billing summary | [Partial] | Endpoint + API fn + hook; no component renders it |
