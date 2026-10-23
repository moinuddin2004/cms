import { csvCell } from './patients.service';

describe('patient export csvCell', () => {
  it('leaves plain values alone and blanks nulls', () => {
    expect(csvCell('Ali Khan')).toBe('Ali Khan');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Khan, Ali')).toBe('"Khan, Ali"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(csvCell('-2+3+cmd')).toBe("'-2+3+cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('keeps phone numbers and plain negatives readable', () => {
    expect(csvCell('+923001234567')).toBe('+923001234567');
    expect(csvCell('+92 300 1234567')).toBe('+92 300 1234567');
    expect(csvCell('-1')).toBe('-1');
  });
});
