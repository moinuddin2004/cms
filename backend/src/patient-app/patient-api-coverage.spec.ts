import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Controller, Get } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RATE_LIMIT_KEY, RateLimit } from 'src/auth/guards/rate-limiter.guard';
import {
  IS_PATIENT_API,
  IS_PATIENT_AUTH,
  PatientApi,
  PatientAuthRoute,
} from './decorators/patient-api.decorator';

/**
 * Security coverage for the patient fence (docs 03 §7, 09 §3):
 *
 * 1. every handler under `src/patient-app/**` carries `@PatientApi()`;
 * 2. every handler under `src/patient-auth/**` carries `@PatientAuthRoute()`
 *    and a `@RateLimit(...)`;
 * 3. no handler elsewhere carries either patient marker;
 * 4. no handler elsewhere uses the `patient-api` / `patient-auth` path prefix.
 *
 * The four rules are also exercised against fixture controllers below, so the
 * spec is not vacuous while the first real patient routes arrive (M2-03).
 */
const SRC = join(__dirname, '..');

interface HandlerInfo {
  id: string;
  /** Path below `src/`, POSIX separators. */
  file: string;
  route: string;
  isPatientApi: boolean;
  isPatientAuth: boolean;
  hasRateLimit: boolean;
}

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

function inspect(controller: object, file: string): HandlerInfo[] {
  const ctrlPath = Reflect.getMetadata(PATH_METADATA, controller) as
    | string
    | string[]
    | undefined;
  if (ctrlPath === undefined) return [];

  const base = [ctrlPath].flat()[0] ?? '';
  const proto = (controller as { prototype: object }).prototype;
  const out: HandlerInfo[] = [];
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const fn = (proto as Record<string, unknown>)[name];
    if (typeof fn !== 'function') continue;
    if (Reflect.getMetadata(METHOD_METADATA, fn) === undefined) continue;

    const path = (Reflect.getMetadata(PATH_METADATA, fn) as string) ?? '';
    const route = `/${base}/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
    out.push({
      id: `${(controller as { name?: string }).name ?? 'Controller'}.${name}`,
      file,
      route: route || '/',
      isPatientApi:
        Reflect.getMetadata(IS_PATIENT_API, fn) !== undefined ||
        Reflect.getMetadata(IS_PATIENT_API, controller) !== undefined,
      isPatientAuth:
        Reflect.getMetadata(IS_PATIENT_AUTH, fn) !== undefined ||
        Reflect.getMetadata(IS_PATIENT_AUTH, controller) !== undefined,
      hasRateLimit: Reflect.getMetadata(RATE_LIMIT_KEY, fn) !== undefined,
    });
  }
  return out;
}

function discover(): HandlerInfo[] {
  const out: HandlerInfo[] = [];
  for (const filePath of controllerFiles(SRC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(filePath) as Record<string, unknown>;
    const file = filePath.slice(SRC.length + 1).replace(/\\/g, '/');
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      out.push(...inspect(exported, file));
    }
  }
  return out;
}

const under = (file: string, dir: string): boolean =>
  file === dir || file.startsWith(`${dir}/`);

function violations(handlers: HandlerInfo[]): string[] {
  const out: string[] = [];
  for (const h of handlers) {
    const inPatientApp = under(h.file, 'patient-app');
    const inPatientAuth = under(h.file, 'patient-auth');

    if (inPatientApp && !h.isPatientApi)
      out.push(`${h.id} (${h.file}): missing @PatientApi()`);
    if (inPatientAuth && !h.isPatientAuth)
      out.push(`${h.id} (${h.file}): missing @PatientAuthRoute()`);
    if (inPatientAuth && !h.hasRateLimit)
      out.push(`${h.id} (${h.file}): missing @RateLimit()`);
    if (!inPatientApp && !inPatientAuth && (h.isPatientApi || h.isPatientAuth))
      out.push(
        `${h.id} (${h.file}): patient-only decorator outside patient modules`,
      );

    const outside =
      h.route === '/patient-api' ||
      h.route.startsWith('/patient-api/') ||
      h.route === '/patient-auth' ||
      h.route.startsWith('/patient-auth/');
    if (!inPatientApp && !inPatientAuth && outside)
      out.push(
        `${h.id} (${h.file}): patient path prefix outside patient modules`,
      );
  }
  return out;
}

// ── Fixtures: prove the four rules actually detect violations ─────────────

@PatientApi()
@Controller('patient-api/fixture')
class FencedPatientFixture {
  @Get()
  read(): void {}
}

@Controller('patient-api/fixture')
class UnfencedPatientFixture {
  @Get()
  read(): void {}
}

@PatientAuthRoute()
@Controller('patient-auth/fixture')
class RateLimitedAuthFixture {
  @Get()
  @RateLimit({ maxAttempts: 1, windowSeconds: 60 })
  start(): void {}
}

@PatientAuthRoute()
@Controller('patient-auth/fixture')
class UnlimitedAuthFixture {
  @Get()
  start(): void {}
}

@Controller('patient-auth/fixture')
class UnfencedAuthFixture {
  @Get()
  start(): void {}
}

@PatientApi()
@Controller('fixture')
class MisplacedPatientFixture {
  @Get()
  read(): void {}
}

@Controller('patient-api/leaked')
class LeakedPathFixture {
  @Get()
  read(): void {}
}

describe('patient-api coverage', () => {
  const all = discover();

  it('finds the controllers', () => {
    expect(all.length).toBeGreaterThan(300);
  });

  it('every patient handler is decorated and fenced correctly', () => {
    expect(violations(all)).toEqual([]);
  });

  it('the rule engine accepts a correctly fenced handler', () => {
    expect(
      violations(
        inspect(FencedPatientFixture, 'patient-app/fixture.controller.ts'),
      ),
    ).toEqual([]);
    expect(
      violations(
        inspect(RateLimitedAuthFixture, 'patient-auth/fixture.controller.ts'),
      ),
    ).toEqual([]);
  });

  it('the rule engine catches each kind of violation', () => {
    const found = [
      ...inspect(UnfencedPatientFixture, 'patient-app/fixture.controller.ts'),
      ...inspect(UnlimitedAuthFixture, 'patient-auth/fixture.controller.ts'),
      ...inspect(UnfencedAuthFixture, 'patient-auth/fixture.controller.ts'),
      ...inspect(MisplacedPatientFixture, 'patients/fixture.controller.ts'),
      ...inspect(LeakedPathFixture, 'patients/fixture.controller.ts'),
    ].map((h) => violations([h]).join('\n'));

    expect(found.join('\n')).toContain('missing @PatientApi()');
    expect(found.join('\n')).toContain('missing @PatientAuthRoute()');
    expect(found.join('\n')).toContain('missing @RateLimit()');
    expect(found.join('\n')).toContain('patient-only decorator outside');
    expect(found.join('\n')).toContain('patient path prefix outside');
  });
});
