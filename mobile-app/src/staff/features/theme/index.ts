/**
 * Public surface of the staff theme feature (docs/04 §2). `StaffLayout` paints
 * the cached brand and `StaffMainLayout` fetches the live one; nothing else
 * imports this feature's internals.
 */
export { BrandTheme } from './components/BrandTheme';
export { applyCachedBrand } from './lib/apply-cached-brand';
export { useClinicTheme, themeKeys } from './hooks/useClinicTheme';
export type { ClinicTheme, ThemeDefaultMode } from './types/theme.types';
