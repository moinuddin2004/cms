import {
  computeEndDate,
  parseDoseTimes,
  parseDurationDays,
} from './medication-parsers';

describe('parseDoseTimes', () => {
  const M = '08:00';
  const N = '14:00';
  const E = '20:00';
  const B = '22:00';

  // [tags, frequency text, expected times, expected source]
  const cases: Array<[string, unknown, string | null, string[], string]> = [
    // tags
    ['tag morning', ['morning'], null, [M], 'tags'],
    ['tag noon', ['noon'], null, [N], 'tags'],
    ['tag afternoon', ['afternoon'], null, [N], 'tags'],
    ['tag evening', ['evening'], null, [E], 'tags'],
    ['tag night', ['night'], null, [B], 'tags'],
    ['tag bedtime', ['bedtime'], null, [B], 'tags'],
    ['tags morning+evening', ['morning', 'evening'], 'x', [M, E], 'tags'],
    ['tags unordered are sorted', ['night', 'morning'], null, [M, B], 'tags'],
    ['tags dedupe noon+afternoon', ['noon', 'afternoon'], null, [N], 'tags'],
    ['tags dedupe night+bedtime', ['night', 'bedtime'], null, [B], 'tags'],
    ['tags are case/space tolerant', [' Morning '], null, [M], 'tags'],
    ['unknown tag ignored, known kept', ['whenever', 'evening'], null, [E], 'tags'],
    ['unknown tag only → falls back to frequency', ['whenever'], 'BD', [M, E], 'frequency'],
    ['tags win over frequency', ['night'], 'TDS', [B], 'tags'],
    ['non-array tags fall back', 'morning', 'OD', [M], 'frequency'],
    ['non-string tags ignored', [1, null], 'OD', [M], 'frequency'],
    // abbreviations
    ['OD', [], 'OD', [M], 'frequency'],
    ['o.d. with dots', [], 'o.d.', [M], 'frequency'],
    ['QD', [], 'QD', [M], 'frequency'],
    ['BD', [], 'BD', [M, E], 'frequency'],
    ['BID', [], 'bid', [M, E], 'frequency'],
    ['TDS', [], 'TDS', [M, N, E], 'frequency'],
    ['TID', [], 'T.I.D', [M, N, E], 'frequency'],
    ['QID', [], 'QID', ['08:00', '13:00', '18:00', '22:00'], 'frequency'],
    ['BD with meal text', [], 'BD after meals', [M, E], 'frequency'],
    ['HS', [], 'HS', [B], 'frequency'],
    // grids
    ['1+0+1', [], '1+0+1', [M, E], 'frequency'],
    ['1-1-1', [], '1-1-1', [M, N, E], 'frequency'],
    ['0-0-1', [], '0-0-1', [E], 'frequency'],
    ['1-0-0', [], '1-0-0', [M], 'frequency'],
    ['0+1+0', [], '0+1+0', [N], 'frequency'],
    ['1-0-0-1 four slots', [], '1-0-0-1', ['08:00', '22:00'], 'frequency'],
    ['1-1-1-1 four slots', [], '1-1-1-1', ['08:00', '13:00', '18:00', '22:00'], 'frequency'],
    ['half tablets 1/2-0-1/2', [], '1/2-0-1/2', [M, E], 'frequency'],
    ['unicode half ½+0+½', [], '½+0+½', [M, E], 'frequency'],
    ['grid with spaces', [], '1 + 0 + 1', [M, E], 'frequency'],
    ['all-zero grid → nothing', [], '0-0-0', [], 'none'],
    // phrases
    ['twice a day', [], 'twice a day', [M, E], 'frequency'],
    ['Twice daily', [], 'Twice daily', [M, E], 'frequency'],
    ['once a day', [], 'once a day', [M], 'frequency'],
    ['three times a day', [], 'three times a day', [M, N, E], 'frequency'],
    ['3 times a day', [], '3 times a day', [M, N, E], 'frequency'],
    ['4 times daily', [], '4 times daily', ['08:00', '13:00', '18:00', '22:00'], 'frequency'],
    ['2x daily', [], '2x daily', [M, E], 'frequency'],
    ['2/day', [], '2/day', [M, E], 'frequency'],
    ['daily', [], 'daily', [M], 'frequency'],
    ['every day', [], 'every day', [M], 'frequency'],
    ['5 times a day is unsupported', [], '5 times a day', [], 'none'],
    ['once at night', [], 'once at night', [B], 'frequency'],
    ['OD at night', [], 'OD at night', [B], 'frequency'],
    ['twice morning and evening', [], 'twice morning and evening', [M, E], 'frequency'],
    // intervals
    ['q12h', [], 'q12h', [M, E], 'frequency'],
    ['every 8 hours', [], 'every 8 hours', ['06:00', '14:00', '22:00'], 'frequency'],
    ['6 hourly', [], '6 hourly', ['00:00', '06:00', '12:00', '18:00'], 'frequency'],
    ['every 5 hours is unsupported', [], 'every 5 hours', [], 'none'],
    // Urdu / Roman Urdu
    ['din mein do baar', [], 'din mein do baar', [M, E], 'frequency'],
    ['din mein teen baar', [], 'din mein teen baar', [M, N, E], 'frequency'],
    ['din mein ek baar', [], 'din mein ek baar', [M], 'frequency'],
    ['din mein char baar', [], 'din mein char baar', ['08:00', '13:00', '18:00', '22:00'], 'frequency'],
    ['subah shaam', [], 'subah shaam', [M, E], 'frequency'],
    ['roz raat ko', [], 'roz raat ko', [B], 'frequency'],
    ['Urdu script دن میں دو بار', [], 'دن میں دو بار', [M, E], 'frequency'],
    ['Urdu script تین بار', [], 'دن میں تین بار', [M, N, E], 'frequency'],
    // as needed / unknown
    ['SOS', [], 'SOS', [], 'none'],
    ['PRN', [], 'PRN', [], 'none'],
    ['as needed', [], 'when required / as needed', [], 'none'],
    ['empty', [], '', [], 'none'],
    ['null frequency', undefined, null, [], 'none'],
    ['gibberish', [], 'with plenty of water', [], 'none'],
  ];

  it.each(cases)('%s', (_name, tags, text, times, source) => {
    expect(parseDoseTimes(tags, text)).toEqual({ times, source });
  });

  it('has at least 40 table cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });
});

describe('parseDurationDays', () => {
  const cases: Array<[string | null | undefined, number | null]> = [
    ['5 days', 5],
    ['5 day', 5],
    ['5 Days', 5],
    ['5days', 5],
    ['7d', 7],
    ['x 5 days', 5],
    ['for 10 days', 10],
    ['1 week', 7],
    ['2 weeks', 14],
    ['2wk', 14],
    ['10 din', 10],
    ['ek hafta', 7],
    ['do hafte', 14],
    ['1 month', 30],
    ['3 months', 90],
    ['1 mahina', 30],
    ['1 year', 365],
    ['five days', 5],
    ['5-7 days', 7],
    ['1 to 2 weeks', 14],
    ['1.5 weeks', 11],
    ['10 دن', 10],
    ['دو ہفتے', 14],
    ['ongoing', null],
    ['continue', null],
    ['lifelong', null],
    ['till review', null],
    ['as directed', null],
    ['0 days', null],
    ['400 days', null],
    ['', null],
    [null, null],
    [undefined, null],
    ['soon', null],
  ];

  it.each(cases)('%j → %j', (input, expected) => {
    expect(parseDurationDays(input)).toBe(expected);
  });
});

describe('computeEndDate', () => {
  it('is inclusive of the start day', () => {
    expect(computeEndDate('2026-11-15', 5)).toBe('2026-11-19');
    expect(computeEndDate('2026-11-15', 1)).toBe('2026-11-15');
  });
  it('crosses month and year boundaries', () => {
    expect(computeEndDate('2026-12-30', 5)).toBe('2027-01-03');
  });
  it('is null when the duration is unknown', () => {
    expect(computeEndDate('2026-11-15', null)).toBeNull();
    expect(computeEndDate('2026-11-15', 0)).toBeNull();
  });
});
