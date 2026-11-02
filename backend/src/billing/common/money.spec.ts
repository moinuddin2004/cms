import { amountInWords } from './amount-in-words';
import {
  basisPointsOf,
  percentOf,
  percentToBasisPoints,
  splitProportionally,
  sumMinor,
  toMinor,
} from './money';

describe('money', () => {
  it('converts rupees to minor without float drift', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor('1234.56')).toBe(123456);
  });

  it('converts a percentage to basis points (clamped 0–100 %)', () => {
    expect(percentToBasisPoints(17)).toBe(1700);
    expect(percentToBasisPoints('16.15')).toBe(1615);
    expect(percentToBasisPoints(null)).toBe(0);
    expect(percentToBasisPoints('abc')).toBe(0);
    expect(percentToBasisPoints(-5)).toBe(0);
    expect(percentToBasisPoints(150)).toBe(10_000);
  });

  it('takes basis points of minor exactly, half-up', () => {
    expect(basisPointsOf(100_000, 1700)).toBe(17_000);
    expect(basisPointsOf(105, 1000)).toBe(11); // 10.5 → 11
    expect(basisPointsOf(104, 1000)).toBe(10);
    // 16.15% of Rs 1,000.01 = 16,150.16… minor units
    expect(basisPointsOf(100_001, 1615)).toBe(16_150);
    expect(basisPointsOf(0, 1700)).toBe(0);
    expect(basisPointsOf(100, 0)).toBe(0);
  });

  it('rounds percentages half-up', () => {
    expect(percentOf(105, 10)).toBe(11); // 10.5 → 11
    expect(percentOf(600000, 10)).toBe(60000);
  });

  describe('splitProportionally', () => {
    it('splits Rs 500 over 1,200 / 3,000 / 1,800 as 100 / 250 / 150 (S11)', () => {
      expect(splitProportionally(50000, [120000, 300000, 180000])).toEqual([
        10000, 25000, 15000,
      ]);
    });

    it('always sums exactly to the total, remainder to the largest weight', () => {
      const shares = splitProportionally(100, [1, 1, 1]);
      expect(sumMinor(shares)).toBe(100);
      expect(shares).toEqual([34, 33, 33]);
    });

    it('handles a 1-minor total and zero weights', () => {
      expect(splitProportionally(1, [5, 10])).toEqual([0, 1]);
      expect(splitProportionally(7, [0, 0])).toEqual([7, 0]);
      expect(splitProportionally(10, [])).toEqual([]);
    });
  });
});

describe('amountInWords', () => {
  it('uses thousand / million wording', () => {
    expect(amountInWords(5800)).toBe('Rupees Five Thousand Eight Hundred Only');
    expect(amountInWords(1250000)).toBe(
      'Rupees One Million Two Hundred Fifty Thousand Only',
    );
    expect(amountInWords(21.5)).toBe('Rupees Twenty-One and Fifty Paisa Only');
    expect(amountInWords(0)).toBe('Rupees Zero Only');
  });
});
