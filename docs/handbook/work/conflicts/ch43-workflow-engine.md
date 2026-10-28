# Conflicts and oddities: Chapter 43

- Studio routes have no `staticData.can`; protection is a super admin check in each route component plus `@RequireSuperAdmin()` on the API.
- Transition role names in seeds (lab_admin, doctor, clinic_admin, receptionist) are legacy names, not the 5 system role templates.
- Only form schemas have a history endpoint; workflows and stage templates do not.
- Specialty create/update and per-organization enablement have no screen.
- Published version immutability is service-enforced; ENTITY_CATALOG claim of a trigger on form_schema_versions is wrong (already recorded in Chapter 26).

## Security
- Config Studio authorisation rests on one super admin check (category: single control point on the client; API guard is authoritative).
