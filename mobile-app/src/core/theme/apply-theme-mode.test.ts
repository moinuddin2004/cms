import { applyThemeMode } from './apply-theme-mode';

const mockSetTheme = jest.fn();

jest.mock('uniwind', () => ({
  Uniwind: { setTheme: (...args: unknown[]) => mockSetTheme(...args) },
}));

describe('applyThemeMode', () => {
  beforeEach(() => mockSetTheme.mockClear());

  it.each(['light', 'dark', 'system'] as const)('passes %s through', (mode) => {
    applyThemeMode(mode);
    expect(mockSetTheme).toHaveBeenCalledWith(mode);
  });

  it('falls back to system for null / unknown', () => {
    applyThemeMode(null);
    applyThemeMode(undefined);
    applyThemeMode('sepia' as never);
    expect(mockSetTheme.mock.calls).toEqual([['system'], ['system'], ['system']]);
  });
});
