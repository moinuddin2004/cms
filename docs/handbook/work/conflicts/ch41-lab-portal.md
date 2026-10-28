# Conflicts and oddities — Chapter 41 (Lab Portal)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| OUTLINE (Lab portal) | Portal has orders with "charge requests" and a production board with full receiving | Charge request creation and file upload have endpoints but no portal UI; the portal receive button records full quantity and condition OK only; `unassign` and the stage list endpoint have no UI | `lab-portal.api.ts`, `LabProductionPage.tsx` |
| Code comment in `labs/portal/lab-portal.guard.ts` | "Super admins hold no lab membership, so they are refused" | Correct, but a super admin cannot be given a membership either (`LAB_MEMBER_NOT_ALLOWED`) | `LabMembersService.assertMayJoin` |
| INVENTORY.md §2 (CLAUDE.md) | `/lab-portal` not mentioned; guard chain has 4 guards | Portal controllers are `@ContextFree` and use their own `LabPortalGuard` after the global chain | `lab-actor.ts` |

## Oddities

- Lab members receive in-app notifications with links into the portal, but the portal layout has no notification inbox (verified by search of `LabPortalLayout.tsx`).
- `GET /lab-portal/production/items/:itemId/stages` and the matching web API function are unused by any component.
- The Team page hides itself from technicians but the API also refuses (`@LabRoles(lab_admin)`); the order accept/reject/clarify routes have no `@LabRoles` and rely on the workflow roles (seeded: lab admin).
- A lab admin can demote or deactivate another lab admin; no rule keeps at least one admin (self changes are blocked).
- The account for a lab-only person must exist before it is added as a member; which account type to create in User Admin for a lab-only person was not confirmed from the code.
- Magic link page and portal share `LabOrderActions`; the link filters the action list to accept, reject, request clarification only.
- `MagicLinkThrottleGuard` limit defaults to 120 requests per minute per IP from environment variable `LAB_LINK_RATE_LIMIT`.

## Security

- Access control: no-login routes depend on a bearer token in the address; revocation, expiry and order closure are the controls.
- Rate limiting: in-memory per instance.
- Secrets handling: signing secret fallback to the access-token secret (see Chapter 40 conflicts).
- Tenant isolation: lab-owned reads are filtered by a shared base class; other labs' ids answer 404.
