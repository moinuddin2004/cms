/**
 * Minimal bidirectional-text helpers for the prescription PDF.
 *
 * Not a full UAX #9 implementation — just enough for prescriptions, which mix
 * Urdu (right-to-left, Arabic script) with medicine names, doses and numbers
 * (left-to-right):
 *   - paragraph direction = first strong letter (P2/P3);
 *   - Arabic-script letters are R, other letters are L;
 *   - digits (ASCII and Arabic-Indic) always read left-to-right; a number
 *     joins the Latin text next to it ("Panadol 500mg", "بار × 5 days"), or
 *     the Urdu when Urdu is on both sides ("دن میں 2 بار"); line ends count
 *     as the paragraph direction;
 *   - neutrals (spaces, punctuation) take the direction of the text on both
 *     sides when it agrees, else the paragraph direction (N1/N2);
 *   - runs are reordered with L2.
 * Output is a list of segments in VISUAL order (left to right on the page).
 * Each segment carries its text in LOGICAL order plus whether it is
 * right-to-left and whether it must be set in the Arabic-script font; the
 * renderer shapes / reverses it accordingly.
 */

export interface BidiSegment {
  /** Characters in logical (typed) order. */
  text: string;
  /** Rendered right-to-left (reverse / shape RTL). */
  rtl: boolean;
  /** Set in the Arabic-script font (otherwise the Latin font). */
  arabic: boolean;
}

/** Arabic, Arabic Supplement, Arabic Extended-A, Presentation Forms A/B. */
const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_DIGIT_RE = /[\u0660-\u0669\u06F0-\u06F9]/;
const DIGIT_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const NUMBER_SEPARATOR_RE = /[.,:/\-\u066B\u066C]/;
const NUMBER_AFFIX_RE = /[%\u066A\u00B0+#$]/;
const LETTER_RE = /\p{L}/u;
/** Combining marks and zero-width (non-)joiners follow the previous char. */
const ATTACHING_RE = /[\p{M}\u200C\u200D]/u;

const MIRROR: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};

/** True when the text contains any Arabic-script character (Urdu etc.). */
export function hasArabicScript(text: string | null | undefined): boolean {
  return !!text && ARABIC_SCRIPT_RE.test(text);
}

type CharClass = 'R' | 'L' | 'N' | 'O';

function classify(ch: string): CharClass {
  if (DIGIT_RE.test(ch)) return 'N';
  if (ARABIC_SCRIPT_RE.test(ch)) return 'R';
  if (LETTER_RE.test(ch)) return 'L';
  return 'O';
}

/** Paragraph direction: the first strong letter decides; LTR when none. */
export function isRtlParagraph(text: string): boolean {
  for (const ch of text) {
    const c = classify(ch);
    if (c === 'R') return true;
    if (c === 'L') return false;
  }
  return false;
}

/**
 * Split one line into visual-order segments. `baseRtl` overrides the
 * paragraph direction (used when a wrapped line belongs to a paragraph whose
 * direction was decided by an earlier line).
 */
