import { addDays } from 'src/common/clock/tz.util';

/**
 * Pure parsers that turn a prescription medicine line into default reminder
 * times and an end date (M3-01). Everything here is best effort: an input the
 * parser does not understand yields "no times" / "unknown end", never a guess.
 * Times are wall-clock "HH:mm" (phone timezone, A-10).
 */

export type DoseTimesSource = 'tags' | 'frequency' | 'none';

export interface ParsedDoseTimes {
  times: string[];
  source: DoseTimesSource;
}

const TAG_TIMES: Record<string, string> = {
  morning: '08:00',
  noon: '14:00',
  afternoon: '14:00',
  evening: '20:00',
  night: '22:00',
  bedtime: '22:00',
};

/** Times for "N doses a day" when nothing says when. */
const COUNT_TIMES: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '13:00', '18:00', '22:00'],
};

/** "every N hours" tables (only the ones that fit a day evenly). */
const INTERVAL_TIMES: Record<number, string[]> = {
  6: ['00:00', '06:00', '12:00', '18:00'],
  8: ['06:00', '14:00', '22:00'],
  12: ['08:00', '20:00'],
  24: ['08:00'],
};

// JS `\b` does not understand Urdu script; use Unicode-aware boundaries.
const NOT_LETTER = '(?<![\\p{L}\\p{N}])';
const NOT_FOLLOWED = '(?![\\p{L}\\p{N}])';

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fourteen: 14,
  fifteen: 15,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  che: 6,
  chay: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  ایک: 1,
  دو: 2,
  تین: 3,
  چار: 4,
  پانچ: 5,
  چھ: 6,
  سات: 7,
  آٹھ: 8,
  نو: 9,
  دس: 10,
};

const NUMBER_WORD_ALT = Object.keys(NUMBER_WORDS).join('|');

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function numberOf(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  return NUMBER_WORDS[token] ?? null;
}

function sortedUnique(times: string[]): string[] {
  return [...new Set(times)].sort();
}

// ── dose times ─────────────────────────────────────────────────────────

function fromTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const times: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const time = TAG_TIMES[tag.trim().toLowerCase()];
    if (time) times.push(time);
  }
  return sortedUnique(times);
}

const GRID_TOKEN = '(?:\\d+(?:\\.\\d+)?(?:/\\d+)?|½|¼|¾)';
const GRID_RE = new RegExp(
  `(?<![\\w/.])${GRID_TOKEN}(?:\\s*[+\\-–—]\\s*${GRID_TOKEN}){2,3}(?![\\w/.])`,
);

function isZeroToken(token: string): boolean {
  return /^0+(\.0+)?$/.test(token.trim());
}

/** "1+0+1", "1-1-1", "1-0-0-1" → one dose per non-zero slot. */
function fromGrid(text: string): string[] | null {
  const m = GRID_RE.exec(text);
  if (!m) return null;
  const slots = m[0].split(/[+\-–—]/).map((s) => s.trim());
  const table = COUNT_TIMES[slots.length === 3 ? 3 : 4];
  return sortedUnique(table.filter((_, i) => !isZeroToken(slots[i])));
}

const TOD_WORDS: Array<[RegExp, string]> = [
  [
    new RegExp(
      `${NOT_LETTER}(?:subah|subha|morning|sawere|صبح)${NOT_FOLLOWED}`,
      'u',
    ),
    '08:00',
  ],
  [
    new RegExp(
      `${NOT_LETTER}(?:dopehar|dopahar|noon|afternoon|دوپہر)${NOT_FOLLOWED}`,
      'u',
    ),
    '14:00',
  ],
  [
    new RegExp(
      `${NOT_LETTER}(?:shaam|sham|evening|شام)${NOT_FOLLOWED}`,
      'u',
    ),
    '20:00',
  ],
  [
    new RegExp(
      `${NOT_LETTER}(?:raat|night|bedtime|رات)${NOT_FOLLOWED}`,
      'u',
    ),
    '22:00',
  ],
];

function timeOfDayWords(text: string): string[] {
  return sortedUnique(
    TOD_WORDS.filter(([re]) => re.test(text)).map(([, time]) => time),
  );
}

const has = (text: string, words: string[]) =>
  new RegExp(`${NOT_LETTER}(?:${words.join('|')})${NOT_FOLLOWED}`, 'u').test(
    text,
  );

/** "N doses a day" from abbreviations or phrases; null when none found. */
function dosesPerDay(text: string): number | null {
  if (has(text, ['od', 'qd', 'once'])) return 1;
  if (has(text, ['bd', 'bid', 'bds', 'twice'])) return 2;
  if (has(text, ['tds', 'tid', 'thrice'])) return 3;
  if (has(text, ['qid', 'qds'])) return 4;

  const phrase = new RegExp(
    `${NOT_LETTER}(\\d|${NUMBER_WORD_ALT})\\s*(?:times?|baar|bar|bari|dafa|دفعہ|بار)${NOT_FOLLOWED}`,
    'u',
  ).exec(text);
  if (phrase) return numberOf(phrase[1]);

  const perDay =
    /(?<![\w/.])(\d)\s*(?:x\s*(?:daily|a day|per day|\/day|day)|\/\s*day)/.exec(
      text,
    );
  if (perDay) return Number(perDay[1]);

  if (
    has(text, ['daily', 'everyday', 'roz', 'rozana', 'روز', 'روزانہ']) ||
    /every day/.test(text)
  ) {
    return 1;
  }
  return null;
}

