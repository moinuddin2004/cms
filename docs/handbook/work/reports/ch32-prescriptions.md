# Report — ch32-prescriptions.md
- Figures: 11 total — 7 placeholders (list, builder, detail, presets, medicines, print layouts, printed PDF), 4 diagrams (sign-and-print sequence, layout resolution flowchart, ERD, status lifecycle).
- Diagrams failed to render: none.
- Features: 15 — 10 Implemented, 5 Partial (single-line medicine edits, duplicate, history, by-appointment lookup are backend-only or broken), 0 Not implemented.
- Unverified (code reading only): history read failing on an undeclared relation; duplicate failing on the doctor_id FK; cross-org prescription-number collision.
- Unverified: whether the configured storage makes uploaded PDFs publicly readable.
- Security findings (4, category level) recorded only in work/conflicts/ch32-prescriptions.md.
- Not run: no app, tests or DB.
