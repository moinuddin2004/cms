// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Import fences from docs/02 §1 and docs/03 §2.2. A space may import only
 * itself and `@/core`; `@/shell` is the one place that sees both spaces, and
 * only through their barrel files. These rules are never suppressed.
 */
function importFence(group, message) {
  return ['error', { patterns: [{ group, message }] }];
}

const CORE_FENCE = importFence(
  [
    '@/staff',
    '@/staff/*',
    '@/patient',
    '@/patient/*',
    '@/shell',
    '@/shell/*',
    '**/staff/**',
    '**/patient/**',
    '**/shell/**',
  ],
  'core code may not import a space or the shell (docs/02 §1)'
);

const STAFF_FENCE = importFence(
  ['@/patient*', '@/shell*', '**/patient/**'],
  'staff space may not import patient or shell code (docs/02 §1)'
);

const PATIENT_FENCE = importFence(
  ['@/staff*', '@/shell*', '**/staff/**'],
  'patient space may not import staff or shell code (docs/02 §1)'
);

const SHELL_FENCE = importFence(
  ['@/staff/*', '@/patient/*'],
  'shell may import a space only through its barrel: @/staff or @/patient (docs/02 §1)'
);

const APP_STAFF_FENCE = importFence(
  ['@/patient', '@/patient/**', '@/shell', '@/shell/**'],
  'staff routes may not import patient code or the shell (docs/02 §1)'
);

const APP_PATIENT_FENCE = importFence(
  ['@/staff', '@/staff/**', '@/shell', '@/shell/**'],
  'patient routes may not import staff code or the shell (docs/02 §1)'
);

/**
 * Root `src/app/*` route files only compose: they may use the shell and core,
 * never a space (docs/02 §1, fence row "src/app/ root files").
 */
const APP_ROOT_FENCE = importFence(
  ['@/staff', '@/staff/**', '@/patient', '@/patient/**'],
  'root app routes may import only @/shell and @/core (docs/02 §1)'
);

/**
 * Design-token hygiene (docs/04 §4, A-13): className string literals must not
 * use physical-direction classes or hard-coded hex colours.
 */
const NO_DIRECTIONAL_CLASSNAME = {
  selector: String.raw`JSXAttribute[name.name='className'] > Literal[value=/(^|\s)(ml|mr|pl|pr|left|right)-/]`,
  message:
    'Use logical direction classes (ms-/me-/ps-/pe-/start-/end-) instead of ml-/mr-/pl-/pr-/left-/right- (docs/04 §4, A-13).',
};

const NO_HEX_CLASSNAME = {
  selector: String.raw`JSXAttribute[name.name='className'] > Literal[value=/#[0-9a-fA-F]{3,8}\b/]`,
  message: 'Use theme tokens instead of hex colours in className (docs/04 §4).',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },

  // ---- import fences (docs/02 §1) ----
  {
    files: ['src/core/**'],
    rules: { 'no-restricted-imports': CORE_FENCE },
  },
  {
    files: ['src/staff/**'],
    rules: { 'no-restricted-imports': STAFF_FENCE },
  },
  {
    files: ['src/patient/**'],
    rules: { 'no-restricted-imports': PATIENT_FENCE },
  },
  {
    files: ['src/shell/**'],
    rules: { 'no-restricted-imports': SHELL_FENCE },
  },
  {
    files: ['src/app/(staff)/**'],
    rules: { 'no-restricted-imports': APP_STAFF_FENCE },
  },
  {
    files: ['src/app/(patient)/**', 'src/app/claim/**'],
    rules: { 'no-restricted-imports': APP_PATIENT_FENCE },
  },
  {
    files: ['src/app/*.tsx'],
    rules: { 'no-restricted-imports': APP_ROOT_FENCE },
  },

  // ---- logging (docs/03 §2.7, docs/04 §13) ----
  {
    rules: { 'no-console': 'error' },
  },
  {
    // The single logging sink is allowed to reach the console.
    files: ['src/core/log.ts'],
    rules: { 'no-console': 'off' },
  },

  // ---- design-token hygiene (docs/04 §4, A-13) ----
  {
    rules: {
      'no-restricted-syntax': ['error', NO_DIRECTIONAL_CLASSNAME, NO_HEX_CLASSNAME],
    },
  },
  {
    // Generated RNR components keep their upstream classes (task M0-02 step 4).
    files: ['src/core/ui/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
