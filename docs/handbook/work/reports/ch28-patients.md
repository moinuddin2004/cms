# Hand-back — ch28-patients.md
- Features documented: 30 (Implemented 19, Partial 9, Not implemented 2, Unverified 0).
- Figures: 13 total — 6 placeholders (patient list, new patient dialog, detail, teeth chart, import, change history) and 7 diagrams (import sequence, scope flowchart, 2 ERDs, 3 state diagrams).
- Diagrams that failed to render: none (all OK; PNGs opened and checked).
- Not verified by running: table column sorting is client-side (read from DataTable, no manual sorting).
- Not verified: the exact user-visible failure when deleting a patient with billing/lab rows (inferred from RESTRICT foreign keys plus the global exception filter, which answers "Something went wrong").
- Not verified: deployed databases whose constraints differ from the entities (dev uses synchronize).
- CRM tab: confirmed unmounted by grep; why it was never mounted is not in the git history examined.
- Treatment plans only summarised here; full detail in ch33.
- Security notes (category level) in work/conflicts/ch28-patients.md.
