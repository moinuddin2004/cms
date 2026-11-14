# Review M1-14a
Date: 2026-11-15 · Reviewer: architect (Claude Opus) + independent reviewer agent · Verdict: **done** (after rework #1)
Commits: 4a02d19 + e7dcc97 · Commands re-run by the architect: tsc ✓ · jest 357 ✓ · ESLint 0 errors

Reviewer agent: approve (types, params, paging, day bounds, keys, persist rule all verified against the backend). Small rework done: `fetchAllDayBookings` dedupes by id, `MAX_DAY_PAGES` with a `log.warn` at the cap, `fetchAppointmentsRange` + `useUpcomingAppointments` (now → end of clinic day). M1-14 check-in must invalidate `appointmentKeys.all` (arrivals key sits outside `list`).
