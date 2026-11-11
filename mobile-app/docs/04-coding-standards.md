# 04 — Coding standards (mobile)

> Every rule here is checked in review ([11-review-protocol.md](11-review-protocol.md)).
> Backend work follows the root [`../../CLAUDE.md`](../../CLAUDE.md) plus [03-security.md](03-security.md) §3.
> When an Expo / React Native API is involved, first read `AGENTS.md` and the **SDK 58** docs —
> do not code Expo APIs from memory.

## 1. TypeScript

- `strict` is on. No `any` (use `unknown` + narrowing). No `@ts-ignore`; `@ts-expect-error` only
  with a comment saying why and a link to an issue/doc.
- No non-null `!` on API data. Model optional fields as optional and handle them.
- Types for API payloads live in `types/<feature>.types.ts` and mirror the backend DTO names
  (camelCase). Do not invent fields; copy them from [07-backend-contracts.md](07-backend-contracts.md).
- Enums from the backend are string-literal unions, e.g.
  `type EntryStatus = 'waiting' | 'called' | …` — never TS `enum`.
- Prefer `type` for unions/props, `interface` for object shapes that are extended.
- Exhaustive `switch` on unions with a `const _never: never = x` default.

## 2. Files and naming

| Thing | Convention | Example |
| --- | --- | --- |
| React component / page | PascalCase `.tsx`, one exported component per file | `QueueEntryRow.tsx` |
| Page | `<Name>Page.tsx` in `pages/` | `DoctorQueuePage.tsx` |
| Hook | `use<Thing>.ts` | `useMySession.ts` |
| API module | `<feature>.api.ts` | `queue.api.ts` |
| Query key factory | `<feature>.keys.ts` | `queue.keys.ts` |
| Schema | `<feature>.schema.ts` | `walk-in.schema.ts` |
| Types | `<feature>.types.ts` | `queue.types.ts` |
| Pure logic | kebab-case `.ts` in `lib/` | `reminder-planner.ts` |
| Test | next to the file, `.test.ts(x)` | `reminder-planner.test.ts` |
| Zustand store | `use<Name>Store.ts` | `useQueueUiStore.ts` |
| Route file | Expo Router conventions | `(tabs)/queue.tsx`, `patients/[patientId].tsx` |

Feature anatomy (create only the folders you need):

```
<space>/features/<feature>/
├── index.ts              # public barrel: pages, hooks other features may use, types
├── pages/                # screen-level components (one per route)
├── components/           # feature-private components
├── hooks/                # queries, mutations, forms, UI stores
├── api/                  # <feature>.api.ts + <feature>.keys.ts
├── schemas/              # zod
├── types/
└── lib/                  # pure functions (+ tests)
```

## 3. Route files

A route file has **zero logic**: import one page from a space/shell barrel and render it.
Screen options that are static (title, presentation) may be set with `<Stack.Screen options>`
**inside the page**, not in the route file.

```tsx
// src/app/(staff)/(tabs)/queue.tsx
import { QueueTabPage } from '@/staff/features/queue';

export default function QueueRoute() {
  return <QueueTabPage />;
}
```

Route params are read in the page with `useLocalSearchParams<{ patientId: string }>()` and
validated (uuid) before use; invalid → `ErrorState` "Not found".

## 4. Components

- Function components only. Props interface named `<Component>Props`, declared above the component.
- Keep a component under ~150 lines; extract subcomponents into the same feature's `components/`.
- No inline `style={{…}}` when a class exists. Allowed only for values computed at runtime
  (animated styles, measured heights) and navigator chrome options (`tabBarStyle`, header styles) fed from tokens. No hex colours anywhere — tokens only (see [05](05-ui-ux-design-system.md)).
- Use logical spacing classes: `ms-/me-/ps-/pe-/start-/end-` (A-13). `ml-/mr-/pl-/pr-/left-/right-` are forbidden.
- Text always inside `<Text>` from `@/core/ui/text` (never raw RN `Text` in feature code).
- Pressables: `Button` from `@/core/ui/button`, or `IconButton` from `@/core/components` (requires
  `accessibilityLabel`). Minimum touch target 44×44 (`min-h-11 min-w-11`).
- Images: `expo-image` only.
- Lists longer than ~20 items or unbounded: `FlashList` (v2) from `@shopify/flash-list`. Short static
  lists may map inside a `ScrollView`.
- Every screen uses `Screen` (core layout) so safe-area, background, offline banner and keyboard
  handling are consistent.
- React Compiler is on: do **not** add `useMemo`/`useCallback`/`memo` for performance unless a
  measured problem exists. Do write components the compiler can optimise (no mutation of props/state).

