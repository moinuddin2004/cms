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
  ['@/staff/*', '@/patient/*', '**/staff/*', '**/patient/*'],
  'shell may import a space only through its barrel: @/staff or @/patient (docs/02 §1)'
);

const APP_STAFF_FENCE = importFence(
  ['@/patient', '@/patient/**', '@/shell', '@/shell/**', '**/patient/**', '**/shell/**'],
  'staff routes may not import patient code or the shell (docs/02 §1)'
);

const APP_PATIENT_FENCE = importFence(
  ['@/staff', '@/staff/**', '@/shell', '@/shell/**', '**/staff/**', '**/shell/**'],
  'patient routes may not import staff code or the shell (docs/02 §1)'
);

/**
 * Root `src/app/*` route files only compose: they may use the shell and core,
 * never a space (docs/02 §1, fence row "src/app/ root files").
 */
const APP_ROOT_FENCE = importFence(
  ['@/staff', '@/staff/**', '@/patient', '@/patient/**', '**/staff/**', '**/patient/**'],
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

/**
 * `no-restricted-imports` only sees static `import` declarations. The same fences also apply to
 * `require('...')` and dynamic `import('...')` (audit L15). `\x2f` is a `/` (esquery regexes cannot
 * contain a literal slash). `names` are the folders the code may NOT load from.
 */
function bannedLoads(names, message) {
  const src = String.raw`^@\x2f(${names})(\x2f|$)|(^|\x2f)(${names})\x2f`;
  return [
    { selector: `CallExpression[callee.name='require'][arguments.0.value=/${src}/]`, message },
    { selector: `ImportExpression[source.value=/${src}/]`, message },
  ];
}

/** Class-name hygiene selectors plus the fence selectors of one space. */
const syntaxRules = (fence) => ['error', NO_DIRECTIONAL_CLASSNAME, NO_HEX_CLASSNAME, ...fence];

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
    files: ['src/app/(patient)/**', 'src/app/claim/**', 'src/app/c/**'],
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

  // ---- fences for require() / import() (audit L15); after the generic block so they win ----
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-syntax': syntaxRules(
        bannedLoads('staff|patient|shell', 'core code may not load a space or the shell (docs/02 §1)')
      ),
    },
  },
  {
    files: ['src/staff/**', 'src/app/(staff)/**'],
    rules: {
      'no-restricted-syntax': syntaxRules(
        bannedLoads('patient|shell', 'staff code may not load patient or shell code (docs/02 §1)')
      ),
    },
  },
  {
    files: ['src/patient/**', 'src/app/(patient)/**', 'src/app/claim/**', 'src/app/c/**'],
    rules: {
      'no-restricted-syntax': syntaxRules(
        bannedLoads('staff|shell', 'patient code may not load staff or shell code (docs/02 §1)')
      ),
    },
  },
  {
    files: ['src/shell/**'],
    rules: {
      'no-restricted-syntax': syntaxRules(
        // Only the barrels `@/staff` / `@/patient` are allowed: anything deeper is refused.
        bannedLoads('staff|patient', 'shell may load a space only through its barrel (docs/02 §1)')
      ),
    },
  },
  {
    files: ['src/app/*.tsx'],
    rules: {
      'no-restricted-syntax': syntaxRules(
        bannedLoads('staff|patient', 'root app routes may load only @/shell and @/core (docs/02 §1)')
      ),
    },
  },
  {
    // Generated RNR components keep their upstream classes (task M0-02 step 4).
    files: ['src/core/ui/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
