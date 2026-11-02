import { amountInWords, integerInWords } from './amount-in-words';

describe('amountInWords', () => {
  it('spells whole amounts', () => {
    expect(amountInWords(5800)).toBe('Rupees Five Thousand Eight Hundred Only');
    expect(amountInWords(0)).toBe('Rupees Zero Only');
    expect(amountInWords(21)).toBe('Rupees Twenty-One Only');
  });

  it('adds paisa for the fractional part', () => {
    expect(amountInWords(10.5)).toBe('Rupees Ten and Fifty Paisa Only');
    expect(amountInWords(1.01)).toBe('Rupees One and One Paisa Only');
  });

  it('survives float noise (0.1 + 0.2)', () => {
    expect(amountInWords(0.1 + 0.2)).toBe('Rupees Zero and Thirty Paisa Only');
  });

  it('skips empty thousand groups', () => {
    expect(integerInWords(1_000_001)).toBe('One Million One');
    expect(integerInWords(1_000_000)).toBe('One Million');
  });

  it('treats negatives as their absolute value', () => {
    expect(amountInWords(-100)).toBe('Rupees One Hundred Only');
  });
});
