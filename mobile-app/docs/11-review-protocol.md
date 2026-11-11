# 11 — Review protocol

> How the architect (Claude Opus) reviews implementer work, and what the implementer must hand in.

## 1. What the implementer submits

1. Branch `mobile/<TASK-ID>-<slug>` with the work committed (or, if the user said not to commit,
   the working tree left as is and the file list in the handoff).
2. A `HANDOFF.md` entry (template in that file) — **append**, never edit older entries.
3. `PROGRESS.md`: the task row → `review`, with branch and date.
4. Screenshots (UI tasks) in `docs/reviews/<TASK-ID>/`.

## 2. How the review runs

1. Read the task card, the handoff entry, then the diff (`git diff master...<branch>`).
2. Run: `npm run lint`, `npm run typecheck`, `npm test` (mobile); `npm run lint`, `npm run build`,
   `npm test` and named int specs (backend). Never trust pasted output alone.
3. Walk the checklist below. Each finding gets a severity.
4. Write `docs/reviews/<TASK-ID>/review.md` (format in §4), update `PROGRESS.md`:
   `done` / `changes-requested`, and add any new decision to `DECISIONS.md`.
5. If the review changes a contract or rule, update the doc **in the same review** so the next
   implementer reads the corrected version.

## 3. Checklist

### Blockers (any one → `changes-requested`)

- [ ] Cross-space import, tenant headers in the patient client, token outside memory/SecureStore,
      PHI in prefs/logs/push text (03 §2, §5).
- [ ] Backend: patient route without `@PatientApi()`, id taken from client without context check,
      entity or internal field returned, missing isolation test for a new read (03 §3).
- [ ] Acceptance criterion not met or not demonstrated.
- [ ] Lint, typecheck or tests failing.
- [ ] Schema change missing one of entity / `schema/*.sql` / `changes/*.sql`.
- [ ] react-hook-form, axios outside `api/`, hand-edited `core/ui` without PATCHES.md entry.
- [ ] A queue mutation without `Idempotency-Key`, or a key regenerated on retry.

### Major (fix before `done` unless the architect waives with a reason)

- [ ] Missing loading / empty / error / no-results state.
- [ ] Wrong timezone handling (phone tz used for clinic instants, or clinic tz for dose times).
- [ ] Permission gating by role/owner flags instead of `can()`.
- [ ] Hex colours, `ml-/mr-`, inline styles that a class could do, missing a11y label.
- [ ] Query key missing a variable the data depends on (org/location/profile).
- [ ] No unit test for new pure logic.
- [ ] Deviation from the screen spec without a note.

### Minor (record; may be fixed in a later card)

- Naming, comments, small duplication, copy tweaks, file length.

## 4. Review file format (`docs/reviews/<TASK-ID>/review.md`)

```markdown
# Review <TASK-ID> — <title>
Date: YYYY-MM-DD · Reviewer: architect · Verdict: done | changes-requested
Commands run: lint ✓ · typecheck ✓ · test ✓ (n passed) · backend …

## Findings
| # | Severity | File:line | Finding | Required change |
| 1 | Blocker | src/patient/lib/api.ts:12 | … | … |

## Acceptance
- [x] criterion 1 — how verified
- [ ] criterion 2 — why not

## Doc updates made in this review
- 07 §6.2: …

## Notes for the next card
- …
```

## 5. Rework loop

The implementer fixes only the listed findings on the same branch, appends a new HANDOFF entry
"Rework <TASK-ID> #n" listing each finding number and the fix, and sets PROGRESS back to `review`.
Two rework rounds failing on the same blocker → the architect fixes or re-specifies the card.
