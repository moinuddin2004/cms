import { applyTextScale, TEXT_SCALE_SIZES } from './apply-text-scale';

const mockUpdateCSSVariables = jest.fn();

jest.mock('uniwind', () => ({
  Uniwind: { updateCSSVariables: (...args: unknown[]) => mockUpdateCSSVariables(...args) },
}));

describe('applyTextScale', () => {
  beforeEach(() => mockUpdateCSSVariables.mockClear());

  it('uses the sizes from docs/05 §3', () => {
    expect(TEXT_SCALE_SIZES.staff).toEqual({
      '--text-4xl': 28,
      '--text-3xl': 22,
      '--text-2xl': 18,
      '--text-lg': 17,
      '--text-base': 15,
      '--text-sm': 13,
    });
    expect(TEXT_SCALE_SIZES.patient).toEqual({
      '--text-4xl': 30,
      '--text-3xl': 24,
      '--text-2xl': 20,
      '--text-lg': 18,
      '--text-base': 17,
      '--text-sm': 15,
    });
  });

  it('is never smaller in the patient space', () => {
    for (const variable of Object.keys(TEXT_SCALE_SIZES.staff) as (
      keyof typeof TEXT_SCALE_SIZES.staff
    )[]) {
      expect(TEXT_SCALE_SIZES.patient[variable]).toBeGreaterThan(TEXT_SCALE_SIZES.staff[variable]);
    }
  });

  it('writes both colour schemes', () => {
    applyTextScale('patient');

    expect(mockUpdateCSSVariables).toHaveBeenCalledTimes(2);
    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(1, 'light', TEXT_SCALE_SIZES.patient);
    expect(mockUpdateCSSVariables).toHaveBeenNthCalledWith(2, 'dark', TEXT_SCALE_SIZES.patient);
  });
});
