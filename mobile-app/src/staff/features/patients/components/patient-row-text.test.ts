import { ageText, demographicsLine, idLine } from './patient-row-text';

describe('patient row text', () => {
  it('computes age in years or months at the clinic today', () => {
    expect(ageText('1990-06-15', '2026-06-14')).toBe('35y');
    expect(ageText('1990-06-15', '2026-06-15')).toBe('36y');
    expect(ageText('2026-01-10', '2026-09-09')).toBe('7m');
    expect(ageText(null, '2026-01-01')).toBeNull();
    expect(ageText('2030-01-01', '2026-01-01')).toBeNull();
    expect(ageText('garbage', '2026-01-01')).toBeNull();
  });

  it('builds the id and demographics lines, skipping empty parts', () => {
    expect(idLine('P-00034', '03001234567')).toBe('P-00034 · 0300•••4567');
    expect(idLine('P-00034', '')).toBe('P-00034');
    expect(demographicsLine('1990-01-01', 'female', '2026-01-01')).toBe('36y · Female');
    expect(demographicsLine(null, 'male', '2026-01-01')).toBe('Male');
    expect(demographicsLine(null, null, '2026-01-01')).toBe('');
  });
});
