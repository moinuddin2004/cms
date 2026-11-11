import { getPref, setPref } from '@/core/storage/prefs';
import { isHexColor } from '@/core/theme/brand';

import type { ClinicTheme, ThemeDefaultMode } from '../types/theme.types';

/**
 * The last clinic theme, kept in plain prefs so the next cold start paints the
 * brand before the network answers (docs/02 §10). Allowed there because it is
 * only colours and a logo URL (docs/03 §2.6) — never anything about a patient
 * or the clinic's data.
 */
const CACHE_KEY = 'staff.theme.cache';

const DEFAULT_MODES: readonly ThemeDefaultMode[] = ['light', 'dark', 'system'];

export interface CachedClinicTheme {
  /** The clinic the rest of the entry belongs to — a cache for another org is ignored. */
  orgId: string;
  brandColor: string;
  logoUrl: string | null;
  defaultMode: ThemeDefaultMode;
}

function isDefaultMode(value: unknown): value is ThemeDefaultMode {
  return typeof value === 'string' && (DEFAULT_MODES as readonly string[]).includes(value);
}

/**
 * Read the cached theme. Prefs are unvalidated storage, so every field is
 * checked: junk (or an older shape) reads as "no cache" and the platform
 * palette shows until the API answers.
 */
export function readCachedTheme(): CachedClinicTheme | null {
  const raw = getPref(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { orgId, brandColor, logoUrl, defaultMode } = parsed as Record<string, unknown>;
    if (typeof orgId !== 'string' || !orgId) return null;
    if (typeof brandColor !== 'string' || !isHexColor(brandColor)) return null;
    if (logoUrl !== null && typeof logoUrl !== 'string') return null;
    if (!isDefaultMode(defaultMode)) return null;
    return { orgId, brandColor, logoUrl, defaultMode };
  } catch {
    return null;
  }
}

/** Store the parts of the theme the app uses at start, then return them. */
export function cacheClinicTheme(orgId: string, theme: ClinicTheme): CachedClinicTheme {
  const cached: CachedClinicTheme = {
    orgId,
    brandColor: theme.brand_color,
    logoUrl: theme.logo_url,
    defaultMode: theme.default_mode,
  };
  setPref(CACHE_KEY, JSON.stringify(cached));
  return cached;
}