## 5. State

| Kind | Tool | Rule |
| --- | --- | --- |
| Server data | TanStack Query | Never copy query data into Zustand or `useState` |
| Session / auth | space auth store | Only `api`/`session` modules write it |
| Screen UI state shared across components (sheet open, selected entry, filters) | small feature Zustand store | One store per feature, reset on unmount when screen-local |
| Local component state | `useState` | Fine for a single component |
| Form state | TanStack Form | Never mirror into `useState` |

Zustand selectors must select the smallest slice: `useStaffAuthStore((s) => s.activeLocationId)`,
not the whole store.

## 6. API modules

```ts
// src/staff/features/queue/api/queue.api.ts
import { staffApi } from '@/staff/lib/api';
import type { ApiResponse } from '@/core/types';
import type { SessionSnapshot } from '../types/queue.types';

export async function fetchMySession(): Promise<SessionSnapshot> {
  const res = await staffApi.get<ApiResponse<SessionSnapshot>>('/queue/my-session');
  return res.data.data;
}
```

- Only `api/*.api.ts` files import the space's axios client. Components and hooks never do.
- One function per endpoint, named `fetchX` (GET), `createX`, `updateX`, `<verb>X` for actions
  (`callNext`, `completeEntry`). Return the unwrapped `T`.
- Paths are string literals copied from the contracts doc. No string building from user input
  except `encodeURIComponent`-ed path params.

## 7. Queries

```ts
// queue.keys.ts
export const queueKeys = {
  all: ['queue'] as const,
  mySession: (locationId: string, ymd: string) => ['queue', 'my-session', locationId, ymd] as const,
  board: (locationId: string, ymd: string) => ['queue', 'board', locationId, ymd] as const,
};

// hooks/useMySession.ts
export function useMySession() {
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const ymd = todayYmd();
  return useQuery({
    queryKey: queueKeys.mySession(locationId ?? '', ymd),
    queryFn: fetchMySession,
    enabled: !!locationId,
    staleTime: 0,
  });
}
```

- Keys always start with the feature name and include every variable the server result depends on
  (org/location for staff, profileId for patient).
- `enabled` guards missing inputs. No `queryFn` that silently returns `[]` for missing input.
- Pagination lists use `useInfiniteQuery` with `getNextPageParam` from `page < totalPages`
  (or `page * limit < total` where `totalPages` is absent — appointments).

## 8. Mutations

- Wrap in a hook `use<Action>()` returning `useMutation(...)`.
- `onSuccess`: invalidate exact keys; show a success toast only when the result is not visible on
  screen already.
