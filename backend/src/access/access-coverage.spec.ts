import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ANY_MEMBER_KEY, CAN_KEY } from './decorators/access.decorators';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { REQUIRE_SUPER_ADMIN_KEY } from 'src/common/decorators/require-super-admin.decorator';
import { CONTEXT_FREE_KEY } from 'src/common/decorators/context-free.decorator';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/roles.decorator';

/**
 * Every HTTP handler must say who may call it. Accepted markers: `@Can`,
 * `@AnyMember`, `@Public`, `@RequireSuperAdmin`, `@ContextFree` (the
 * handler checks access itself, e.g. locations / user admin / `/me/access`)
 * or an explicit `@UseGuards(...)` (lab portal, magic links, JWT-only self
 * endpoints). Controllers under these path prefixes are authentication
 * flows, not clinic data, and are exempt.
 */
const EXEMPT_PATH_PREFIXES = ['auth', 'session', 'health'];

/** `GET /` hello / liveness probe. */
const EXEMPT_HANDLERS = ['AppController.getHello'];

const MARKERS = [
  CAN_KEY,
  ANY_MEMBER_KEY,
  IS_PUBLIC_KEY,
  REQUIRE_SUPER_ADMIN_KEY,
  CONTEXT_FREE_KEY,
  GUARDS_METADATA,
];

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

const has = (key: string, ...targets: object[]) =>
  targets.some((t) => Reflect.getMetadata(key, t) !== undefined);

interface Handler {
  route: string;
  marked: boolean;
  usesRoles: boolean;
}

function handlers(): Handler[] {
  const out: Handler[] = [];
  for (const file of controllerFiles(join(__dirname, '..'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const ctrlPath = Reflect.getMetadata(PATH_METADATA, exported) as
        | string
        | string[]
        | undefined;
      if (ctrlPath === undefined) continue;
      const base = [ctrlPath].flat()[0] ?? '';
      if (
        EXEMPT_PATH_PREFIXES.some((p) => base.replace(/^\//, '').startsWith(p))
      )
        continue;
      const proto = (exported as { prototype: object }).prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        const fn = (proto as Record<string, unknown>)[name];
        if (typeof fn !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, fn) === undefined) continue;
        if (EXEMPT_HANDLERS.includes(`${exported.name}.${name}`)) continue;
        const path = Reflect.getMetadata(PATH_METADATA, fn) as string;
        out.push({
          route: `${exported.name}.${name} (${base}/${path})`,
          marked: MARKERS.some((k) => has(k, fn, exported)),
          usesRoles: has(REQUIRED_ROLES_KEY, fn, exported),
        });
      }
    }
  }
  return out;
}

describe('access coverage', () => {
  const all = handlers();

  it('finds the controllers', () => {
    expect(all.length).toBeGreaterThan(300);
  });

  it('every handler declares who may call it', () => {
    expect(all.filter((h) => !h.marked).map((h) => h.route)).toEqual([]);
  });

  it('no handler still uses the removed @Roles()', () => {
    expect(all.filter((h) => h.usesRoles).map((h) => h.route)).toEqual([]);
  });
});
