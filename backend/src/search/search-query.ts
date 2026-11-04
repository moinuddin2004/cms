/**
 * Pure helpers that turn what the user typed into the shapes the SQL
 * matches on. Kept apart from the service so they are unit-tested alone.
 */

/** Typed text that is only a phone / CNIC / number (digits + separators). */
export function isNumericQuery(q: string): boolean {
  return /^[\d\s+\-()]+$/.test(q);
}

/**
 * Digits of a Pakistani phone without the country or trunk prefix, so
 * `0300-1234567`, `+92 300 1234567` and `3001234567` all become
 * `3001234567` and match a stored phone in any of those formats.
 */
export function phoneCore(q: string): string {
  let d = q.replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  else if (d.startsWith('92') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Escapes LIKE wildcards so a typed `%` or `_` matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Minimum typed length before any query runs. */
export const MIN_TEXT_CHARS = 2;
export const MIN_DIGIT_CHARS = 3;