function intervalHours(text: string): number | null {
  const m =
    /(?<![\w/.])q\s?(\d{1,2})\s?h(?:r|rs|ours?)?(?![\p{L}\p{N}])/u.exec(text) ??
    /every\s+(\d{1,2})\s*(?:h|hr|hrs|hours?)(?![\p{L}\p{N}])/u.exec(text) ??
    /(?<![\w/.])(\d{1,2})\s*-?\s*hourly/.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * Weekly / alternate-day / monthly wording. Such a medicine must never get
 * daily default times (safety): the patient sets the times themselves.
 */
const NOT_DAILY_RE =
  /(?<![\p{L}\p{N}])(?:weekly|biweekly|fortnightly|monthly|alternate|alternately)(?![\p{L}\p{N}])|(?:once|twice|thrice|\d+\s*(?:x|times?)?)\s*(?:a|per|\/|in a|in the)\s*(?:week|wk|month)(?![\p{L}\p{N}])|every\s*(?:other|second|2nd|third|3rd|\d+)\s*(?:day|days|week|weeks|wk|month|months)(?![\p{L}\p{N}])|every\s*(?:week|month)(?![\p{L}\p{N}])|\/\s*(?:week|wk|month)|(?<![\p{L}\p{N}])har\s+(?:doosre|dusre|dosre|teesre)\s+din|(?<![\p{L}\p{N}])(?:hafte|hafta|haftay|haftey|mahine|mahina)\s+(?:mein|me|main)\s|ہفتے میں|ہفتہ وار|مہینے میں|دن چھوڑ کر|ایک دن چھوڑ/u;

function fromFrequencyText(raw: string): string[] | 'none' | null {
  const original = normalize(raw);
  if (!original) return null;
  if (NOT_DAILY_RE.test(original + ' ')) return 'none';

  const grid = fromGrid(original);
  if (grid) return grid;

  const text = original.replace(/\./g, '');

  if (
    has(text, ['sos', 'prn', 'zaroorat', 'zarurat', 'ضرورت']) ||
    /as needed|when required|if needed|when needed/.test(text)
  ) {
    return 'none';
  }

  const hours = intervalHours(text);
  if (hours !== null) return INTERVAL_TIMES[hours] ?? 'none';

  const tod = timeOfDayWords(text);
  const hs = has(text, ['hs']);
  const count = dosesPerDay(text);

  if (hs && count === null) return ['22:00'];
  if (count !== null) {
    if (count < 1 || count > 4) return 'none';
    if (tod.length > 0 && (count === 1 || tod.length === count)) return tod;
    if (hs && count === 1) return ['22:00'];
    return COUNT_TIMES[count];
  }
  if (tod.length > 0) return tod;
  return null;
}

/**
 * Default reminder times for a medicine: known `frequency_timing` tags win
 * (unknown tags are ignored); otherwise the free-text `frequency`.
 */
export function parseDoseTimes(
  tags: unknown,
  frequencyText: string | null | undefined,
): ParsedDoseTimes {
  const fromTag = fromTags(tags);
  if (fromTag.length > 0) return { times: fromTag, source: 'tags' };

  const fromText = fromFrequencyText(frequencyText ?? '');
  if (Array.isArray(fromText) && fromText.length > 0) {
    return { times: fromText, source: 'frequency' };
  }
  return { times: [], source: 'none' };
}

// ── duration ───────────────────────────────────────────────────────────

const UNITS: Array<[string, number]> = [
  ['days?|d|din|dino|roz|دن', 1],
  ['weeks?|wks?|w|hafta|hafte|haftay|haftey|ہفتہ|ہفتے', 7],
  ['months?|mos?|mahina|mahine|mahinay|maah|مہینہ|مہینے|ماہ', 30],
  ['years?|yrs?|saal|سال', 365],
];

const OPEN_ENDED =
  /ongoing|continu|lifelong|life long|life-long|permanent|regular|till |until |as directed|as needed|\bsos\b|\bprn\b|hamesha|zindagi/;

const MAX_DAYS = 366;

/** Duration text → whole days (≥ 1), or null when unknown / open-ended. */
export function parseDurationDays(
  text: string | null | undefined,
): number | null {
  const t = normalize(text ?? '');
  if (!t || OPEN_ENDED.test(t)) return null;

  const num = `(\\d+(?:\\.\\d+)?|${NUMBER_WORD_ALT})`;
  for (const [unitAlt, mult] of UNITS) {
    const re = new RegExp(
      `${NOT_LETTER}${num}(?:\\s*(?:-|–|to)\\s*${num})?\\s*(?:${unitAlt})${NOT_FOLLOWED}`,
      'u',
    );
    const m = re.exec(t);
    if (!m) continue;
    const first = numberOf(m[1]);
    const second = m[2] ? numberOf(m[2]) : null;
    const n = Math.max(first ?? 0, second ?? 0);
    const days = Math.ceil(n * mult);
    return days >= 1 && days <= MAX_DAYS ? days : null;
  }
  return null;
}

/** Last day (inclusive) of a course of `days` starting `startYmd`. */
export function computeEndDate(
  startYmd: string,
  days: number | null,
): string | null {
  if (days === null || days < 1) return null;
  return addDays(startYmd, days - 1);
}
