#!/usr/bin/env node
/**
 * M0-02 lint-fence check (docs/03 §7). Proves that the import fences actually
 * fail lint: it writes two temporary fixtures (one per forbidden direction),
 * runs ESLint on them, deletes them, and exits non-zero unless both were
 * rejected by the `no-restricted-imports` rule. The fixtures never stay on disk.
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
      (message) => message.ruleId === 'no-restricted-imports' && message.severity === 2
    );

    if (fenceErrors.length === 0) {
      failed = true;
      out(`FAIL ${fixture.label}: expected a no-restricted-imports error, none was reported.`);
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

out('lint:fences: both forbidden directions failed lint as expected.');
