import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The MedTrackr name and mark (DECISIONS A-25). Shown only at brand moments
 * (welcome page); every other screen stays product-name free.
 *
 * The colours are the logo's own, not theme tokens: the mark must look the
 * same in light and dark mode and match the app icon, so they live here once
 * (same values as `web-app/public/favicon.svg` and
 * `scripts/make-brand-assets.py`).
 */
export const PRODUCT_NAME = 'MedTrackr';

const BRAND_BLUE = '#2563eb';
const BRAND_GREEN = '#059669';
const MARK_WHITE = '#ffffff';

/** The "M" in a 64×64 box — identical to `M_POLY` in make-brand-assets.py. */
const M_PATH = 'M16 47V17h8l8 13 8-13h8v30h-7V29l-9 13-9-13v18z';

export interface BrandMarkProps {
  /** Edge length in pt. */
  size?: number;
}

/** The rounded brand tile: white M on the blue → green diagonal. Decorative: pair it with the name. */
export function BrandMark({ size = 64 }: BrandMarkProps) {
  // One gradient id per instance: SVG ids are document-global on web.
  const gradientId = `brand-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND_BLUE} />
          <Stop offset="1" stopColor={BRAND_GREEN} />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />
      <Path fill={MARK_WHITE} d={M_PATH} />
    </Svg>
  );
}
