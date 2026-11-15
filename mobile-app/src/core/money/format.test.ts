import { formatMoney } from './format';

describe('formatMoney', () => {
  it('shows whole amounts without decimals', () => {
    expect(formatMoney(84000, 'PKR')).toBe('PKR 84,000');
    expect(formatMoney(0, 'PKR')).toBe('PKR 0');
  });

  it('always shows two decimals for fractional amounts, no float noise', () => {
    expect(formatMoney(84000.5, 'PKR')).toBe('PKR 84,000.50');
    expect(formatMoney(0.1 + 0.2, 'PKR')).toBe('PKR 0.30');
    expect(formatMoney(1234.5678, 'USD', 'en-US')).toBe('USD 1,234.57');
  });
});
