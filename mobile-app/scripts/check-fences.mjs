#!/usr/bin/env node
/**
 * M0-02 lint-fence check (docs/03 §7). Proves that the import fences actually
 * fail lint: it writes temporary fixtures (each forbidden direction, plus the
 * `require()` / dynamic `import()` / relative deep-import loopholes, audit L15),
 * runs ESLint on them, deletes them, and exits non-zero unless all were
 * rejected by a fence rule (`no-restricted-imports` or the `no-restricted-syntax`
 * fence selectors). The fixtures never stay on disk.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const ROOT = process.cwd();

const FIXTURES = [
  {
    file: 'src/patient/__fence_fixture__.ts',
    source: "import '@/staff';\n",
    label: 'patient space importing @/staff',
  },
  {
    file: 'src/core/__fence_fixture__.ts',
    source: "import '@/patient';\n",
    label: 'core importing @/patient',
  },
  {
    file: 'src/app/__fence_fixture__.tsx',
    source: "import '@/staff';\n",
    label: 'root app route importing @/staff',
  },
  {
    file: 'src/staff/__fence_require_fixture__.ts',
    source: "require('@/patient');\n",
    label: 'staff require() of @/patient',
  },
  {
    file: 'src/patient/__fence_dynamic_fixture__.ts',
    source: "void import('@/staff/lib/api');\n",
    label: 'patient dynamic import() of @/staff',
  },
  {
    file: 'src/core/__fence_dynamic_fixture__.ts',
    source: "void import('@/shell/RootShell');\n",
    label: 'core dynamic import() of @/shell',
  },
  {
    file: 'src/staff/__fence_relative_fixture__.ts',
    source: "import '../patient/lib/api';\n",
    label: 'staff relative deep import of patient code',
  },
  {
    file: 'src/shell/__fence_relative_fixture__.ts',
    source: "import '../staff/lib/api';\n",
    label: 'shell relative deep import of staff code',
  },
  {
    file: 'src/shell/__fence_deep_fixture__.ts',
    source: "import '@/patient/lib/api';\n",
    label: 'shell alias deep import of patient code',
  },
  {
    file: 'src/shell/__fence_require_fixture__.ts',
    source: "require('../staff/lib/api');\n",
    label: 'shell require() of staff deep path',
  },
];

function out(line) {
  process.stdout.write(`${line}\n`);
}

const eslint = new ESLint({ cwd: ROOT });
const written = [];
let failed = false;

try {
  for (const fixture of FIXTURES) {
    const absolute = path.join(ROOT, fixture.file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, fixture.source, 'utf8');
    written.push(absolute);
  }

  for (const fixture of FIXTURES) {
    const absolute = path.join(ROOT, fixture.file);
    const [result] = await eslint.lintFiles([absolute]);
    const fenceErrors = result.messages.filter(
      (message) =>
        (message.ruleId === 'no-restricted-imports' || message.ruleId === 'no-restricted-syntax') &&
        message.severity === 2
    );

    if (fenceErrors.length === 0) {
      failed = true;
      out(`FAIL ${fixture.label}: expected a fence error (no-restricted-imports / no-restricted-syntax), none was reported.`);
      for (const message of result.messages) {
        out(`  ${message.ruleId ?? 'fatal'}: ${message.message}`);
      }
      continue;
    }

    for (const message of fenceErrors) {
      out(`PASS ${fixture.label}: ${message.message}`);
    }
  }
} finally {
  for (const absolute of written) rmSync(absolute, { force: true });
}

if (failed) {
  out('lint:fences: the import fences are not enforced.');
  process.exit(1);
}

out('lint:fences: all forbidden directions failed lint as expected.');
