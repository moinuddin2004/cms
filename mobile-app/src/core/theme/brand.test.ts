import {
  checkBrandContrast,
  contrastRatio,
  deriveBrandPalette,
  hexToOklch,
  isHexColor,
  oklchToHex,
  RAMP_STEPS,
  readableForeground,
} from './brand';

/** Five brands with different hues and lightness (docs/09 §2: 5 sample colours). */
const SAMPLES = ['#0e7490', '#16a34a', '#d97706', '#2563eb', '#7c3aed'];

describe('brand colour math', () => {
  it('accepts only #rrggbb colours', () => {
    expect(isHexColor('#0e7490')).toBe(true);
    expect(isHexColor('#0E7490')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('0e7490')).toBe(false);
    expect(isHexColor('teal')).toBe(false);
  });

  it('round-trips an in-gamut colour through OKLCH', () => {
    for (const hex of SAMPLES) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('measures WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // The platform primary on white (docs/10 M0-05 step 1).
    expect(contrastRatio('#0e7490', '#ffffff')).toBeCloseTo(5.36, 2);
  });

  it('picks the readable foreground', () => {
    expect(readableForeground('#0e7490')).toBe('#ffffff');
    expect(readableForeground('#fcd34d')).toBe('#000000');
  });
});

describe('deriveBrandPalette', () => {
  it.each(SAMPLES)('derives readable light and dark tokens for %s', (hex) => {
    const palette = deriveBrandPalette(hex);

    expect(palette.light.brand).toBe(hex);
    expect(palette.dark.brand).toMatch(/^#[0-9a-f]{6}$/);
    // Every primary button keeps its label readable in both schemes.
    expect(contrastRatio(palette.light.brand, palette.light.foreground)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(palette.dark.brand, palette.dark.foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SAMPLES)('lifts a dark brand for the dark background: %s', (hex) => {
    const palette = deriveBrandPalette(hex);
    const base = hexToOklch(hex);

    // Dark mode never uses a brand darker than OKLCH lightness 0.62.
    expect(hexToOklch(palette.dark.brand).l).toBeGreaterThanOrEqual(0.61);
    if (base.l < 0.62) expect(palette.dark.brand).not.toBe(palette.light.brand);
  });

  it('emits the full 50–900 ramp as hex', () => {
    const { ramp } = deriveBrandPalette('#0e7490');

    expect(Object.keys(ramp).map(Number)).toEqual([...RAMP_STEPS]);
    for (const value of Object.values(ramp)) expect(isHexColor(value)).toBe(true);
  });

  it('keeps the brand hue across the ramp', () => {
    const hue = hexToOklch('#0e7490').h;
    const { ramp } = deriveBrandPalette('#0e7490');

    for (const step of [200, 400, 600, 800] as const) {
      // Gamut clipping can move the hue a little, never to another family.
      expect(Math.abs(hexToOklch(ramp[step]).h - hue)).toBeLessThan(10);
    }
  });
});

describe('checkBrandContrast', () => {
  it('passes a normal brand colour', () => {
    const check = checkBrandContrast('#0e7490');

    expect(check.buttonRatio).toBeGreaterThanOrEqual(4.5);
    expect(check.warnings).toEqual([]);
  });

  it('warns about a very light brand colour', () => {
    const check = checkBrandContrast('#fef08a');

    expect(check.onWhiteRatio).toBeLessThan(3);
    expect(check.warnings.some((warning) => warning.includes('very light'))).toBe(true);
  });
});
