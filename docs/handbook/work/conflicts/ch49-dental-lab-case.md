# Conflicts and oddities - Chapter 49

- Chapter 41 (lab portal) was not yet written; portal facts come from controller code (lab-production.controller, lab-portal-order-actions.controller, magic-link.controller). Magic link actions limited to accept, reject, request_clarification (LINK_ACTIONS); production endpoints are LabPortalController routes under /lab-portal.
- Consequence stated in the chapter: a lab with only a magic link cannot run production steps. Deduced from the controllers; not run.
- Chapter 40 refers to a section 40.3.31 that does not exist in its headings (ends at 40.3.30).

## Security
- Category: tokens. Magic-link rate limiting is in process memory (per instance), noted in ch40.
