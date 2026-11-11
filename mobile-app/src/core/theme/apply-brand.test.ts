import { applyBrand } from './apply-brand';
import { deriveBrandPalette } from './brand';
import { PLATFORM_BRAND_TOKENS } from './platform-tokens';

const mockUpdateCSSVariables = jest.fn();

jest.mock('uniwind', () => ({
  Uniwind: { updateCSSVariables: (...args: unknown[]) => mockUpdateCSSVariables(...args) },
}));

describe('applyBrand', () => {
  beforeEach(() => mockUpdateCSSVariables.mockClear());

  it('writes the clinic brand to both themes', () => {
    const palette = deriveBrandPalette('#0e7490');

    applyBrand('#0e7490');

    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(1, 'light', {
      '--color-primary': palette.light.brand,
      '--color-primary-foreground': palette.light.foreground,
      '--color-ring': palette.light.brand,
    });
    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(2, 'dark', {
      '--color-primary': palette.dark.brand,
      '--color-primary-foreground': palette.dark.foreground,
      '--color-ring': palette.dark.brand,
    });
  });

  it('restores the platform palette for null', () => {
    applyBrand(null);

    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(1, 'light', PLATFORM_BRAND_TOKENS.light);
    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(2, 'dark', PLATFORM_BRAND_TOKENS.dark);
  });

  it('falls back to the platform palette for a malformed cached value', () => {
    applyBrand('teal');

    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(1, 'light', PLATFORM_BRAND_TOKENS.light);
  });
});
