import { Uniwind } from 'uniwind';

/**
 * The staff / patient text scale (docs/05 §3, docs/10 M0-05 step 6).
 *
 * `core/ui/text.tsx` sizes itself with Tailwind `text-*` classes, and Uniwind
 * resolves those classes through the `--text-*` theme variables at runtime
 * (verified by the M0-05 spike: the compiled bundle reads
 * `vars["--text-sm"]`, `vars["--text-4xl"]`, …). Overriding the variables here
 * is therefore enough — no generated component needs patching.
 *
 * The two spaces are never mounted together, so one global scale is applied on
 * space mount (`StaffLayout` → `staff`, `PatientLayout` → `patient`) and reset
 * to the staff scale when the space unmounts, keeping the welcome screen on
 * the platform sizes.
 */
export type TextScale = 'staff' | 'patient';

/**
 * The `text-*` variables used by the variants of `core/ui/text.tsx`, mapped to
 * the sizes in docs/05 §3:
 *
 * | variant       | class       | staff | patient |
 * | ------------- | ----------- | ----- | ------- |
 * | `h1`          | `text-4xl`  | 28    | 30      |
 * | `h2`          | `text-3xl`  | 22    | 24      |
 * | `h3`          | `text-2xl`  | 18    | 20      |
 * | `large`       | `text-lg`   | 17    | 18      |
 * | default / `p` | `text-base` | 15    | 17      |
 * | `small`/`muted` | `text-sm` | 13    | 15      |
 */
export type TextSizeVariable =
  | '--text-4xl'
  | '--text-3xl'
  | '--text-2xl'
  | '--text-lg'
  | '--text-base'
  | '--text-sm';

/** Font sizes in px, keyed by the CSS variable the variant uses. */
export const TEXT_SCALE_SIZES: Record<TextScale, Record<TextSizeVariable, number>> = {
  staff: {
    '--text-4xl': 28,
    '--text-3xl': 22,
    '--text-2xl': 18,
    '--text-lg': 17,
    '--text-base': 15,
    '--text-sm': 13,
  },
  patient: {
    '--text-4xl': 30,
    '--text-3xl': 24,
    '--text-2xl': 20,
    '--text-lg': 18,
    '--text-base': 17,
    '--text-sm': 15,
  },
};

/**
 * Apply a text scale to both colour schemes. The sizes are the same in light
 * and dark; writing both themes keeps a light/dark switch from restoring the
 * platform sizes.
 */
export function applyTextScale(scale: TextScale): void {
  const vars = TEXT_SCALE_SIZES[scale];
  Uniwind.updateCSSVariables('light', vars);
  Uniwind.updateCSSVariables('dark', vars);
}
