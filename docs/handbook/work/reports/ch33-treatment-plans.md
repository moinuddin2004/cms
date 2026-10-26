# Hand-back — ch33-treatment-plans.md
- Features documented: 14 (Implemented 7, Partial 6, Not implemented 1, Unverified 0).
- Figures: 8 total — 3 placeholders (templates page, template editor, Record Treatment dialog) and 5 diagrams (template-kinds flowchart, plan-to-charges sequence, ERD, plan status, item status).
- Diagrams that failed to render: none (all OK; PNGs opened; ERD height/width 1.9).
- Confirmed no web caller for charges-from-plan; the billing summary has an API function and hook but no component.
- Plan and item state diagrams show intended paths; the code accepts any transition (stated in the text).
- Not verified: that a voided charge frees the plan item for re-charging (inferred from the partial unique index on active charges).
- Security note (category level) in work/conflicts/ch33-treatment-plans.md.
