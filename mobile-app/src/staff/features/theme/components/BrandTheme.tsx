import { useEffect } from 'react';

import { applyBrand } from '@/core/theme/apply-brand';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { useClinicTheme } from '../hooks/useClinicTheme';
import { cacheClinicTheme } from '../lib/theme-cache';

/**
 * Applies the active clinic's brand colour and caches it for the next cold
 * start (docs/02 §10, docs/10 M0-05 step 4). Renders nothing; mounted inside
 * `StaffMainLayout`, i.e. only behind sign-in and a chosen clinic, so no
 * theme request runs while the staff space is inactive.
 *
 * On error or while loading the cached brand from `StaffLayout` stays in
 * place — a failed theme fetch must never repaint the app grey.
 */
export function BrandTheme() {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const { data } = useClinicTheme();

  useEffect(() => {
    if (!orgId || !data) return;
    const cached = cacheClinicTheme(orgId, data);
    applyBrand(cached.brandColor);
  }, [orgId, data]);

  return null;
}
