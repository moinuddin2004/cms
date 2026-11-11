# Mobile app — documentation index

> The single map for everyone working on `mobile-app/` (and the backend/web pieces it needs).
> Product plan (why/what, Roman Urdu): [`../DentalFlow Mobile App — Final Use Cases & Feature Plan.md`](<../DentalFlow Mobile App — Final Use Cases & Feature Plan.md>).

## Documents

| # | Doc | Read when |
| --- | --- | --- |
| 01 | [Overview](01-overview.md) | Always, first |
| 02 | [Architecture](02-architecture.md) | Always |
| 03 | [Security and privacy](03-security.md) | Always — rules here block a review |
| 04 | [Coding standards](04-coding-standards.md) | Before writing any code |
| 05 | [UI/UX design system](05-ui-ux-design-system.md) | Any UI task |
| 06 | [Screen specs](06-screens.md) | The screen(s) your card names |
| 07 | [Backend contracts](07-backend-contracts.md) | Any task calling or building an API |
| 08 | [Database](08-database.md) | Backend tasks with schema changes |
| 09 | [Testing and quality](09-testing-and-quality.md) | Before handoff (Definition of Done) |
| 10 | [Roadmap and task cards](10-roadmap-and-tasks.md) | To find and read your card |
| 11 | [Review protocol](11-review-protocol.md) | Before handoff; reviewers always |
| — | [DECISIONS.md](DECISIONS.md) | When something seems to conflict |
| — | [PROGRESS.md](PROGRESS.md) | To pick a task / see state |
| — | [HANDOFF.md](HANDOFF.md) | Read the last entries before starting; append when done |
| — | `reviews/<TASK-ID>/` | Screenshots + architect reviews |

## Reading order by role

- **Implementer, first session ever:** 01 → 02 → 03 → 04 → 05 (skim) → 09 → 11 → your card in 10.
- **Implementer, next session:** `PROGRESS.md` → last 3 `HANDOFF.md` entries → your card → the docs it lists.
- **Architect / reviewer:** `PROGRESS.md` → newest HANDOFF → card → diff → 11 checklist.

## Workflow

```
 architect                           implementer                          architect
 ─────────                           ───────────                          ─────────
 card = ready  ──►  pick first ready card in PROGRESS (deps done)
                    set row in-progress, branch mobile/<ID>-<slug>
                    read card + listed docs (+ AGENTS.md for Expo APIs)
                    implement exactly the card
                    lint · typecheck · test · visual QA
                    append HANDOFF entry, row → review   ──►  review per 11
                                                               verdict in reviews/<ID>/review.md
                    ◄── changes-requested (fix only findings)  or  done → next cards ready
```

## Golden rules (short version)

1. One card at a time. Do exactly the card; anything else goes to "Questions for the architect".
2. Staff and patient code never import each other. Core imports neither.
3. Tokens only in memory / SecureStore. No PHI in prefs, logs or push text.
4. Every screen: loading, empty, error, no-results. Every action: pending state, no double submit.
5. Clinic instants in the location timezone; dose times in the phone timezone.
6. Permissions via `can()`, never roles.
7. Theme tokens only; logical direction classes only.
8. You don't run installs — list the command in the handoff.
9. Expo APIs: read the SDK 58 docs first (AGENTS.md).
10. Done = Definition of Done in 09 §1, nothing less.
