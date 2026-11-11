# Progress board

> Status values: `blocked` (dependency or decision missing) · `spec` (card not expanded yet — architect) ·
> `ready` (implementer may start) · `in-progress` · `review` (handoff written) · `changes-requested` · `done`.
> Implementers change only their own row (`in-progress`, `review`). The architect sets `ready`,
> `changes-requested`, `done`.

**Current phase:** 0 — Foundations · **Next up:** M0-01 (and M0-08 in parallel) · Updated 2026-11-11

| ID | Title | Area | Size | Depends | Status | Branch | Implementer | Updated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0-01 | Split source into core/staff/shell | MOB | M | — | review | mobile/M0-01-folder-split | DeepSeek Flash | 2026-11-11 |
| M0-02 | Import fences (lint) | MOB | S | M0-01 | ready | | | |
| M0-03 | Storage layer | MOB | S | M0-01 | ready | | | |
| M0-04 | Spaces + welcome + two-level guards | MOB | M | M0-01..03 | ready | | | |
| M0-05 | Tokens, text scale, brand theming | MOB | M | M0-01 | ready | | | |
| M0-06 | Mobile test runner | MOB | S | M0-01 | ready | | | |
| M0-07 | app.config.ts, EAS, updates | MOB | M | M0-04 | ready | | | |
| M0-08 | Staff `aud` + min-version | BE | S | — | ready | | | |
| M0-09 | Patient fence skeleton | BE | M | M0-08 | ready | | | |
| M1-01 | Core component kit | MOB | L | M0-05 | ready | | | |
| M1-02 | Staff tabs, More, location switch | MOB | M | M1-01, M0-04 | ready | | | |
| M1-03 | Staff realtime client | MOB | M | M1-02 | ready | | | |
| M1-04 | Devices + Expo push provider | BE | M | M0-08 | ready | | | |
| M1-05 | Push registration + tap routing | MOB | M | M1-04, M0-07 | ready | | | |
| M1-06 | Offline cache + idempotent mutations | MOB | M | M0-03, M1-02 | ready | | | |
| M1-07 | Queue data layer | MOB | M | M1-03, M1-06 | ready | | | |
| M1-08 | Doctor queue screen | MOB | L | M1-07 | ready | | | |
| M1-09 | Reception board + walk-in | MOB | L | M1-07, M1-01 | ready | | | |
| M1-10 | Arrivals + close session | MOB | M | M1-08, M1-09 | ready | | | |
| M1-11 | Patients list + quick register | MOB | M | M1-01, M1-06 | ready | | | |
| M1-12 | Patient summary | MOB | M | M1-11 | ready | | | |
| M1-13 | Notifications inbox + bell | MOB | S | M1-03 | ready | | | |
| M1-14 | Schedule tab | MOB | M | M1-07 | ready | | | |
| M1-15 | Today snapshot | MOB | M | M1-07, M1-14 | ready | | | |
| M1-16 | Staff hardening pass | MOB | M | M1-08..15 | ready | | | |
| M1-17 | Staff Google sign-in (optional) | MOB+BE | M | M1-02 | spec | | | |
| M2-01 … M2-16 | Patient core | — | — | see 10 | spec | | | |
| M3-01 … M3-09 | Patient hook | — | — | see 10 | spec | | | |
| M4-01 … M4-06 | Release | — | — | see 10 | spec | | | |

## Gates

| Gate | When | Status |
| --- | --- | --- |
| A — staff pilot starts | after M1-16 | not reached |
| B — patient pilot starts | after M4 | not reached |
