import {
  bidiSegments,
  hasArabicScript,
  isRtlParagraph,
  reverseForRtl,
  wrapWords,
} from './bidi';

/** Compact view: [text, 'R'|'L', 'ar'|'la'] per visual segment. */
const view = (text: string, baseRtl?: boolean) =>
  bidiSegments(text, baseRtl).map((s) => [
    s.text,
    s.rtl ? 'R' : 'L',
    s.arabic ? 'ar' : 'la',
  ]);

describe('bidi helpers', () => {
  describe('hasArabicScript / isRtlParagraph', () => {
    it('detects Urdu text', () => {
      expect(hasArabicScript('کھانے کے بعد')).toBe(true);
      expect(hasArabicScript('Panadol 500mg')).toBe(false);
      expect(hasArabicScript(null)).toBe(false);
    });

    it('uses the first strong letter for paragraph direction', () => {
      expect(isRtlParagraph('کھانے کے بعد')).toBe(true);
      expect(isRtlParagraph('Panadol 500mg — دن میں تین بار')).toBe(false);
      expect(isRtlParagraph('500 دن')).toBe(true); // digits are not strong
      expect(isRtlParagraph('123 - 456')).toBe(false);
    });
  });

  describe('bidiSegments', () => {
    it('returns plain Latin text as one LTR segment', () => {
      expect(view('Take 1 tab daily')).toEqual([
        ['Take 1 tab daily', 'L', 'la'],
      ]);
    });

    it('keeps a pure Urdu line as one RTL Arabic run (spaces included)', () => {
      expect(view('دن میں دو بار ایک گولی')).toEqual([
        ['دن میں دو بار ایک گولی', 'R', 'ar'],
      ]);
    });

    it('puts Urdu after Latin on the right in an LTR line', () => {
      expect(view('Panadol 500mg — دن میں تین بار')).toEqual([
        ['Panadol 500mg — ', 'L', 'la'],
        ['دن میں تین بار', 'R', 'ar'],
      ]);
    });

    it('keeps Arabic-Indic numbers LTR inside Urdu (visual order reversed)', () => {
      // Logical: صبح ۱ گولی، رات ۱ گولی → visually right-to-left, so the
      // first word (صبح) is the LAST segment.
      const segs = view('صبح ۱ گولی، رات ۱۲ گولی');
      expect(segs).toEqual([
        ['گولی', 'R', 'ar'],
        [' ', 'R', 'la'],
        ['۱۲', 'L', 'ar'],
        [' ', 'R', 'la'],
        ['گولی، رات', 'R', 'ar'],
        [' ', 'R', 'la'],
        ['۱', 'L', 'ar'],
        [' ', 'R', 'la'],
        ['صبح', 'R', 'ar'],
      ]);
    });

    it('treats Latin words and numbers inside Urdu as an LTR island', () => {
      const segs = view('دن میں 2 بار Panadol 500mg لیں');
      expect(segs).toEqual([
        ['لیں', 'R', 'ar'],
        [' ', 'R', 'la'],
        ['Panadol 500mg', 'L', 'la'],
        [' ', 'R', 'la'],
        ['بار', 'R', 'ar'],
        [' ', 'R', 'la'],
        ['2', 'L', 'la'],
        [' ', 'R', 'la'],
        ['دن میں', 'R', 'ar'],
      ]);
    });

    it('attaches a number to the Latin text that follows it', () => {
      // "× 5 days" must stay together after the Urdu frequency.
      expect(view('1 tab  دن میں تین بار  × 5 days')).toEqual([
        ['1 tab  ', 'L', 'la'],
        ['دن میں تین بار', 'R', 'ar'],
        ['  × 5 days', 'L', 'la'],
      ]);
    });

    it('keeps decimals and percentages in one number', () => {
      const segs = view('بخار 2.5 دن، 50% کمی');
      const texts = segs.map((s) => s[0]);
      expect(texts).toContain('2.5');
      expect(texts).toContain('50%');
    });

    it('marks neutral punctuation in RTL text as RTL (to be mirrored)', () => {
      const segs = bidiSegments('لیں (ضرورت کے مطابق)');
      const parens = segs.filter((s) => /[()]/.test(s.text));
      expect(parens.length).toBe(2);
      expect(parens.every((s) => s.rtl && !s.arabic)).toBe(true);
      // Visually the closing paren comes first (leftmost).
      expect(segs[0].text).toBe(')');
    });

    it('honours an explicit base direction for wrapped lines', () => {
      expect(view('Panadol 500mg', true)).toEqual([
        ['Panadol 500mg', 'L', 'la'],
      ]);
      expect(view('Panadol بار', true)).toEqual([
        ['بار', 'R', 'ar'],
        [' ', 'R', 'la'],
        ['Panadol', 'L', 'la'],
      ]);
    });

    it('returns nothing for an empty string', () => {
      expect(bidiSegments('')).toEqual([]);
    });
  });

  describe('reverseForRtl', () => {
    it('reverses and mirrors brackets', () => {
      expect(reverseForRtl('(a)')).toBe('(a)');
      expect(reverseForRtl(' (')).toBe(') ');
      expect(reverseForRtl('ab')).toBe('ba');
    });
  });

  describe('wrapWords', () => {
    const measure = (s: string) => s.length;

    it('wraps greedily on spaces', () => {
      expect(wrapWords('aa bb cc dd', 5, measure)).toEqual(['aa bb', 'cc dd']);
    });

    it('keeps paragraph breaks and puts an over-long word on its own line', () => {
      expect(wrapWords('abcdefgh x\ny', 4, measure)).toEqual([
        'abcdefgh',
        'x',
        'y',
      ]);
    });

    it('wraps Urdu words in logical order', () => {
      expect(wrapWords('دن میں دو بار', 7, measure)).toEqual([
        'دن میں',
        'دو بار',
      ]);
    });
  });
});
