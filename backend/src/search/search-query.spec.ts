import { escapeLike, isNumericQuery, phoneCore } from './search-query';

describe('search-query', () => {
  it('detects numeric queries', () => {
    expect(isNumericQuery('0300-1234567')).toBe(true);
    expect(isNumericQuery('+92 (300) 1234567')).toBe(true);
    expect(isNumericQuery('Ali 0300')).toBe(false);
    expect(isNumericQuery('P-0012')).toBe(false);
  });

  it('reduces every phone format to the same core digits', () => {
    expect(phoneCore('0300-1234567')).toBe('3001234567');
    expect(phoneCore('+92 300 1234567')).toBe('3001234567');
    expect(phoneCore('0092 300 1234567')).toBe('3001234567');
    expect(phoneCore('3001234567')).toBe('3001234567');
    // A short fragment starting with 92 is not treated as a country code.
    expect(phoneCore('9234')).toBe('9234');
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
