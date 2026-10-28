# Hand-back — Chapter 41 (Lab Portal)

- File: `src/part5-modules/ch41-lab-portal.md`; 27 features: 24 Implemented, 3 Partial (extra charge request, file upload, notifications), 0 Not implemented.
- Figures: 13 total — 9 placeholders (portal home, orders, order, production, clinics, team, profile, billing, magic link page), 4 diagrams (case sequence, magic link states, plus two reused existing diagrams: lab directory ERD from Chapter 25 and the lab link status from Chapter 40). No existing screenshot applies.
- Diagrams rendered: `ch41-case-sequence`, `ch41-magic-link-status` OK; PNGs checked.
- Could not verify: runtime behaviour; account type for lab-only users in User Admin; absence of a portal notification inbox is from code search, not from the running app.
- Environment variables are named only (`MAGIC_LINK_SECRET`, `LAB_MAGIC_LINK_TTL_HOURS`, `LAB_LINK_RATE_LIMIT`, `FRONTEND_URL`).
- Conflicts and security categories in `work/conflicts/ch41-lab-portal.md`.
