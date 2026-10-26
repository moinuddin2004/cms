# Report — ch31-consultation.md
- Figures: 7 total — 3 placeholders (workspace, record slide-over, complete dialog), 4 diagrams (start sequence, complete sequence, ERD, encounter lifecycle).
- Diagrams failed to render: none (lifecycle re-rendered once to drop quotes from labels).
- Features: 15 — 11 Implemented, 2 Partial (alerts from free text; removed-treatment voiding unreachable), 2 Not implemented (lab order from workspace; SOAP notes/templates).
- Encounter has no status column; lifecycle drawn via queue-entry states.
- Unverified: exact compensation tables read by CommissionService.snapshot (named compensation_plans / commission_rules, not opened).
- Unverified: workspace UI behaviour when the prescriptions feature is off (only the server refusal is confirmed).
- Not run: no app, tests or DB; all behaviour from code reading.
