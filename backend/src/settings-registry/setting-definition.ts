import { isHexColor, isIn, isString, isURL, maxLength } from 'class-validator';
import { ConfigScope } from './entities/config-value.entity';

/**
 * A zod-shaped validator (`parse` returns the clean value or throws), built
 * on class-validator since the backend has no zod. Swapping in zod later
 * only touches the helpers below.
 */
export interface SettingSchema<T> {
  parse(value: unknown): T;
}

export class SettingValidationError extends Error {}

const fail = (message: string): never => {
  throw new SettingValidationError(message);
};

export const s = {
  string: (
    opts: { min?: number; max?: number } = {},
  ): SettingSchema<string> => ({
    parse(v) {
      if (!isString(v)) return fail('must be a string');
      const trimmed = v.trim();
      if (trimmed.length < (opts.min ?? 0)) {
        return fail(`must be at least ${opts.min} characters`);
      }
      if (opts.max && !maxLength(trimmed, opts.max)) {
        return fail(`must be at most ${opts.max} characters`);
      }
      return trimmed;
    },
  }),
  url: (): SettingSchema<string> => ({
    parse(v) {
      if (
        !isString(v) ||
        !maxLength(v, 1000) ||
        !isURL(v, { protocols: ['http', 'https'], require_protocol: true })
      ) {
        return fail('must be an http(s) URL');
      }
      return v;
    },
  }),
  hexColor: (): SettingSchema<string> => ({
    parse(v) {
      if (!isString(v) || !/^#[0-9a-f]{6}$/i.test(v) || !isHexColor(v)) {
        return fail('must be a #rrggbb colour');
      }
      return v.toLowerCase();
    },
  }),
  boolean: (): SettingSchema<boolean> => ({
    parse(v) {
      if (typeof v !== 'boolean') return fail('must be true or false');
      return v;
    },
  }),
  /** Lower-cased, de-duplicated domain names (`clinic.com`), max 20. */
  domainList: (): SettingSchema<string[]> => ({
    parse(v) {
      if (!Array.isArray(v)) return fail('must be a list of domains');
      const out = [
        ...new Set(
          v.map((d) => (isString(d) ? d.trim().toLowerCase() : '')),
        ),
      ].filter(Boolean);
      if (out.length > 20) return fail('at most 20 domains');
      for (const d of out) {
        if (!/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) {
          return fail(`"${d}" is not a domain name`);
        }
      }
      return out;
    },
  }),
  oneOf: <const T extends string>(values: readonly T[]): SettingSchema<T> => ({
    parse(v) {
      if (!isIn(v, values as unknown as unknown[])) {
        return fail(`must be one of: ${values.join(', ')}`);
      }
      return v as T;
    },
  }),
};

export interface SettingDefinition<T = unknown> {
  key: string;
  schema: SettingSchema<T>;
  /** Code default — the last step of the cascade. Null = no value. */
  default: T | null;
  /** Scopes below platform that may hold a value. Platform always may. */
  scopes: ConfigScope[];
  /** Whether a scope may lock the key for the scopes below it. */
  lockable: boolean;
}

const registry = new Map<string, SettingDefinition>();

/**
 * Register a setting in the code registry. Keys are unique; the cascade,
 * validation and lock rules in `SettingsRegistryService` read from here.
 */
export function defineSetting<T>(
  key: string,
  def: Omit<SettingDefinition<T>, 'key'>,
): SettingDefinition<T> {
  if (registry.has(key)) throw new Error(`Setting "${key}" defined twice`);
  const full = { key, ...def };
  registry.set(key, full as SettingDefinition);
  return full;
}

export function getSettingDefinition(
  key: string,
): SettingDefinition | undefined {
  return registry.get(key);
}

export function allSettingDefinitions(prefix = ''): SettingDefinition[] {
  return [...registry.values()].filter((d) => d.key.startsWith(prefix));
}

/** Whether a value may be stored at `scope` (platform always may). */
export function scopeAllowed(
  def: SettingDefinition,
  scope: ConfigScope,
): boolean {
  return scope === ConfigScope.PLATFORM || def.scopes.includes(scope);
}