export function bidiSegments(text: string, baseRtl?: boolean): BidiSegment[] {
  const chars = Array.from(text);
  if (!chars.length) return [];
  const rtlPara = baseRtl ?? isRtlParagraph(text);

  // 1. Character classes; marks / joiners inherit from the previous char.
  const cls: CharClass[] = [];
  chars.forEach((ch, i) => {
    cls.push(
      i > 0 && ATTACHING_RE.test(ch) && !ARABIC_SCRIPT_RE.test(ch)
        ? cls[i - 1]
        : classify(ch),
    );
  });
  // W4/W5: a separator between two digits (2.5, 10:30, 1/2) and a % / °
  // next to digits read as part of the number.
  for (let i = 0; i < chars.length; i++) {
    if (cls[i] === 'N') continue;
    const prevN = i > 0 && cls[i - 1] === 'N';
    const nextN = i + 1 < chars.length && cls[i + 1] === 'N';
    if (
      (NUMBER_SEPARATOR_RE.test(chars[i]) && prevN && nextN) ||
      (NUMBER_AFFIX_RE.test(chars[i]) && (prevN || nextN))
    ) {
      cls[i] = 'N';
    }
  }

  // 2. Numbers (see header). `influence` is the direction a char exerts on
  //    adjacent neutrals; Urdu-side numbers act as R (N1).
  const sos: 'L' | 'R' = rtlPara ? 'R' : 'L';
  const prevStrong: ('L' | 'R')[] = [];
  let strong: 'L' | 'R' = sos;
  for (let i = 0; i < chars.length; i++) {
    prevStrong.push(strong);
    if (cls[i] === 'R' || cls[i] === 'L') strong = cls[i] as 'L' | 'R';
  }
  const nextStrong: ('L' | 'R')[] = new Array<'L' | 'R'>(chars.length);
  strong = sos;
  for (let i = chars.length - 1; i >= 0; i--) {
    nextStrong[i] = strong;
    if (cls[i] === 'R' || cls[i] === 'L') strong = cls[i] as 'L' | 'R';
  }
  const influence = new Array<'L' | 'R' | null>(chars.length).fill(null);
  const numberIsL = new Array<boolean>(chars.length).fill(false);
  for (let i = 0; i < chars.length; i++) {
    if (cls[i] === 'R' || cls[i] === 'L') {
      influence[i] = cls[i] as 'L' | 'R';
    } else if (cls[i] === 'N') {
      numberIsL[i] = rtlPara
        ? prevStrong[i] === 'L' || nextStrong[i] === 'L'
        : !(prevStrong[i] === 'R' && nextStrong[i] === 'R');
      influence[i] = numberIsL[i] ? 'L' : 'R';
    }
  }

  // 3. Embedding levels (even = LTR, odd = RTL).
  const base = rtlPara ? 1 : 0;
  const levels = new Array<number>(chars.length).fill(base);
  for (let i = 0; i < chars.length; i++) {
    if (cls[i] === 'R') levels[i] = 1;
    else if (cls[i] === 'L') levels[i] = rtlPara ? 2 : 0;
    else if (cls[i] === 'N') {
      // A number is always laid out LTR: level 2 inside RTL text.
      levels[i] = numberIsL[i] ? (rtlPara ? 2 : 0) : 2;
    }
  }
  // Neutral sequences.
  for (let i = 0; i < chars.length; ) {
    if (cls[i] !== 'O') {
      i++;
      continue;
    }
    let j = i;
    while (j < chars.length && cls[j] === 'O') j++;
    const before = i > 0 ? (influence[i - 1] ?? sos) : sos;
    const after = j < chars.length ? (influence[j] ?? sos) : sos;
    const dir = before === after ? before : sos;
    // R neutrals sit at 1; L neutrals at the base level of LTR text, or at
    // 2 inside RTL text (they belong to the embedded LTR island).
    const lvl = dir === 'R' ? 1 : rtlPara ? 2 : 0;
    for (let k = i; k < j; k++) levels[k] = lvl;
    i = j;
  }

  // 4. Runs of equal level and equal font.
  interface Run {
    text: string;
    level: number;
    arabic: boolean;
  }
  const runs: Run[] = [];
  chars.forEach((ch, i) => {
    const level = levels[i];
    const arabicFont =
      ARABIC_SCRIPT_RE.test(ch) ||
      // Arabic-Indic digits and joiners belong to the Arabic font.
      ARABIC_DIGIT_RE.test(ch) ||
      ((ch === '\u200C' || ch === '\u200D') && i > 0 && cls[i - 1] === 'R') ||
      // Spaces between two Urdu words use the Urdu font's space.
      (/\s/.test(ch) &&
        level % 2 === 1 &&
        nonSpaceClass(chars, cls, i, -1) === 'R' &&
        nonSpaceClass(chars, cls, i, 1) === 'R');
    const last = runs[runs.length - 1];
    if (last && last.level === level && last.arabic === arabicFont) {
      last.text += ch;
    } else {
      runs.push({ text: ch, level, arabic: arabicFont });
    }
  });

  // 5. L2: from the highest level down to the lowest odd level, reverse
  //    every maximal sequence of runs at that level or higher.
  const maxLevel = Math.max(...runs.map((r) => r.level));
  const minOdd = Math.min(
    ...runs.map((r) => (r.level % 2 === 1 ? r.level : r.level + 1)),
  );
  for (let lvl = maxLevel; lvl >= minOdd; lvl--) {
    for (let i = 0; i < runs.length; ) {
      if (runs[i].level < lvl) {
        i++;
        continue;
      }
      let j = i;
      while (j < runs.length && runs[j].level >= lvl) j++;
      const reversed = runs.slice(i, j).reverse();
      runs.splice(i, j - i, ...reversed);
      i = j;
    }
  }

  return runs.map((r) => ({
    text: r.text,
    rtl: r.level % 2 === 1,
    arabic: r.arabic,
  }));
}

/** Class of the nearest non-space char before (-1) or after (1) `i`. */
function nonSpaceClass(
  chars: string[],
  cls: CharClass[],
  i: number,
  step: 1 | -1,
): CharClass | undefined {
  for (let k = i + step; k >= 0 && k < chars.length; k += step) {
    if (!/\s/.test(chars[k])) return cls[k];
  }
  return undefined;
}

/** Visual form of a non-Arabic RTL run: reversed, brackets mirrored. */
export function reverseForRtl(text: string): string {
  return Array.from(text)
    .reverse()
    .map((ch) => MIRROR[ch] ?? ch)
    .join('');
}

/**
 * Greedy word wrap. `measure` returns the rendered width of a candidate
 * line. Paragraph breaks (\n) are kept; a word longer than the line is put
 * on its own line rather than split.
 */
export function wrapWords(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || measure(candidate) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