- `onError`: toast `apiErrorMessage(err, '<fallback>')`, or map known `error.code`s to friendly copy
  (queue codes table in [07](07-backend-contracts.md#23-queue)).
- **Idempotency** (queue and any endpoint marked Idem): use `useIdempotentMutation` from
  `@/core/http`. It creates the `Idempotency-Key` (`expo-crypto` `randomUUID()`) when the user taps,
  keeps it for automatic retries of that same tap (network error or `503 LOCK_TIMEOUT`: up to 3
  tries, 250 ms × attempt + jitter), and drops it on success or a 4xx. A new tap = a new key.
- `If-Match: <entry.version>` is sent for entry actions; on `409 VERSION_CONFLICT` refetch and show
  "This patient's status changed. Please check and try again."
- Buttons show a loading state while `isPending` and are disabled; the whole row is disabled while
  any action on that row is pending.

## 9. Forms

- TanStack Form + Zod 4 only (react-hook-form is banned). Schema in `schemas/`, form hook in
  `hooks/use<Name>Form.ts`, wired as `validators: { onChange: schema, onSubmit: schema }`.
- Errors via `fieldError(field)` into `FieldWrapper`. Submit disabled on `!canSubmit || isSubmitting`.
- Forms open in a **bottom sheet** (`FormSheet` core component) or a modal route
  (`presentation: 'formSheet'`) — never a full page, except multi-step flows (claim, sign-in).
- Inputs set the right `keyboardType`, `autoComplete`, `textContentType`, `returnKeyType`, and
  `onSubmitEditing` moves to the next field.
- Dirty form + close gesture → confirm "Discard changes?".

## 10. Dates, times, money

- Staff space: `@/staff/lib/datetime` (`formatDate`, `formatTime`, `formatDateTime`, `todayYmd`,
  `clinicDayBounds`, `clinicDateTimeToUtc`) — these bind the active location's timezone.
- Patient space: `@/core/datetime` with an explicit zone: `formatInZone(value, record.timezone, pattern)`.
  Every patient-api record that has an instant also carries its location `timezone`.
- Dose reminder times: wall-clock `HH:mm` in the phone's timezone (A-10) — use
  `@/patient/features/reminders/lib/*` helpers only.
- Forbidden: `new Date(x).toLocale*String()`, `format(new Date(x), …)` without a zone,
  `toISOString().slice(0, 10)` as "today", manual offset math.
- Money: `formatMoney(amount, currency)` from `@/core/money`. Check the contract for whether a field
  is minor units (`*Minor`) or a decimal amount and convert with the helper that matches.

## 11. Permissions

- `const { can } = useAccess()`; `can('queue.checkin')`. Never compare role names or `isOwner` for
  feature gating (owner already has every permission).
- Hide what the user cannot do; do not show disabled-for-permission buttons (disabled is for
  pending/offline state only).
- Permission keys are typed (`PermissionKey`) from the generated catalog; never hand-edit it.

## 12. Strings and i18n

- Staff space: inline English strings, sentence case, short.
- Patient space: every user-visible string through `t('feature.key')` from `react-i18next`; keys in
  `src/patient/i18n/en.json` (and `ur.json`). Interpolation with `{{name}}`. Plurals with i18next
  plural keys. Never concatenate translated fragments.
- Core components never call `t()` — they receive strings via props.
- Copy rules: [05 §9](05-ui-ux-design-system.md#9-writing-ux-copy).

## 13. Errors and logging

- Every query screen renders loading / error (with retry) / empty / filtered-empty states.
- Unexpected render errors: each space layout has an error boundary (`SpaceErrorBoundary`) that shows
  `ErrorState` with "Reload".
- `log` from `@/core/log` only. No `console.*` in committed code (lint rule). Never log payloads.

## 14. Accessibility

- Every icon-only control has `accessibilityLabel` (and `accessibilityHint` if the action is not obvious).
- `accessibilityRole` on custom pressables; `accessibilityState={{ disabled, selected, busy }}`.
- Respect font scaling: no fixed heights on text containers; test at 1.3× font size.
- Colour is never the only signal (status badges have text).

## 15. Imports

- Alias `@/` only (no `../../..` across folders; `./` within a feature folder is fine).
- Order: react/react-native, third-party, `@/core`, `@/<space>`, relative. Type-only imports use
  `import type`.
- Cross-feature: through the barrel. Cross-space: never (§ fences in [02 §1](02-architecture.md#import-fences-lint-enforced-in-m0-02)).

## 16. Comments

- Comment *why*, not *what*. A file-level doc comment on every hook/lib module explaining its job
  in one or two sentences (see existing `src/lib/api.ts` style).
- `TODO(<TASK-ID>): …` only with a task id that exists in the roadmap.

## 17. Tests

- jest-expo + @testing-library/react-native. Pure logic in `lib/` must have unit tests (planners,
  parsers, guards, palette maths, key factories when non-trivial).
- Components with branching state (queue row actions by status) get a render test per branch.
- Mock the space's api module (`jest.mock('../api/queue.api')`), never axios internals.
- Commands before handoff: `npm run lint`, `npm run typecheck`, `npm test`. All green.

## 18. Git

- **`master` is off-limits.** All mobile work integrates on **`mobile/develop`** (created from `master`, pushed to GitHub).
  Nothing from this programme is merged into `master` until the user says so.
- Branch `mobile/<TASK-ID>-<short-slug>` **from `mobile/develop`** (pull it first). Never branch from, commit to, or merge into `master`.
- After the architect's `done`, the task branch is merged into `mobile/develop` (`--no-ff`) — by the architect or the user, never by the implementer.
- Commit message: `feat(mobile): <TASK-ID> <summary>` / `fix(mobile): …` / `feat(backend): <TASK-ID> …`.
  Body lists notable decisions. End with the attribution line your tool requires.
- Do not commit unrelated changes, generated `.expo/`, `ios/`, `android/` folders, or secrets.
- Never push or merge unless the user tells you to.

## 19. Things that are never allowed

- react-hook-form; inline hex colours; `ml-/mr-` classes; `console.*`; `any`.
- Importing across spaces, or `eslint-disable` of fence rules.
- Axios calls outside `api/`; tokens anywhere but memory/SecureStore.
- Editing `src/core/ui/*` by hand (regenerate with the RNR CLI; only documented patches allowed).
- Creating `ios/` or `android/` folders by hand.
- Running package installs yourself — write the command in the handoff.
- Adding a dependency that is not in [01 §5](01-overview.md#5-tech-stack-fixed--do-not-add-alternatives)
  without the architect's approval.
