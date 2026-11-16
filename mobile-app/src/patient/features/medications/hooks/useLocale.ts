import { useT } from '@/core/i18n';

/** The current UI locale — lets non-visual components react to a language change. */
export const useLocale = () => useT().locale;
