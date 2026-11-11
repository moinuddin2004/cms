import { applyBrand } from '@/core/theme/apply-brand';

import { readCachedTheme } from './theme-cache';

/**
 * Paint the cached clinic brand straight away — before any query runs — so a
 * cold start shows the clinic's colour immediately (docs/02 §10). Called from
 * `StaffLayout` on mount; `applyBrand(null)` is the reverse when the staff
 * space unmounts.
 */
export function applyCachedBrand(): void {
  applyBrand(readCachedTheme()?.brandColor ?? null);
}
