# Hand-back — Chapter 30 (Queue)

- File: `src/part5-modules/ch30-queue.md`; 31 features: 28 Implemented, 2 Partial (next-preview, events log — backend only), 1 Not implemented (TV display management).
- Figures: 14 total — 1 existing screenshot (`my-queue-picker.jpg`), 7 placeholders (doctor screen, board card view, board list view, check-in dialog, walk-in sheet, TV display, queue settings), 6 diagrams (selection flowchart, realtime flow, ERD, session lifecycle, entry lifecycle, visit sequence).
- Diagrams rendered: all OK; PNGs opened and readable (entry lifecycle kept as one LR diagram, ratio 0.33).
- Could not verify: live behaviour (no app run); Redis heartbeat details of the worker publisher were not read line by line; billing internals of `syncForEncounter` summarised, not traced into pricing/commission code.
- Could not verify: whether production sets the process roles as `api` + one `worker` (stated from `process-role.ts` comments).
- Conflicts recorded in `work/conflicts/ch30-queue.md` (worker count, Redis adapter wording, missing POST /queue/sessions, settings message vs code); Security heading: public display endpoint (by design) and unscoped visit history.
