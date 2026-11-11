import { applyBrand } from '@/core/theme/apply-brand';
import { applyThemeMode } from '@/core/theme/apply-theme-mode';

import { readCachedTheme } from './theme-cache';

/**
 * Paint the cached clinic brand and light/dark mode straight away — before any query runs — so a
 * cold start shows the clinic's colour immediately (docs/02 §10). Called from
 * `StaffLayout` on mount; `applyBrand(null)` is the reverse when the staff
 * space unmounts.
 */
export function applyCachedBrand(): void {
  const cached = readCachedTheme();
  applyBrand(cached?.brandColor ?? null);
  applyThemeMode(cached?.defaultMode);
}
