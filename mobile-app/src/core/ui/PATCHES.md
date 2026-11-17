# Patches to generated React Native Reusables components

`src/core/ui/*` comes from the RNR CLI. Hand edits are allowed only when they are listed here, so a
re-generation (`npx @react-native-reusables/cli add …`) can re-apply them. After re-generating a file,
re-apply every patch for it and run `npx jest --runInBand src/core`.

| File | Patch | Why | Card |
| --- | --- | --- | --- |
| `text.tsx` | `Text` reads `useUrduFont()` and, inside the patient `UrduFontScope` with locale `ur`, sets the Noto Nastaliq family (bold for `font-semibold`+) and adds `URDU_LEADING_CLASS` | Urdu needs Nastaliq + taller lines on every patient text (O-06) | M4-01 |
| `text.tsx` | `h2` variant: removed RNR's `border-border border-b pb-2` | The web page title has no rule under it; every caller had to add `border-0 pb-0` | UI-01 |
| `button.tsx` | Sizes: `default` `h-10 sm:h-9` → `h-11`; `lg` `h-11 sm:h-10` → `h-12`; `icon` `h-10 w-10 sm:h-9 sm:w-9` → `h-11 w-11` | 44 pt minimum touch target (docs/05 §8); `sm` (36 pt) stays for dense rows that add `min-h-11` | UI-01 |
